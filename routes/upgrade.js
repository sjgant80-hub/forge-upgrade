// POST /v1/upgrade — full 5-stage pipeline + multi-input router
// POST /v1/upgrade/analyse — read-only (parse + understand)
// ◊·κ=1 · upload anything · download sovereign

const { json } = require('../lib/http');
const { analyse } = require('../lib/analyse');
const { strip } = require('../lib/strip');
const { compose } = require('../lib/compose');
const { extract } = require('../lib/extract');
const { extractAll } = require('../lib/unzip');
const { askLLM, askJSON, hasAnyProvider } = require('../lib/llm');

const MAX_HTML_BYTES = 5 * 1024 * 1024;       // 5 MB per HTML
const MAX_ZIP_BYTES  = 20 * 1024 * 1024;      // 20 MB per ZIP
const MAX_SPEC_BYTES = 500 * 1024;            // 500 KB per .md spec

async function fetchUrl(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
  const r = await fetch(url, {
    headers: { 'User-Agent': 'forge-upgrade/1.0 (+sovereign)' },
    redirect: 'follow'
  });
  if (!r.ok) throw new Error(`URL fetch failed: ${r.status}`);
  const text = await r.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_HTML_BYTES) {
    throw new Error(`Fetched HTML exceeds ${MAX_HTML_BYTES} bytes`);
  }
  return text;
}

function decodeMaybeBase64(raw, fallbackToRaw = true) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  // Heuristic: looks like base64 (no angle brackets, only base64 chars)
  if (!raw.includes('<') && /^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 200))) {
    try { return Buffer.from(raw.replace(/\s/g, ''), 'base64'); }
    catch {}
  }
  return fallbackToRaw ? Buffer.from(raw, 'utf8') : null;
}

// Stage 2 — LLM-driven refinement of the deterministic analysis
async function understand(deterministic, originalHtml) {
  if (!hasAnyProvider()) return { ...deterministic, understanding_source: 'deterministic' };
  const system = `You analyse HTML tools and propose v18 sovereign-architecture upgrades. v18 = 7 layers (FACE, SWARM, CASCADE, BLOOM, PERSIST, SKIN, ASS). Agents: alpha(research) beta(compose) gamma(sequence) delta(analyse) epsilon(write) zeta(distribute) eta(optimise) theta(target). Reply with JSON only.`;
  const user = `Analysis so far:
${JSON.stringify(deterministic, null, 2)}

Source HTML (first 4000 chars):
${originalHtml.slice(0, 4000)}

Return JSON:
{
  "refined_purpose": "...",
  "core_functionality": "1 sentence — strip decoration",
  "recommended_agents": ["alpha","beta",...],
  "agent_rationale": "why these agents",
  "additional_limitations": ["..."],
  "additional_upgrade_steps": ["..."]
}`;
  try {
    const r = await askJSON(system, user);
    if (r && r.parsed) {
      return {
        ...deterministic,
        understanding_source: r.provider,
        refined_purpose: r.parsed.refined_purpose || deterministic.detected_purpose,
        core_functionality: r.parsed.core_functionality,
        recommended_agents: r.parsed.recommended_agents || deterministic.suggested_agents,
        agent_rationale: r.parsed.agent_rationale,
        limitations: [...(deterministic.limitations || []), ...(r.parsed.additional_limitations || [])],
        upgrade_plan: [...(deterministic.upgrade_plan || []), ...(r.parsed.additional_upgrade_steps || [])]
      };
    }
  } catch (err) {
    console.warn('understand stage LLM error:', err.message);
  }
  return { ...deterministic, understanding_source: 'deterministic' };
}

