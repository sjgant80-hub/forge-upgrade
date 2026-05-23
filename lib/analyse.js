// Stage 1 — PARSE · Stage 2 — UNDERSTAND (deterministic core)
// ◊·κ=1 · read the HTML · extract structure · score sovereignty

// ── Framework signatures (header pattern → name) ──
const FRAMEWORK_SIGS = [
  { name: 'React',     re: /\b(React\.createElement|ReactDOM|__REACT_DEVTOOLS|react(-dom)?\.production)/i },
  { name: 'Vue',       re: /\b(new Vue|Vue\.createApp|__VUE__|vue\.global)/i },
  { name: 'Angular',   re: /\b(@angular|ng-controller|ngModel|platformBrowserDynamic)/i },
  { name: 'Svelte',    re: /\b(svelte\/internal|__svelte)/i },
  { name: 'jQuery',    re: /(\$\(document\)\.ready|\$\(function\s*\(\)|jQuery\(|jquery\.min\.js|\/jquery@?[\d.]+)/i },
  { name: 'Bootstrap', re: /\b(bootstrap(\.min)?\.(css|js)|class="btn btn-|data-bs-toggle|data-toggle="modal")/i },
  { name: 'Tailwind',  re: /(tailwindcss|tailwind\.config|\bclass="[^"]*(flex|grid|p-\d|m-\d|text-\w+-\d{3})\b)/i },
  { name: 'Alpine',    re: /\bx-data=|\balpinejs/i },
  { name: 'htmx',      re: /\bhx-(get|post|put|delete|target|swap)=/i },
  { name: 'Lodash',    re: /\b(_\.(map|filter|reduce|debounce|throttle)|lodash(\.min)?\.js)/i },
  { name: 'Moment.js', re: /\bmoment\(|moment(\.min)?\.js/i },
  { name: 'Axios',     re: /\baxios\.(get|post|put|delete)|axios(\.min)?\.js/i },
  { name: 'D3',        re: /\bd3\.(select|scale|axis)|d3(\.min)?\.js/i },
  { name: 'Chart.js',  re: /\bnew Chart\(|chart(\.min)?\.js/i },
  { name: 'Three.js',  re: /\bTHREE\.|three(\.min)?\.js/i },
  { name: 'Font Awesome', re: /\bfontawesome|fa-(solid|regular|brands)/i }
];

// ── Feature detection (UI/logic patterns → feature name → suggested agent) ──
const FEATURE_PATTERNS = [
  { feature: 'data_entry',    agent: 'alpha',   re: /<(input|textarea|select)\b[^>]*>/i },
  { feature: 'forms',         agent: 'alpha',   re: /<form\b/i },
  { feature: 'search',        agent: 'alpha',   re: /type=["']search|placeholder=["'][^"']*search/i },
  { feature: 'content_create', agent: 'beta',   re: /contenteditable|<textarea\b[^>]*rows=["']?[5-9]|rich.?text/i },
  { feature: 'scheduling',    agent: 'gamma',   re: /type=["']date|type=["']time|datetime-local|calendar|schedule|appointment/i },
  { feature: 'reporting',     agent: 'delta',   re: /<canvas\b|chart|graph|dashboard|report|analytics|metric/i },
  { feature: 'tables',        agent: 'delta',   re: /<table\b/i },
  { feature: 'writing',       agent: 'epsilon', re: /<article\b|<blog|<\/?h[1-3]>/i },
  { feature: 'sharing',       agent: 'zeta',    re: /share|export|download|copy.?to.?clipboard/i },
  { feature: 'performance',   agent: 'eta',     re: /optimi[sz]e|performance|score|rating/i },
  { feature: 'sales',         agent: 'theta',   re: /buy|cart|checkout|pricing|subscribe|sign.?up|cta/i },
  { feature: 'auth',          agent: null,      re: /login|signin|sign.?in|password|oauth/i }, // limitation
  { feature: 'realtime',      agent: null,      re: /websocket|socket\.io|new WebSocket|ws:\/\//i }, // limitation
  { feature: 'spa_routing',   agent: null,      re: /history\.pushState|react-router|vue-router/i }
];

// ── Storage detection ──
const STORAGE_PATTERNS = [
  { name: 'localStorage',  re: /\blocalStorage\.(getItem|setItem|removeItem)/ },
  { name: 'sessionStorage', re: /\bsessionStorage\./ },
  { name: 'IndexedDB',     re: /\bindexedDB\.open\(/ },
  { name: 'cookies',       re: /document\.cookie/ },
  { name: 'server_api',    re: /\b(fetch|axios|XMLHttpRequest)\b/ }
];

function extractTags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push({ open: m[0].slice(0, m[0].indexOf('>') + 1), content: m[1], full: m[0] });
  return out;
}

function extractAttr(openTag, attr) {
  const m = openTag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function detectFrameworks(html) {
  const hits = [];
  for (const sig of FRAMEWORK_SIGS) {
    if (sig.re.test(html)) {
      const versionMatch = html.match(new RegExp(`${sig.name.toLowerCase().replace('.', '\\.')}[@\\-/](\\d+\\.\\d+(\\.\\d+)?)`, 'i'));
      hits.push({ name: sig.name, version: versionMatch ? versionMatch[1] : null });
    }
  }
  return hits;
}

function detectFeatures(html) {
  const features = [];
  const limitations = [];
  for (const p of FEATURE_PATTERNS) {
    if (p.re.test(html)) {
      if (p.agent) features.push({ feature: p.feature, suggested_agent: p.agent });
      else limitations.push(p.feature);
    }
  }
  return { features, limitations };
}

function detectStorage(html) {
  const found = [];
  for (const p of STORAGE_PATTERNS) {
    if (p.re.test(html)) found.push(p.name);
  }
  return found;
}

function detectExternalScripts(html) {
  const scripts = [];
  const links = [];
  const scriptTags = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi);
  for (const m of scriptTags) {
    const src = m[1];
    const isExternal = /^(https?:)?\/\//.test(src);
    scripts.push({ src, external: isExternal, full: m[0] });
  }
  const linkTags = html.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi);
  for (const m of linkTags) {
    const href = m[1];
    const rel = (m[0].match(/rel\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const isExternal = /^(https?:)?\/\//.test(href);
    links.push({ href, rel, external: isExternal, full: m[0] });
  }
  return { scripts, links };
}

function detectApiCalls(html) {
  const endpoints = new Set();
  const patterns = [
    /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /axios\.(?:get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /\.open\s*\(\s*["'`](?:GET|POST|PUT|DELETE)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,
    /\$\.(?:get|post|ajax)\s*\(\s*["'`]([^"'`]+)["'`]/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      if (url.length > 1 && !url.startsWith('data:') && !url.startsWith('#')) endpoints.add(url);
    }
  }
  return [...endpoints];
}

function detectPurpose(html, features) {
  const featureSet = new Set(features.map(f => f.feature));
  const lower = html.toLowerCase();
  if (featureSet.has('reporting') && featureSet.has('tables')) return 'dashboard';
  if (featureSet.has('forms') && featureSet.has('data_entry') && (lower.includes('contact') || lower.includes('lead'))) return 'crm';
  if (featureSet.has('sales')) return 'landing_or_commerce';
  if (featureSet.has('scheduling')) return 'scheduler';
  if (featureSet.has('content_create')) return 'editor_or_cms';
  if (featureSet.has('reporting')) return 'analytics';
  if (featureSet.has('forms')) return 'form_tool';
  if (featureSet.has('search')) return 'search_tool';
  return 'general_tool';
}

function scoreComplexity(stats) {
  // 1-10 — based on size, framework count, api dependence, dynamism
  let s = 1;
  if (stats.size_bytes > 50000) s += 1;
  if (stats.size_bytes > 200000) s += 1;
  if (stats.frameworks.length >= 1) s += 1;
  if (stats.frameworks.length >= 3) s += 1;
  if (stats.external_scripts > 3) s += 1;
  if (stats.external_links > 3) s += 1;
  if (stats.api_calls > 0) s += 1;
  if (stats.api_calls > 5) s += 1;
  if (stats.limitations.length > 0) s += 1;
  return Math.min(10, s);
}

function scoreSovereignty(stats) {
  // 10 = already sovereign · 0 = fully dependent
  let s = 10;
  s -= stats.external_scripts;
  s -= stats.external_links;
  s -= stats.frameworks.length;
  if (stats.api_calls > 0) s -= 2;
  if (stats.storage.includes('server_api') && !stats.storage.includes('localStorage') && !stats.storage.includes('IndexedDB')) s -= 2;
  if (stats.limitations.includes('realtime')) s -= 3;
  if (stats.limitations.includes('auth')) s -= 2;
  return Math.max(0, Math.min(10, s));
}

function suggestAgents(features) {
  const agents = new Set();
  for (const f of features) if (f.suggested_agent) agents.add(f.suggested_agent);
  return [...agents];
}

function detectTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : 'Untitled';
}

// ── Master analyse function ──
function analyse(html) {
  const title = detectTitle(html);
  const frameworks = detectFrameworks(html);
  const { features, limitations } = detectFeatures(html);
  const storage = detectStorage(html);
  const { scripts, links } = detectExternalScripts(html);
  const apiCalls = detectApiCalls(html);
  const externalScripts = scripts.filter(s => s.external);
  const externalLinks = links.filter(l => l.external);
  const purpose = detectPurpose(html, features);
  const suggestedAgents = suggestAgents(features);

  const stats = {
    size_bytes: Buffer.byteLength(html, 'utf8'),
    frameworks,
    external_scripts: externalScripts.length,
    external_links: externalLinks.length,
    api_calls: apiCalls.length,
    storage,
    limitations
  };

  const complexity = scoreComplexity(stats);
  const sovereignty = scoreSovereignty(stats);

  const upgradePlan = [];
  if (externalScripts.length) upgradePlan.push(`strip ${externalScripts.length} external script(s) — inline or replace with vanilla`);
  if (externalLinks.length) upgradePlan.push(`inline ${externalLinks.length} external stylesheet/font link(s)`);
  for (const f of frameworks) upgradePlan.push(`replace ${f.name}${f.version ? ' ' + f.version : ''} with vanilla equivalent`);
  if (apiCalls.length) upgradePlan.push(`replace ${apiCalls.length} server API call(s) with T0 offline fallback + optional T3 cascade`);
  if (!storage.includes('localStorage') && !storage.includes('IndexedDB')) upgradePlan.push('add L5 PERSIST — localStorage + IndexedDB');
  upgradePlan.push(`add L2 SWARM — ${suggestedAgents.length || 3} agents (${suggestedAgents.join(', ') || 'orchestrator + analyst + drafter'}) + Ω orchestrator`);
  upgradePlan.push('add L3 CASCADE — T0 offline echo + T3 provider cascade');
  upgradePlan.push('add L4 BLOOM — 7-ring intent router');
  upgradePlan.push('add L6 SKIN — CSS variables, dark/light, mobile-first');
  upgradePlan.push('add L7 ASS — lifecycle state machine + empty states');
  upgradePlan.push('Konomi licence hook — Ed25519, 30-day trial');

  return {
    detected_purpose: purpose,
    detected_title: title,
    detected_features: features.map(f => f.feature),
    suggested_agents: suggestedAgents,
    detected_frameworks: frameworks,
    detected_dependencies: [
      ...externalScripts.map(s => ({ type: 'script', url: s.src })),
      ...externalLinks.map(l => ({ type: l.rel || 'link', url: l.href }))
    ],
    detected_api_calls: apiCalls,
    detected_storage: storage,
    limitations,
    complexity_score: complexity,
    sovereignty_score: sovereignty,
    upgrade_plan: upgradePlan,
    stats: {
      size_bytes: stats.size_bytes,
      size_kb: Math.round(stats.size_bytes / 1024),
      total_scripts: scripts.length,
      total_links: links.length
    }
  };
}

module.exports = { analyse, extractTags, extractAttr, detectFrameworks, detectFeatures, detectStorage, detectExternalScripts, detectApiCalls, detectTitle };
