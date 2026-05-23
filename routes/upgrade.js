// POST /v1/upgrade — full 5-stage pipeline
// POST /v1/upgrade/analyse — read-only (Stage 1+2 only)
// ◊·κ=1 · upload dependent · download sovereign

const { json } = require('../lib/http');
const { analyse } = require('../lib/analyse');
const { strip } = require('../lib/strip');
const { compose } = require('../lib/compose');
const { askJSON, hasAnyProvider } = require('../lib/llm');

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB ceiling on processable HTML

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

function decodeHtmlInput(body) {
  if (body.html_base64 || body.html) {
    const raw = body.html_base64 || body.html;
    try {
      // Heuristic: if it looks like base64 (no <), decode it. Otherwise treat as raw.
      if (!raw.includes('<') && /^[A-Za-z0-9+/=\s]+$/.test(raw)) {
        return Buffer.from(raw, 'base64').toString('utf8');
      }
      return raw;
    } catch {
      return raw;
    }
  }
  return null;
}

// LLM-driven Stage 2 — refines deterministic analysis with role mapping + better upgrade plan
async function understand(deterministic, originalHtml) {
  if (!hasAnyProvider()) {
    return { ...deterministic, understanding_source: 'deterministic' };
  }
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

async function handleUpgrade(req, res, body, options) {
  const startTime = Date.now();
  const mode = (options && options.mode) || 'full';

  try {
    // ── Stage 0 — INPUT ──
    let inputHtml = decodeHtmlInput(body);
    if (!inputHtml && body.url) {
      inputHtml = await fetchUrl(body.url);
    }
    if (!inputHtml) {
      return json(res, {
        error: 'Provide either { html: "<...>" } / { html_base64: "..." } / { url: "https://..." }'
      }, 400);
    }
    if (Buffer.byteLength(inputHtml, 'utf8') > MAX_HTML_BYTES) {
      return json(res, { error: `HTML exceeds max size (${MAX_HTML_BYTES} bytes)` }, 413);
    }

    // ── Stage 1 — PARSE (deterministic) ──
    const parsed = analyse(inputHtml);

    // ── Stage 2 — UNDERSTAND (LLM if available) ──
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

    const changesMade = [
      ...stripped.changes,
      ...understanding.upgrade_plan.filter(step => !step.startsWith('strip') && !step.startsWith('inline ')),
      `wrote ${Math.round(outputBytes / 1024)} KB sovereign HTML`
    ];

    return json(res, {
      original_analysis: understanding,
      upgraded_file: outputBase64,
      filename,
      size_kb: Math.round(outputBytes / 1024),
      size_bytes: outputBytes,
      changes_made: changesMade,
      layers_implemented: composed.layers_implemented,
      licence: composed.licence,
      time_seconds: parseFloat(elapsed),
      download_instructions: 'Decode base64 upgraded_file → save as .html → open in Chrome → ◊ sovereign'
    }, 200, { 'X-RapidAPI-Billing': 'Forges=1' });

  } catch (err) {
    console.error('Upgrade error:', err);
    return json(res, { error: err.message || 'Upgrade failed' }, 500);
  }
}

module.exports = { handleUpgrade };
