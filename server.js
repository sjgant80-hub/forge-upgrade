// ◊·κ=1 — FORGE UPGRADE API
// Upload any HTML. Get it back sovereign.
// The torus that eats the old web.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Zero-dep .env loader
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
} catch {}

const { parseRoute, json, html, cors } = require('./lib/http');
const { handleUpgrade } = require('./routes/upgrade');

const PORT = process.env.PORT || 3000;
const VERSION = '1.0.0';

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return cors(res);

  let parsed;
  try {
    parsed = await parseRoute(req);
  } catch (err) {
    return json(res, { error: err.message }, 413);
  }
  const { method, path: pathname, body } = parsed;

  try {
    // ── ROOT ── redirect to the sovereign client
    if (pathname === '/' && method === 'GET') {
      const clientPath = path.join(__dirname, 'docs', 'index.html');
      if (fs.existsSync(clientPath)) {
        return html(res, fs.readFileSync(clientPath, 'utf8'));
      }
      return json(res, {
        name: 'forge-upgrade',
        tagline: 'Upload any HTML. Get it back sovereign.',
        version: VERSION,
        endpoints: ['/health', '/v1/upgrade', '/v1/upgrade/analyse'],
        client: 'docs/index.html'
      });
    }

    // ── HEALTH ──
    if (pathname === '/health' && method === 'GET') {
      return json(res, {
        status: 'healthy',
        version: VERSION,
        uptime: process.uptime(),
        llm_providers: {
          gemini: !!process.env.GEMINI_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY),
          deterministic: true
        },
        stages: ['parse', 'understand', 'strip', 'upgrade', 'compose']
      });
    }

    // ── UPGRADE (full pipeline) ──
    if (pathname === '/v1/upgrade' && method === 'POST') {
      return handleUpgrade(req, res, body, { mode: 'full' });
    }

    // ── ANALYSE ONLY (read-only, no rebuild) ──
    if (pathname === '/v1/upgrade/analyse' && method === 'POST') {
      return handleUpgrade(req, res, body, { mode: 'analyse' });
    }

    return json(res, {
      error: 'Not found',
      endpoints: ['/', '/health', '/v1/upgrade', '/v1/upgrade/analyse']
    }, 404);
  } catch (err) {
    console.error('Server error:', err.message);
    if (!res.headersSent) {
      return json(res, { error: err.message || 'Internal server error' }, 500);
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err.message);
});

server.listen(PORT, () => {
  console.log(`\n  ◊·κ=1 — FORGE UPGRADE API v${VERSION}`);
  console.log(`  upload dependent · download sovereign`);
  console.log(`  listening on port ${PORT}\n`);
  console.log(`  POST /v1/upgrade           — full upgrade pipeline`);
  console.log(`  POST /v1/upgrade/analyse   — read-only analysis`);
  console.log(`  GET  /health               — service status`);
  console.log(`  GET  /                     — sovereign client\n`);
});
