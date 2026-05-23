// Stage 3 — STRIP · remove external dependencies, replace with vanilla
// ◊·κ=1 · honest about what could and couldn't be converted

// External CDN/host patterns considered "framework deliveries"
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'cdn.skypack.dev',
  'esm.sh',
  'esm.run',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.fontawesome.com',
  'maxcdn.bootstrapcdn.com',
  'stackpath.bootstrapcdn.com',
  'code.jquery.com',
  'ajax.googleapis.com',
  'cdn.tailwindcss.com'
];

function isCdn(url) {
  return CDN_HOSTS.some(h => url.includes(h));
}

function isExternal(url) {
  return /^(https?:)?\/\//.test(url);
}

// ── jQuery to vanilla substitutions ──
// Best-effort common-case rewrites. Unknown patterns flagged for manual review.
const JQUERY_REWRITES = [
  // $(document).ready(fn)  →  document.addEventListener('DOMContentLoaded', fn)
  { re: /\$\(document\)\.ready\(\s*function\s*\(\s*\)\s*\{/g, to: "document.addEventListener('DOMContentLoaded', function() {" },
  { re: /\$\(function\s*\(\s*\)\s*\{/g, to: "document.addEventListener('DOMContentLoaded', function() {" },
  // $('#id')  →  document.getElementById('id') / querySelector
  { re: /\$\(\s*["'](#[a-zA-Z][\w-]*)["']\s*\)/g, to: 'document.querySelector("$1")' },
  { re: /\$\(\s*["'](\.[\w-]+)["']\s*\)/g, to: 'document.querySelectorAll("$1")' },
  { re: /\$\(\s*["']([a-zA-Z][\w-]*)["']\s*\)/g, to: 'document.querySelectorAll("$1")' },
  // .on('click', fn)  →  .addEventListener('click', fn)
  { re: /\.on\(\s*["'](\w+)["']\s*,\s*/g, to: '.addEventListener("$1", ' },
  // .click(fn) → .addEventListener('click', fn)  (only when used as a handler)
  { re: /\.click\(\s*function/g, to: '.addEventListener("click", function' },
  // .val()  →  .value
  { re: /\.val\(\)/g, to: '.value' },
  // .val(x) → .value = x  (function-call form — best effort)
  { re: /\.val\(\s*([^)]+)\s*\)/g, to: '.value = $1' },
  // .text(x)  → .textContent = x
  { re: /\.text\(\s*([^)]+)\s*\)/g, to: '.textContent = $1' },
  // .html(x) → .innerHTML = x
  { re: /\.html\(\s*([^)]+)\s*\)/g, to: '.innerHTML = $1' },
  // .hide() / .show() → style.display
  { re: /\.hide\(\)/g, to: '.style.display = "none"' },
  { re: /\.show\(\)/g, to: '.style.display = ""' },
  // .addClass / .removeClass / .toggleClass
  { re: /\.addClass\(\s*["']([^"']+)["']\s*\)/g, to: '.classList.add("$1")' },
  { re: /\.removeClass\(\s*["']([^"']+)["']\s*\)/g, to: '.classList.remove("$1")' },
  { re: /\.toggleClass\(\s*["']([^"']+)["']\s*\)/g, to: '.classList.toggle("$1")' },
  // .attr('name', val) → .setAttribute('name', val) — best effort one-arg get omitted
  { re: /\.attr\(\s*["']([^"']+)["']\s*,\s*([^)]+)\s*\)/g, to: '.setAttribute("$1", $2)' },
  // $.ajax / $.get / $.post → fetch  (very rough — flagged)
  { re: /\$\.ajax\s*\(/g, to: '/* TODO: replaced $.ajax → fetch */ fetch(' },
  { re: /\$\.get\s*\(\s*["']([^"']+)["']/g, to: 'fetch("$1")' },
  { re: /\$\.post\s*\(\s*["']([^"']+)["']\s*,\s*/g, to: 'fetch("$1", { method: "POST", body: ' }
];

function rewriteJquery(js) {
  let out = js;
  let touched = 0;
  for (const r of JQUERY_REWRITES) {
    const before = out;
    out = out.replace(r.re, r.to);
    if (out !== before) touched++;
  }
  return { code: out, touched };
}

// ── Remove external <script src=> and <link href=> tags ──
function removeExternalRefs(html) {
  const removed = [];

  // External scripts — drop the entire tag (we'll re-inject vanilla equivalents)
  html = html.replace(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src) => {
    if (isExternal(src)) {
      removed.push({ type: 'script', url: src, cdn: isCdn(src) });
      return `<!-- forge-stripped script: ${src} -->`;
    }
    return match;
  });

  // External stylesheets — drop, replaced by inlined system fonts + custom CSS
  html = html.replace(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/gi, (match, href) => {
    const rel = (match.match(/rel\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    if (isExternal(href) && /stylesheet|preconnect|preload|dns-prefetch/i.test(rel)) {
      removed.push({ type: rel || 'link', url: href, cdn: isCdn(href) });
      return `<!-- forge-stripped link[${rel}]: ${href} -->`;
    }
    return match;
  });

  // Tracking pixels / analytics
  html = html.replace(/<script\b[^>]*\b(googletagmanager|google-analytics|gtag|fbq|hotjar|mixpanel|segment|amplitude)[^<]*<\/script>/gi, (match) => {
    removed.push({ type: 'tracking', url: 'inline', cdn: false });
    return '<!-- forge-stripped tracking -->';
  });

  return { html, removed };
}

// ── Detect and report inline jQuery usage ──
function processInlineScripts(html) {
  let touchedBlocks = 0;
  const out = html.replace(/<script(\b(?!.*\bsrc=)[^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, code) => {
    if (!/\$\(|jQuery\(|\.on\(|\.val\(|\.html\(|\.text\(/.test(code)) return match;
    const { code: rewritten, touched } = rewriteJquery(code);
    if (touched > 0) touchedBlocks++;
    return `<script${attrs}>${rewritten}</script>`;
  });
  return { html: out, blocks_touched: touchedBlocks };
}

// ── Master strip ──
function strip(html) {
  const changes = [];

  const removedResult = removeExternalRefs(html);
  html = removedResult.html;
  for (const r of removedResult.removed) {
    changes.push(`stripped ${r.type}: ${r.url}${r.cdn ? ' (CDN)' : ''}`);
  }

  const inlineResult = processInlineScripts(html);
  html = inlineResult.html;
  if (inlineResult.blocks_touched > 0) {
    changes.push(`rewrote jQuery → vanilla in ${inlineResult.blocks_touched} inline script block(s)`);
  }

  // Strip noscript fallbacks for analytics, etc.
  html = html.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, (match, inner) => {
    if (/googletag|analytics|pixel/i.test(inner)) {
      changes.push('stripped noscript analytics fallback');
      return '';
    }
    return match;
  });

  // Strip integrity/crossorigin attrs on now-removed assets (best-effort cleanup)
  html = html.replace(/\s+(integrity|crossorigin|referrerpolicy)\s*=\s*["'][^"']*["']/gi, '');

  return { html, changes };
}

module.exports = { strip, removeExternalRefs, processInlineScripts, rewriteJquery, isCdn, isExternal };
