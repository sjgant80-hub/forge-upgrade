// Stage 4 — UPGRADE · inject the 7 v18 layers
// ◊·κ=1 · seven harmonics · each layer self-contained · together they sing

// ── Agent role library (α-θ + Ω) ──
const AGENTS = {
  alpha:   { id: 'α', role: 'research',  job: 'smart field completion, validation, search enhancement' },
  beta:    { id: 'β', role: 'compose',   job: 'drafting, templates, content generation' },
  gamma:   { id: 'γ', role: 'sequence',  job: 'planning, reminders, cadence, scheduling' },
  delta:   { id: 'δ', role: 'analyse',   job: 'insights, scoring, trend detection, reporting' },
  epsilon: { id: 'ε', role: 'write',     job: 'long-form, tone matching, explanation' },
  zeta:    { id: 'ζ', role: 'distribute', job: 'platform-specific formatting, sharing, export' },
  eta:     { id: 'η', role: 'optimise',  job: 'recommendations, refinement, performance' },
  theta:   { id: 'θ', role: 'target',    job: 'closing, urgency, conversion, personalisation' }
};

// ── L6 SKIN — CSS variables, dark/light, mobile-first ──
function layerSkin(brand) {
  const primary = brand.primary_color || '#10B981';
  const accent = brand.accent_color || '#3B82F6';
  const fontH = brand.font_heading || "'Inter', system-ui, sans-serif";
  const fontB = brand.font_body || "'Inter', system-ui, sans-serif";
  return `<style id="forge-skin">
:root{
  --forge-primary:${primary};--forge-accent:${accent};
  --forge-bg:#FAFBFC;--forge-surface:#FFFFFF;--forge-surface-2:#F3F4F6;
  --forge-ink:#1F2937;--forge-ink-2:#4B5563;--forge-muted:#9CA3AF;
  --forge-border:#E5E7EB;--forge-shadow:0 1px 3px rgba(0,0,0,0.08);
  --forge-radius:10px;--forge-font-h:${fontH};--forge-font-b:${fontB};
}
[data-theme="dark"]{
  --forge-bg:#111827;--forge-surface:#1F2937;--forge-surface-2:#374151;
  --forge-ink:#F9FAFB;--forge-ink-2:#D1D5DB;--forge-muted:#6B7280;
  --forge-border:#374151;--forge-shadow:0 1px 3px rgba(0,0,0,0.3);
}
.forge-overlay{
  position:fixed;bottom:16px;right:16px;z-index:99999;
  background:var(--forge-surface);color:var(--forge-ink);
  border:1px solid var(--forge-border);border-radius:var(--forge-radius);
  padding:8px 12px;font:13px/1.4 var(--forge-font-b);
  box-shadow:var(--forge-shadow);display:flex;gap:8px;align-items:center;
}
.forge-overlay button{
  background:transparent;border:1px solid var(--forge-border);
  color:var(--forge-ink-2);padding:4px 10px;border-radius:6px;cursor:pointer;
  font:inherit;
}
.forge-overlay button:hover{background:var(--forge-surface-2)}
.forge-overlay .forge-dot{
  width:8px;height:8px;border-radius:50%;background:var(--forge-primary);
  box-shadow:0 0 0 0 var(--forge-primary);animation:forge-pulse 2s infinite;
}
@keyframes forge-pulse{
  0%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)}
  70%{box-shadow:0 0 0 10px rgba(16,185,129,0)}
  100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}
}
@media(max-width:640px){.forge-overlay{bottom:8px;right:8px;left:8px;justify-content:center}}
</style>`;
}

// ── L1 FACE — multi-view marker (additive, non-breaking) ──
function layerFace() {
  return `
// L1 FACE — declare canonical view ID for the host content
__forge.face = { default: 'host', views: ['host', 'forge-panel'] };
__forge.currentView = 'host';
__forge.switchView = function(id) {
  __forge.currentView = id;
  document.dispatchEvent(new CustomEvent('forge:view', { detail: { view: id } }));
};`;
}

// ── L2 SWARM — Ω orchestrator + selected agents ──
function layerSwarm(agentIds, purpose) {
  const selected = (agentIds && agentIds.length) ? agentIds : ['alpha', 'beta', 'delta'];
  const agentMap = {};
  for (const id of selected) {
    if (AGENTS[id]) agentMap[id] = AGENTS[id];
  }
  return `
// L2 SWARM — Ω orchestrator + ${selected.length} specialist agents
__forge.agents = ${JSON.stringify(agentMap, null, 2)};
__forge.omega = {
  id: 'Ω',
  role: 'orchestrator',
  job: 'route user intent to the right agent based on bloom ring',
  purpose: ${JSON.stringify(purpose || 'general_tool')}
};
__forge.routeToAgent = function(query, ring) {
  // simple ring → agent map (overridable)
  const map = { 0:'alpha', 1:'alpha', 2:'delta', 3:'epsilon', 4:'beta', 5:'delta', 6:'eta' };
  const agentId = map[ring] || Object.keys(__forge.agents)[0];
  return { agent: agentId, ring, query };
};`;
}

