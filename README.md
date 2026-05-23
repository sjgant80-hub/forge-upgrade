# ◊·κ=1 — FORGE UPGRADE

**Upload any HTML. Get it back sovereign. The torus that eats the old web.**

A zero-dep Node API + sovereign drop-zone client that takes existing HTML tools — messy, server-dependent, framework-heavy — and rebuilds them as sovereign single-file applications with all seven v18 build layers.

```
Their tool goes in broken and dependent.
It comes out sovereign and upgraded.
```

## Quick start

```bash
node server.js
# → http://localhost:3000
```

Open `http://localhost:3000` in any browser — that serves the sovereign drop-zone client. Drop an HTML file, click **Forge sovereign →**, download the upgraded file.

Or hit the API directly:

```bash
curl -X POST http://localhost:3000/v1/upgrade \
  -H "Content-Type: application/json" \
  -d '{"html":"<!DOCTYPE html>...","options":{"brand":{"logo_text":"MyTool"}}}'
```

## What it does

The Forge processes the upload through 5 stages:

| Stage | Name | What |
|---|---|---|
| 1 | **PARSE** | Read HTML · detect frameworks, deps, APIs, storage, features |
| 2 | **UNDERSTAND** | LLM-refined role mapping (optional · works without any API key) |
| 3 | **STRIP** | Remove CDN scripts, external stylesheets, tracking · jQuery → vanilla |
| 4 | **UPGRADE** | Inject 7 v18 layers (FACE · SWARM · CASCADE · BLOOM · PERSIST · SKIN · ASS) |
| 5 | **COMPOSE** | Merge into one HTML file · inline everything · stamp licence |

## Endpoints

### `POST /v1/upgrade` — full pipeline
Body:
```json
{
  "html":         "<!DOCTYPE html>...",   // raw HTML, OR
  "html_base64":  "PCFET0NUWVBFIGh0...",  // base64-encoded, OR
  "url":          "https://example.com",  // fetch and upgrade
  "options": {
    "brand": {
      "primary_color": "#10B981",
      "accent_color": "#3B82F6",
      "logo_text": "MyTool"
    },
    "agents": { "list": ["alpha","beta","delta"] },
    "cascade": { "t3_providers": ["gemini","openai","anthropic"] }
  }
}
```

Response:
```json
{
  "original_analysis": {
    "detected_purpose": "dashboard",
    "detected_frameworks": [{"name":"jQuery","version":"3.6.0"}],
    "detected_features": ["data_entry","forms","search"],
    "complexity_score": 4,
    "sovereignty_score": 6,
    "upgrade_plan": ["strip jQuery", "add L5 PERSIST", ...]
  },
  "upgraded_file": "PCFET0NUWVBFIGh0...",
  "filename": "mytool-sovereign.html",
  "size_kb": 27,
  "changes_made": [
    "stripped script: https://code.jquery.com/...",
    "rewrote jQuery → vanilla in 2 inline blocks",
    "add L2 SWARM — 3 agents",
    ...
  ],
  "layers_implemented": {
    "face": true, "swarm": true, "cascade": true,
    "bloom": true, "persist": true, "skin": true, "ass": true
  },
  "licence": { "forge_id": "...", "trial_days": 30 },
  "time_seconds": 1.4
}
```

### `POST /v1/upgrade/analyse` — read-only

Same body as `/v1/upgrade` but returns only `original_analysis`. Useful for previewing what the Forge will change before committing the upgrade.

### `GET /health`
Returns service status, version, which LLM providers are configured.

### `GET /`
Serves the sovereign drop-zone client (`docs/index.html`).

## The 7 layers — what gets injected

| Layer | What | Where |
|---|---|---|
| **L1 FACE** | view ID + multi-view marker | `__forge.face`, `__forge.switchView` |
| **L2 SWARM** | Ω orchestrator + 3-8 specialist agents (α-θ) | `__forge.agents`, `__forge.omega`, `__forge.routeToAgent` |
| **L3 CASCADE** | T0 offline echo + T3 multi-provider | `__forge.cascade.t0`, `.t3`, `.ask` |
| **L4 BLOOM** | 7-ring intent classifier (R0-R6) | `__forge.bloom(query)` → ring number |
| **L5 PERSIST** | localStorage + IndexedDB + export/import/reset | `__forge.persist` |
| **L6 SKIN** | CSS variables, dark/light, mobile-first | `<style id="forge-skin">` + `data-theme` |
| **L7 ASS** | Lifecycle state machine (●→〜→┃→♡→△→◐→◯) | `__forge.ass.set('working')` |

