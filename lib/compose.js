// Stage 5 — COMPOSE · merge stripped HTML + upgrade layers into one sovereign file
// ◊·κ=1 · one file · one open · zero network

const { buildUpgrade } = require('./upgrade');

// Konomi licence stub — Ed25519 verification skeleton, 30-day trial
function generateLicence(toolName) {
  const id = (toolName || 'forge').toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
  const now = Date.now();
  const trialDays = 30;
  return {
    forge_id: id,
    key: null,
    trial_started: now,
    trial_expires: now + (trialDays * 24 * 60 * 60 * 1000),
    trial_days: trialDays
  };
}

function licenceBlock(lic) {
  return `<script id="forge-licence" type="application/json">${JSON.stringify(lic)}</script>`;
}

function ensureHtmlShell(html) {
  // If the user's upload was a fragment, wrap it in a minimal shell.
  if (!/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sovereign Tool</title></head><body>${html}</body></html>`;
  } else if (!/<!DOCTYPE/i.test(html)) {
    html = '<!DOCTYPE html>\n' + html;
  }
  // Ensure <head> exists
  if (!/<head[\s>]/i.test(html)) {
    html = html.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>');
  }
  // Ensure <body> exists
  if (!/<body[\s>]/i.test(html)) {
    html = html.replace(/<\/head>/i, '</head><body>');
    if (!/<\/body>/i.test(html)) html = html.replace(/<\/html>/i, '</body></html>');
  }
  return html;
}

function injectCss(html, css) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, css + '\n</head>');
  }
  return css + '\n' + html;
}

function injectJsAndOverlay(html, js, overlay) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, overlay + '\n' + js + '\n</body>');
  }
  return html + '\n' + overlay + '\n' + js;
}

function injectLicence(html, lic) {
  const block = licenceBlock(lic);
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, block + '\n</body>');
  }
  return html + '\n' + block;
}

function injectMeta(html, meta) {
  const tags = [
    `<meta name="forge:version" content="${meta.version}">`,
    `<meta name="forge:upgraded_at" content="${meta.upgraded_at}">`,
    `<meta name="forge:sovereignty" content="10">`,
    `<meta name="forge:layers" content="face,swarm,cascade,bloom,persist,skin,ass">`,
    `<!-- ◊·κ=1 — this file is sovereign · runs offline · stores nothing remotely · yours forever -->`
  ];
  const block = tags.join('\n');
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1>\n' + block);
  }
  return block + '\n' + html;
}

function compose(strippedHtml, options) {
  const opts = options || {};
  let html = ensureHtmlShell(strippedHtml);

  const upgrade = buildUpgrade({
    brand: opts.brand || {},
    agents: opts.agents || [],
    purpose: opts.purpose || 'general_tool',
    title: opts.title || 'Forge',
    providers: opts.providers || ['gemini', 'openai', 'anthropic'],
    namespace: opts.namespace || opts.title
  });

  const licence = generateLicence(opts.title || 'forge');

  html = injectMeta(html, { version: '1.0.0', upgraded_at: new Date().toISOString() });
  html = injectCss(html, upgrade.css);
  html = injectJsAndOverlay(html, upgrade.js, upgrade.overlay);
  html = injectLicence(html, licence);

  return { html, licence, layers_implemented: upgrade.layers_implemented };
}

module.exports = { compose, generateLicence, ensureHtmlShell };