// ── L4 BLOOM — 7-ring intent router ──
function layerBloom() {
  return `
// L4 BLOOM — 7-ring intent classifier
__forge.bloom = function(query) {
  if (!query || typeof query !== 'string') return 0;
  const q = query.toLowerCase();
  // R6 watcher — systemic/patterns
  if (/pattern|trend|overall|across|all|systemic|history/.test(q)) return 6;
  // R5 mirror — review/self-check
  if (/review|check|verify|did i|should i|correct/.test(q)) return 5;
  // R4 voice — generate/draft
  if (/write|draft|generate|create|compose|make/.test(q)) return 4;
  // R3 heart — emotional/help
  if (/help|stuck|confused|worried|scared|frustrat/.test(q)) return 3;
  // R2 gate — evaluate/filter
  if (/which|best|filter|choose|decide|evaluate/.test(q)) return 2;
  // R1 signal — search/find
  if (/find|search|where|look|locate/.test(q)) return 1;
  // R0 ground — basic info
  return 0;
};`;
}

// ── L3 CASCADE — T0 echo + T3 provider cascade ──
function layerCascade(providers) {
  const t3 = providers && providers.length ? providers : ['gemini', 'openai', 'anthropic'];
  return `
// L3 CASCADE — T0 always works · T3 providers: ${t3.join(' → ')}
__forge.cascade = {
  t0: function(query, ring) {
    // Deterministic offline echo — never fails
    const responses = {
      0: 'Working at ground level. What's the basic question?',
      1: 'Searching local data for: ' + query,
      2: 'Filtering options. Be more specific to narrow down.',
      3: 'You're not stuck. You're between steps. What's the next concrete action?',
      4: 'Drafting locally. (Connect an AI provider for richer output.)',
      5: 'Self-check: did the previous step produce what you needed?',
      6: 'Looking at the whole pattern. Connect an AI provider for deeper analysis.'
    };
    return { text: responses[ring] || responses[0], tier: 'T0', provider: 'offline' };
  },
  t3: async function(query, ring, opts) {
    const key = __forge.persist.get('llm_key');
    const provider = __forge.persist.get('llm_provider') || 'openai';
    if (!key) return __forge.cascade.t0(query, ring);
    try {
      const endpoints = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', auth: 'Bearer' },
        groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', auth: 'Bearer' },
        gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key, auth: null },
        anthropic: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', auth: 'x-api-key' }
      };
      const cfg = endpoints[provider] || endpoints.openai;
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.auth === 'Bearer') headers['Authorization'] = 'Bearer ' + key;
      if (cfg.auth === 'x-api-key') { headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01'; headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
      const body = provider === 'gemini'
        ? { contents: [{ parts: [{ text: query }] }] }
        : provider === 'anthropic'
        ? { model: cfg.model, max_tokens: 1024, messages: [{ role: 'user', content: query }] }
        : { model: cfg.model, messages: [{ role: 'user', content: query }] };
      const r = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('provider ' + r.status);
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content
        || j.content?.[0]?.text
        || j.candidates?.[0]?.content?.parts?.[0]?.text
        || 'No response';
      return { text, tier: 'T3', provider };
    } catch (err) {
      return Object.assign(__forge.cascade.t0(query, ring), { error: err.message, degraded_to: 'T0' });
    }
  },
  ask: async function(query) {
    const ring = __forge.bloom(query);
    const useT3 = !!__forge.persist.get('llm_key');
    return useT3 ? __forge.cascade.t3(query, ring) : __forge.cascade.t0(query, ring);
  }
};`;
}