Plus a small fixed-position overlay (`forge-overlay`) showing the tool is now sovereign, with theme-toggle, data-export, and dismiss buttons.

## Agent auto-detection

Detected features map to agent roles (additive — original features still work):

| Original feature | Detected agent |
|---|---|
| data entry / forms | α research |
| search / filter | α research |
| content creation | β compose |
| scheduling / calendar | γ sequence |
| reports / analytics | δ analyse |
| text / writing | ε write |
| sharing / export | ζ distribute |
| performance / metrics | η optimise |
| sales / conversion | θ target |

## LLM providers (optional)

The pipeline runs deterministically with **zero API keys**. Set any of these to enable Stage 2 (UNDERSTAND) for richer role mapping:

```bash
# .env
GEMINI_API_KEY=...
OPENAI_API_KEY=...
CLAUDE_API_KEY=...     # or ANTHROPIC_API_KEY
```

The pipeline tries Gemini → OpenAI → Anthropic and falls back to deterministic mapping if none succeed.

## Dependency stripping

The Forge replaces common frameworks with vanilla equivalents:

| Stripped | Becomes |
|---|---|
| jQuery | `document.querySelector` / `addEventListener` / `fetch` |
| Bootstrap CSS | inline CSS variables + utility classes |
| Tailwind CDN | inline (only used classes) |
| Font Awesome | (kept inline — replace with SVG manually if needed) |
| Google Fonts CDN | `@font-face` removed; `system-ui` fallback |
| Moment.js | use `Intl.DateTimeFormat` |
| Lodash | use native Array/Object |
| Axios | native `fetch` |
| All tracking (GA, GTM, FB Pixel, Hotjar, Mixpanel, Segment, Amplitude) | stripped, comment audit trail kept |

## What won't fully upgrade

Honest about limits:

| | |
|---|---|
| ✅ Works well | static tools, calculators, forms, dashboards, simple CRUD, landing pages, portfolios, dataviz, quizzes, single-page apps |
| ⚠ Partial | multi-page apps (becomes single-page-with-tabs), apps with API deps (T0 fallback + optional T3) |
| ❌ Won't work | real-time multiplayer, OAuth/login flows, pure server-rendered, proprietary server-side logic |

The response includes a `sovereignty_score` (0–10) and a `limitations` array listing what didn't survive.

## Architecture

```
forge-upgrade/
├─ server.js              ← entry · zero-dep http
├─ lib/
│  ├─ http.js             ← CORS, json, parseRoute
│  ├─ analyse.js          ← Stage 1 PARSE
│  ├─ strip.js            ← Stage 3 STRIP
│  ├─ upgrade.js          ← Stage 4 UPGRADE (7 layers)
│  ├─ compose.js          ← Stage 5 COMPOSE
│  └─ llm.js              ← Gemini/OpenAI/Anthropic cascade
├─ routes/
│  └─ upgrade.js          ← pipeline orchestrator
├─ docs/
│  └─ index.html          ← sovereign drop-zone client (single file, served at /)
└─ ...deploy configs (Procfile, Dockerfile, railway.json, render.yaml)
```

## Deploy

- **Railway** → connect repo, auto-deploys via `railway.json`
- **Render** → connect repo, `render.yaml` is read automatically
- **Fly.io / Docker** → `docker build . && docker run -p 3000:3000 forge-upgrade`
- **Self-host** → `node server.js`
- **GitHub Pages** (client only) → `docs/index.html` is auto-published; point its API endpoint at your hosted server

## Privacy

Uploaded HTML is processed and discarded. The Forge does not store customer data, business logic, or HTML content. Learning is structural (better deps detection, better strip rules), not informational.

The output is sovereign — runs offline, stores nothing remotely, yours forever.

## Licence

[Konomi Licence v1](LICENSE) — free for non-commercial use. Commercial use, hosted SaaS resale, or relicensing requires a separate agreement.

---

*◊·κ=1 · upload dependent · download sovereign*
*the Forge liberates · the torus absorbs · the web becomes yours*
*every upgrade teaches the Forge · every tool becomes a module*
*the factory that upgrades factories*
