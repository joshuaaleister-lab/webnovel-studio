// Story Director — Cloudflare Worker (single file).
// Deploy with wrangler. Secrets come from `env`, not process.env.
//   wrangler secret put GEMINI_API_KEY
//   wrangler secret put ANTHROPIC_API_KEY   (only needed for Hybrid)
// Routes:  POST /story  { system, prompt, provider }  ->  { text }
//          POST /image  { prompt }                     ->  { url }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const { pathname } = new URL(request.url);
    try {
      if (request.method === "GET" && pathname === "/") return json({ ok: true, service: "story-director-worker" });
      if (request.method === "POST" && pathname === "/story") {
        const { system = "", prompt = "", provider = "gemini", maxTokens } = await request.json();
        if (!prompt) return json({ error: "Missing prompt" }, 400);
        const text = provider === "claude" ? await claudeText(env, system, prompt, maxTokens) : await geminiText(env, system, prompt, maxTokens);
        return json({ text });
      }
      if (request.method === "POST" && pathname === "/image") {
        const { prompt = "" } = await request.json();
        if (!prompt) return json({ error: "Missing prompt" }, 400);
        return json({ url: await geminiImage(env, prompt) });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  },
};

const CLAUDE_MODEL = (env) => env.CLAUDE_MODEL || "claude-sonnet-4-6";
const GEMINI_TEXT_MODEL = (env) => env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL = (env) => env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

async function claudeText(env, system, prompt, maxTokens) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY secret is not set.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL(env), max_tokens: maxTokens || 1200, system, messages: [{ role: "user", content: prompt }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Claude error");
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

async function geminiText(env, system, prompt, maxTokens) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL(env)}:generateContent?key=${env.GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }] }, maxTokens ? { generationConfig: { maxOutputTokens: maxTokens } } : {})),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini text error");
  const parts = d?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

async function geminiImage(env, prompt) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL(env)}:generateContent?key=${env.GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini image error");
  const parts = d?.candidates?.[0]?.content?.parts || [];
  const inline = (parts.find((p) => p.inlineData || p.inline_data) || {});
  const data = inline.inlineData || inline.inline_data;
  if (!data?.data) throw new Error("Gemini returned no image (check model name / quota).");
  return `data:${data.mimeType || data.mime_type || "image/png"};base64,${data.data}`;
}
