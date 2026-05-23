// Multi-input router · classify project, surface the tool inside the bundle
// ◊·κ=1 · ZIP / HTML / .md / project bundle → one HTML to feed the pipeline
//
// Handles:
//   - Single HTML  (passthrough)
//   - ZIP bundle   (Replit / Lovable / Next.js / Vite / CRA / Vue / Svelte)
//   - .md spec     (build sovereign HTML from spec via LLM)
//   - Project files dict (no ZIP, JSON {name: contents})

const path = require('path');

const HTML_EXTS    = ['.html', '.htm'];
const SPEC_EXTS    = ['.md', '.markdown', '.txt'];
const REACT_EXTS   = ['.jsx', '.tsx'];
const JS_EXTS      = ['.js', '.ts', '.mjs', '.cjs'];
const STYLE_EXTS   = ['.css', '.scss', '.sass'];
const DATA_EXTS    = ['.json', '.yml', '.yaml', '.toml'];

// ── Project type fingerprints ─────────────────────────────────────────
function classify(files) {
  const names = Object.keys(files);
  const has = (re) => names.some(n => re.test(n));
  const get = (re) => names.find(n => re.test(n));

  // Strip a top-level folder prefix if everything is nested under one
  let prefix = '';
  const tops = new Set(names.map(n => n.split('/')[0]));
  if (tops.size === 1 && names.every(n => n.includes('/'))) {
    prefix = [...tops][0] + '/';
  }
  const N = (re) => names.filter(n => re.test(n.slice(prefix.length))).map(n => n.slice(prefix.length));

  // Lovable: pnpm-lock + vite + tsx components in src/
  // Replit: .replit + replit.nix
  // Next.js: next.config + pages/ or app/
  // Vite/CRA: vite.config.* or react-scripts
  const fingerprints = {
    nextjs:  has(/(^|\/)next\.config\.(js|ts|mjs)$/) || has(/(^|\/)pages\/(index|_app)\.(js|tsx?)$/) || has(/(^|\/)app\/page\.(js|tsx?)$/),
    vite:    has(/(^|\/)vite\.config\.(js|ts|mjs)$/),
    cra:     names.some(n => /package\.json$/.test(n) && (files[n] || '').includes('react-scripts')),
    lovable: has(/(^|\/)pnpm-lock\.yaml$/) && has(/(^|\/)src\/App\.tsx$/),
    replit:  has(/(^|\/)\.replit$/) || has(/(^|\/)replit\.nix$/),
    vue:     has(/\.vue$/),
    svelte:  has(/\.svelte$/),
    static:  has(/(^|\/)index\.html$/) && !has(/\.(jsx|tsx)$/) && !has(/(^|\/)pages\//),
    spec_only: N(/./).every(f => SPEC_EXTS.includes(path.extname(f).toLowerCase())) && N(/./).length > 0
  };
  const type = fingerprints.nextjs ? 'nextjs'
             : fingerprints.lovable ? 'lovable'
             : fingerprints.vite ? 'vite'
             : fingerprints.cra ? 'cra'
             : fingerprints.replit ? 'replit'
             : fingerprints.vue ? 'vue'
             : fingerprints.svelte ? 'svelte'
             : fingerprints.static ? 'static-html'
             : fingerprints.spec_only ? 'spec-only'
             : 'unknown';

  // Read package.json if present
  let pkg = null;
  const pkgPath = get(/(^|\/)package\.json$/);
  if (pkgPath) { try { pkg = JSON.parse(files[pkgPath]); } catch {} }

  return { type, prefix, fingerprints, pkg, file_count: names.length };
}

// ── Find the entry HTML/component in the bundle ───────────────────────
function findEntry(files, info) {
  const candidates = {
    'nextjs':      ['pages/index.js', 'pages/index.tsx', 'pages/app.js', 'pages/_app.js', 'app/page.tsx', 'app/page.js'],
    'lovable':     ['src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/main.jsx', 'index.html'],
    'vite':        ['src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/main.jsx', 'index.html'],
    'cra':         ['src/App.js', 'src/App.tsx', 'src/index.js', 'public/index.html'],
    'replit':      ['index.html', 'index.js', 'main.py', 'app.py'],
    'vue':         ['src/App.vue', 'src/main.js'],
    'svelte':      ['src/App.svelte', 'src/main.js'],
    'static-html': ['index.html'],
    'unknown':     ['index.html', 'src/App.tsx', 'src/App.jsx', 'main.tsx', 'app.html', 'App.tsx']
  };
  const list = candidates[info.type] || candidates.unknown;
  for (const rel of list) {
    const full = info.prefix + rel;
    if (files[full]) return { path: rel, content: files[full] };
  }
  // Fallback: any .html file at all
  const anyHtml = Object.keys(files).find(n => n.endsWith('.html') || n.endsWith('.htm'));
  if (anyHtml) return { path: anyHtml.slice(info.prefix.length), content: files[anyHtml] };
  return null;
}

// ── Gather supporting files (data, styles, API stubs, spec docs) ──────
function gatherContext(files, info, entryPath) {
  const ctx = { styles: [], data: [], apis: [], specs: [], components: [], libs: [] };
  for (const [name, content] of Object.entries(files)) {
    const rel = name.slice(info.prefix.length);
    if (rel === entryPath) continue;
    const ext = path.extname(rel).toLowerCase();
    if (STYLE_EXTS.includes(ext)) ctx.styles.push({ path: rel, content });
    else if (DATA_EXTS.includes(ext) && rel !== 'package.json' && rel !== 'package-lock.json') ctx.data.push({ path: rel, content });
    else if (rel.startsWith('pages/api/') || rel.includes('/api/')) ctx.apis.push({ path: rel, content });
    else if (SPEC_EXTS.includes(ext)) ctx.specs.push({ path: rel, content });
    else if (rel.startsWith('src/components/') || rel.startsWith('components/')) ctx.components.push({ path: rel, content });
    else if (rel.startsWith('lib/') || rel.startsWith('src/lib/') || rel.startsWith('src/utils/')) ctx.libs.push({ path: rel, content });
  }
  return ctx;
}

// ── Build a synthetic HTML for project bundles (no LLM) ───────────────
// Wraps the source as inline documentation; gives the user a starting point.
function syntheticHTML(info, entry, ctx) {
  const title = (info.pkg && info.pkg.name) || 'Sovereign Tool';
  const description = (info.pkg && info.pkg.description) || '';
  const projectType = info.type;

  // Embed the source as <script type="text/source">; user can read it.
  // The post-upgrade pipeline will wrap this in the 7 layers.
  const sourceBlocks = [];
  if (entry) sourceBlocks.push({ name: entry.path, content: entry.content });
  for (const c of ctx.components.slice(0, 5)) sourceBlocks.push({ name: c.path, content: c.content });
  for (const c of ctx.libs.slice(0, 5))       sourceBlocks.push({ name: c.path, content: c.content });
  for (const c of ctx.apis.slice(0, 5))       sourceBlocks.push({ name: c.path, content: c.content });
  for (const c of ctx.specs.slice(0, 3))      sourceBlocks.push({ name: c.path, content: c.content });

  const sourceHtml = sourceBlocks.map(b =>
    `<details><summary>${b.path}</summary><pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;max-height:400px"><code>${b.content
      .slice(0, 50000)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></details>`
  ).join('\n');

  const stylesInline = ctx.styles.slice(0, 3).map(s => s.content).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · sovereign scaffold</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1F2937;background:#FAFBFC}
h1{font-size:24px;margin:0 0 6px;color:#10B981}
.meta{color:#6B7280;font-size:13px;margin-bottom:24px}
.banner{background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:6px;margin-bottom:20px}
.banner strong{color:#92400E}
details{margin:8px 0;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;background:#FFFFFF}
summary{cursor:pointer;font:600 14px monospace;color:#374151}
${stylesInline}
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">${description || 'Sovereign scaffold generated from ' + projectType + ' bundle'}</p>

<div class="banner">
  <strong>Scaffold mode.</strong> No LLM provider configured on the Forge — this is a structural extraction of your ${projectType} project. The original source is preserved below for reference. The 7 sovereignty layers (overlay, persist, theme, agents, cascade, bloom, lifecycle) are injected by the upgrade pipeline. To get a fully-converted single-file app, configure <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>CLAUDE_API_KEY</code> on the Forge server.
</div>

<div id="app">
  <h2>App goes here</h2>
  <p>Original entry: <code>${entry ? entry.path : '(none found)'}</code></p>
</div>

<h2>Source extracted from bundle</h2>
${sourceHtml}

<!-- Original source as machine-readable archive -->
<script type="application/x-forge-source">${JSON.stringify(sourceBlocks).replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>`;
}

// ── LLM-driven conversion for project bundles ─────────────────────────
async function llmConvert(askLLM, info, entry, ctx) {
  const title = (info.pkg && info.pkg.name) || 'Sovereign Tool';
  const description = (info.pkg && info.pkg.description) || '';

  const system = `You convert framework projects (Next.js, React, Vue, Svelte) into single-file sovereign HTML.

Rules — these are not negotiable:
- Output ONE complete HTML file. <!DOCTYPE html> at the top. </html> at the bottom.
- NO external scripts. NO CDN. NO build step. Vanilla JS only.
- All state in localStorage / IndexedDB. NO server calls.
- Where the original had API routes, replace with T0 deterministic fallback functions.
- Preserve UI, business logic, data, and user-visible features.
- Use system-ui font, light + dark via prefers-color-scheme.
- Output ONLY the HTML — no markdown fences, no commentary before or after.`;

  const parts = [];
  parts.push('PROJECT TYPE: ' + info.type);
  parts.push('NAME: ' + title);
  if (description) parts.push('DESCRIPTION: ' + description);
  parts.push('PACKAGE.JSON deps: ' + JSON.stringify(Object.keys((info.pkg && (info.pkg.dependencies || {})) || {}).slice(0, 20)));
  if (entry) parts.push('\n--- ENTRY (' + entry.path + ') ---\n' + entry.content.slice(0, 20000));
  for (const c of ctx.components.slice(0, 4))  parts.push('\n--- COMPONENT (' + c.path + ') ---\n' + c.content.slice(0, 8000));
  for (const c of ctx.libs.slice(0, 4))        parts.push('\n--- LIB (' + c.path + ') ---\n' + c.content.slice(0, 8000));
  for (const c of ctx.apis.slice(0, 4))        parts.push('\n--- API ROUTE (' + c.path + ') ---\n' + c.content.slice(0, 4000));
  for (const c of ctx.specs.slice(0, 2))       parts.push('\n--- SPEC (' + c.path + ') ---\n' + c.content.slice(0, 8000));
  for (const c of ctx.data.slice(0, 3))        parts.push('\n--- DATA (' + c.path + ') ---\n' + c.content.slice(0, 4000));

  const userMsg = 'Convert this project into one sovereign HTML file. Preserve all UI and logic. Replace API routes with localStorage-backed equivalents.\n\n' + parts.join('\n');

  const r = await askLLM(system, userMsg, { maxTokens: 8000 });
  if (!r || !r.text) return null;
  // Trim potential markdown fences
  let html = r.text.trim();
  html = html.replace(/^```(?:html)?\s*\n/, '').replace(/\n```\s*$/, '');
  if (!/<!DOCTYPE html/i.test(html.slice(0, 200))) {
    // Wrap if the model returned a fragment
    html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + title + '</title></head><body>' + html + '</body></html>';
  }
  return { html, provider: r.provider };
}

// ── .md spec → sovereign HTML ─────────────────────────────────────────
async function specToHTML(askLLM, specText, opts = {}) {
  if (!askLLM) {
    return specScaffold(specText, opts);
  }
  const system = `You build sovereign single-file HTML tools from specifications.
Rules — not negotiable:
- Output ONE complete HTML file. <!DOCTYPE html> at top, </html> at bottom.
- NO external scripts/CDN. Vanilla JS only. Inline CSS in <style>.
- State in localStorage. No network calls in baseline (provider config is optional).
- System-ui font, light/dark via prefers-color-scheme, mobile-first.
- Implement the spec faithfully. If something needs a server, replace with localStorage logic.
- Output ONLY HTML — no commentary, no markdown fences.`;

  const userMsg = `Build a sovereign single-file HTML tool from this spec:\n\n${specText}`;
  const r = await askLLM(system, userMsg, { maxTokens: 8000 });
  if (!r || !r.text) return specScaffold(specText, opts);
  let html = r.text.trim().replace(/^```(?:html)?\s*\n/, '').replace(/\n```\s*$/, '');
  if (!/<!DOCTYPE html/i.test(html.slice(0, 200))) {
    html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + (opts.title || 'Sovereign Tool') + '</title></head><body>' + html + '</body></html>';
  }
  return { html, provider: r.provider, source: 'llm-spec' };
}

function specScaffold(specText, opts = {}) {
  const title = opts.title || 'Sovereign Tool (Spec Scaffold)';
  const escaped = specText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#1F2937;background:#FAFBFC}
h1{font-size:24px;margin:0 0 6px;color:#10B981}
.banner{background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:6px;margin:14px 0 22px}
.banner strong{color:#92400E}
pre{background:#F3F4F6;padding:16px;border-radius:8px;overflow:auto;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-wrap:break-word}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="banner"><strong>Spec scaffold.</strong> No LLM provider was configured on the Forge — only deterministic scaffolding is available for .md specs. Set <code>GEMINI_API_KEY</code> / <code>OPENAI_API_KEY</code> / <code>CLAUDE_API_KEY</code> on the Forge server to generate a working implementation.</div>
<div id="app"><h2>App goes here</h2><p>Implementation pending. The spec below describes what should be built.</p></div>
<h2>Specification</h2>
<pre>${escaped}</pre>
</body>
</html>`;
  return { html, provider: 'deterministic', source: 'spec-scaffold' };
}

// ── Master extract — given raw input, produce HTML for the pipeline ──
async function extract({ html, files, spec_md }, { askLLM } = {}) {
  // Case 1: raw HTML — passthrough
  if (html && !files && !spec_md) {
    return { html, mode: 'html-direct', info: { type: 'static-html', file_count: 1 } };
  }
  // Case 2: spec_md alone (or files containing only .md)
  if (spec_md && !files) {
    const r = await specToHTML(askLLM, spec_md, {});
    return { html: r.html, mode: 'spec-build', info: { type: 'spec-only', file_count: 1, source: r.source, provider: r.provider } };
  }
  // Case 3: files bundle
  if (files && Object.keys(files).length) {
    const info = classify(files);
    // Spec-only inside a bundle
    if (info.type === 'spec-only') {
      const specPath = Object.keys(files).find(n => /\.md$/i.test(n));
      const specText = files[specPath] || Object.values(files)[0];
      const r = await specToHTML(askLLM, specText, { title: path.basename(specPath, path.extname(specPath)) });
      return { html: r.html, mode: 'spec-build', info: { ...info, source: r.source, provider: r.provider } };
    }
    // Single static HTML inside a zip
    if (info.type === 'static-html') {
      const entry = findEntry(files, info);
      if (entry) return { html: entry.content, mode: 'zip-static', info };
    }
    // Project bundle
    const entry = findEntry(files, info);
    const ctx = gatherContext(files, info, entry ? entry.path : null);
    if (askLLM) {
      const r = await llmConvert(askLLM, info, entry, ctx);
      if (r && r.html) return { html: r.html, mode: 'project-llm', info: { ...info, provider: r.provider } };
    }
    // Fallback: structural scaffold
    return { html: syntheticHTML(info, entry, ctx), mode: 'project-scaffold', info };
  }
  throw new Error('No input provided. Send { html } / { files: {name:contents} } / { spec_md }');
}

module.exports = { extract, classify, findEntry, gatherContext, syntheticHTML, llmConvert, specToHTML, specScaffold };