// ── INPUT ROUTER ──
// Accepts:
//   { html: "<...>"               }   raw HTML string
//   { html_base64: "..."          }   base64 HTML
//   { url: "https://..."          }   fetch HTML from URL
//   { zip_base64: "..."           }   base64 ZIP archive
//   { files: { "path": "content" }}   pre-extracted file dict
//   { spec_md: "..."              }   markdown spec → build from spec
// Returns: { html, mode, info, originalHtml }
async function routeInput(body) {
  // ZIP — Replit / Lovable / project bundle
  if (body.zip_base64) {
    const buf = Buffer.from(body.zip_base64.replace(/\s/g, ''), 'base64');
    if (buf.length > MAX_ZIP_BYTES) throw new Error(`ZIP exceeds ${MAX_ZIP_BYTES} bytes`);
    const { files, count, skipped, total_bytes } = extractAll(buf);
    const result = await extract({ files }, { askLLM });
    return { ...result, originalHtml: result.html, zip_meta: { count, skipped, total_bytes } };
  }
  if (body.files && typeof body.files === 'object') {
    const result = await extract({ files: body.files }, { askLLM });
    return { ...result, originalHtml: result.html };
  }
  // Spec
  if (body.spec_md) {
    if (Buffer.byteLength(body.spec_md, 'utf8') > MAX_SPEC_BYTES) throw new Error(`Spec exceeds ${MAX_SPEC_BYTES} bytes`);
    const result = await extract({ spec_md: body.spec_md }, { askLLM });
    return { ...result, originalHtml: result.html };
  }
  // HTML (raw / base64 / URL)
  let inputHtml = null;
  if (body.html) inputHtml = body.html;
  else if (body.html_base64) {
    const decoded = decodeMaybeBase64(body.html_base64, false);
    if (decoded) inputHtml = decoded.toString('utf8');
  }
  if (!inputHtml && body.url) inputHtml = await fetchUrl(body.url);
  if (inputHtml) {
    if (Buffer.byteLength(inputHtml, 'utf8') > MAX_HTML_BYTES) throw new Error(`HTML exceeds ${MAX_HTML_BYTES} bytes`);
    return { html: inputHtml, mode: 'html-direct', info: { type: 'static-html', file_count: 1 }, originalHtml: inputHtml };
  }
  throw new Error('No input. Send one of: { html } | { html_base64 } | { url } | { zip_base64 } | { files: {name: content} } | { spec_md }');
}

async function handleUpgrade(req, res, body, options) {
  const startTime = Date.now();
  const mode = (options && options.mode) || 'full';

  try {
    // ── Stage 0 — INPUT ROUTING ──
    const routed = await routeInput(body);
    const inputHtml = routed.html;

    // ── Stage 1 — PARSE ──
    const parsed = analyse(inputHtml);
    parsed.input_mode = routed.mode;
    parsed.input_info = routed.info;
    if (routed.zip_meta) parsed.zip_meta = routed.zip_meta;

    // ── Stage 2 — UNDERSTAND ──
    const understanding = await understand(parsed, inputHtml);

    if (mode === 'analyse') {
      return json(res, {
        original_analysis: understanding,
        time_ms: Date.now() - startTime
      });
    }

    // ── Stage 3 — STRIP ──
    const stripped = strip(inputHtml);

    // ── Stage 4 + 5 — UPGRADE + COMPOSE ──
    const opts = body.options || {};
    const composed = compose(stripped.html, {
      brand: opts.brand || {},
      agents: opts.agents?.list || understanding.recommended_agents || understanding.suggested_agents || ['alpha', 'beta', 'delta'],
      purpose: understanding.refined_purpose || understanding.detected_purpose,
      title: opts.brand?.logo_text || understanding.detected_title || 'Sovereign Tool',
      providers: opts.cascade?.t3_providers || ['gemini', 'openai', 'anthropic'],
      namespace: opts.brand?.logo_text || understanding.detected_title || 'forge'
    });

    const outputBytes = Buffer.byteLength(composed.html, 'utf8');
    const outputBase64 = Buffer.from(composed.html).toString('base64');
    const filename = (understanding.detected_title || 'tool').toLowerCase().replace(/[^a-z0-9]/g, '-') + '-sovereign.html';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const changesMade = [];
    if (routed.mode !== 'html-direct') {
      changesMade.push(`input mode: ${routed.mode} (${routed.info.type})`);
      if (routed.info.provider) changesMade.push(`LLM provider used: ${routed.info.provider}`);
      if (routed.zip_meta) changesMade.push(`extracted ${routed.zip_meta.count} files from ZIP (${Math.round(routed.zip_meta.total_bytes / 1024)} KB)`);
    }
    changesMade.push(...stripped.changes);
    changesMade.push(...understanding.upgrade_plan.filter(step => !step.startsWith('strip') && !step.startsWith('inline ')));
    changesMade.push(`wrote ${Math.round(outputBytes / 1024)} KB sovereign HTML`);

    return json(res, {
      original_analysis: understanding,
      upgraded_file: outputBase64,
      filename,
      size_kb: Math.round(outputBytes / 1024),
      size_bytes: outputBytes,
      changes_made: changesMade,
      layers_implemented: composed.layers_implemented,
      licence: composed.licence,
      input_mode: routed.mode,
      time_seconds: parseFloat(elapsed),
      download_instructions: 'Decode base64 upgraded_file → save as .html → open in Chrome → ◊ sovereign'
    }, 200, { 'X-RapidAPI-Billing': 'Forges=1' });

  } catch (err) {
    console.error('Upgrade error:', err);
    return json(res, { error: err.message || 'Upgrade failed' }, 500);
  }
}

module.exports = { handleUpgrade, routeInput };
