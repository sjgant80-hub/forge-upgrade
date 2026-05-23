// Server-side LLM cascade for the UNDERSTAND stage (Stage 2)
// ◊·κ=1 · Gemini → OpenAI → Anthropic → deterministic fallback
// All providers OPTIONAL — pipeline works with zero keys.

async function askGemini(system, user) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
    })
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const j = await r.json();
  return { text: j.candidates?.[0]?.content?.parts?.[0]?.text || '', provider: 'gemini' };
}

async function askOpenAI(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 2048,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  if (!r.ok) throw new Error('openai ' + r.status);
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content || '', provider: 'openai' };
}

async function askAnthropic(system, user) {
  const key = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const j = await r.json();
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, provider: 'anthropic' };
}

async function askLLM(system, user) {
  const providers = [askGemini, askOpenAI, askAnthropic];
  for (const ask of providers) {
    try {
      const r = await ask(system, user);
      if (r && r.text) return r;
    } catch (err) {
      console.warn('LLM provider failed, trying next:', err.message);
    }
  }
  return null; // all unavailable / failed
}

async function askJSON(system, user) {
  const r = await askLLM(system, user);
  if (!r) return null;
  try {
    const match = r.text.match(/\{[\s\S]*\}/);
    return match ? { ...r, parsed: JSON.parse(match[0]) } : { ...r, parsed: null };
  } catch {
    return { ...r, parsed: null };
  }
}

function hasAnyProvider() {
  return !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY);
}

module.exports = { askLLM, askJSON, hasAnyProvider };
