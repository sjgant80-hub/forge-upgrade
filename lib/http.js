// HTTP utilities — zero dependencies
// ◊·κ=1 · the gate · CORS open · responses JSON

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-RapidAPI-Proxy-Secret, X-RapidAPI-User, X-RapidAPI-Subscription, Authorization',
  'Content-Type': 'application/json',
};

function cors(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
}

function json(res, data, status = 200, extraHeaders = {}) {
  res.writeHead(status, { ...CORS_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(data));
}

function html(res, body, status = 200) {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function parseRoute(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let body = null;

  if (req.method === 'POST') {
    const chunks = [];
    let total = 0;
    const MAX = 20 * 1024 * 1024; // 20 MB cap for HTML uploads
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX) throw new Error('Payload too large (>20MB)');
      chunks.push(chunk);
    }
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      body = {};
    }
  }

  return { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body };
}

module.exports = { cors, json, html, parseRoute, CORS_HEADERS };