// ── L5 PERSIST — localStorage + IndexedDB + export/import/reset ──
function layerPersist(namespace) {
  const ns = (namespace || 'forge').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return `
// L5 PERSIST — sovereign data, never leaves device
__forge.persist = (function(){
  const NS = ${JSON.stringify(ns)};
  const k = key => NS + ':' + key;
  return {
    get: function(key) {
      try { const v = localStorage.getItem(k(key)); return v === null ? null : JSON.parse(v); }
      catch { return null; }
    },
    set: function(key, value) {
      try { localStorage.setItem(k(key), JSON.stringify(value)); return true; }
      catch { return false; }
    },
    remove: function(key) { try { localStorage.removeItem(k(key)); } catch {} },
    keys: function() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(NS + ':')) out.push(key.slice(NS.length + 1));
      }
      return out;
    },
    exportAll: function() {
      const data = {};
      for (const key of this.keys()) data[key] = this.get(key);
      return data;
    },
    importAll: function(data) {
      if (!data || typeof data !== 'object') return false;
      for (const [key, value] of Object.entries(data)) this.set(key, value);
      return true;
    },
    reset: function() {
      for (const key of this.keys()) this.remove(key);
    },
    download: function(filename) {
      const blob = new Blob([JSON.stringify(this.exportAll(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || (NS + '-export.json');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
})();`;
}

// ── L7 ASS — application lifecycle state machine ──
function layerAss() {
  return `
// L7 ASS — lifecycle: ●→〜→┃→♡→△→◐→◯
__forge.ass = {
  states: ['empty', 'input', 'ready', 'engaged', 'working', 'progress', 'complete'],
  glyphs: { empty:'●', input:'〜', ready:'┃', engaged:'♡', working:'△', progress:'◐', complete:'◯' },
  current: 'empty',
  set: function(state) {
    if (!this.states.includes(state)) return;
    this.current = state;
    document.body.setAttribute('data-forge-lifecycle', state);
    document.dispatchEvent(new CustomEvent('forge:lifecycle', { detail: { state, glyph: this.glyphs[state] } }));
  },
  next: function() {
    const i = this.states.indexOf(this.current);
    if (i < this.states.length - 1) this.set(this.states[i + 1]);
  }
};`;
}

// ── UI overlay (the visible "this tool is now sovereign" badge) ──
function overlayHtml(title) {
  const t = (title || 'Tool').replace(/</g, '&lt;');
  return `<div class="forge-overlay" id="forge-overlay" role="status" aria-label="Sovereign forge overlay">
  <span class="forge-dot" aria-hidden="true"></span>
  <span style="font-weight:600">${t}</span>
  <span style="color:var(--forge-muted);font-size:11px">◊ sovereign</span>
  <button onclick="__forge.theme.toggle()" title="Toggle theme">🌓</button>
  <button onclick="__forge.persist.download()" title="Export data">↓</button>
  <button onclick="document.getElementById('forge-overlay').remove()" title="Dismiss">×</button>
</div>`;
}

// ── Theme toggle (small helper) ──
function layerTheme() {
  return `
__forge.theme = {
  get: function() { return document.documentElement.getAttribute('data-theme') || 'light'; },
  set: function(t) {
    document.documentElement.setAttribute('data-theme', t);
    __forge.persist.set('theme', t);
  },
  toggle: function() { this.set(this.get() === 'light' ? 'dark' : 'light'); },
  init: function() {
    const saved = __forge.persist.get('theme');
    if (saved) this.set(saved);
    else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) this.set('dark');
  }
};`;
}

// ── Master upgrade — returns CSS block + JS block + overlay HTML ──
function buildUpgrade(opts) {
  const {
    brand = {},
    agents = [],
    purpose = 'general_tool',
    title = 'Forge',
    providers = ['gemini', 'openai', 'anthropic'],
    namespace = null
  } = opts || {};

  const css = layerSkin(brand);

  // Layers concatenated in dependency order
  const js = `<script id="forge-runtime">
// ◊·κ=1 — FORGE RUNTIME — v18 protocol · 7 layers
// upgraded ${new Date().toISOString()}
(function(){
  if (window.__forge) return; // idempotent
  window.__forge = { version: '1.0.0', upgraded_at: ${Date.now()} };
${layerPersist(namespace || title)}
${layerTheme()}
${layerFace()}
${layerSwarm(agents, purpose)}
${layerBloom()}
${layerCascade(providers)}
${layerAss()}
  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { __forge.theme.init(); __forge.ass.set('ready'); });
  } else {
    __forge.theme.init(); __forge.ass.set('ready');
  }
  console.log('%c◊·κ=1', 'color:#10B981;font-weight:bold;font-size:14px', 'forge runtime loaded ·', Object.keys(__forge.agents).length, 'agents · 7 layers');
})();
</script>`;

  const overlay = overlayHtml(title);
  const layersImplemented = { face: true, swarm: true, cascade: true, bloom: true, persist: true, skin: true, ass: true };

  return { css, js, overlay, layers_implemented: layersImplemented };
}

module.exports = { buildUpgrade, AGENTS };
