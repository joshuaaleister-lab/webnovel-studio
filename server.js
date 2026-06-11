// ============================================================
//  Story Director — backend
//  Zero dependencies. Node 18+ (uses built-in fetch).
//
//  Endpoints (CORS open so the static page can call them):
//    POST /story  { system, prompt, provider:"claude"|"gemini" } -> { text }
//    POST /image  { prompt }                                     -> { url }  (data URL)
//    GET  /       -> health check
//
//  Keys come from environment variables — NEVER hardcode them:
//    ANTHROPIC_API_KEY   (only needed for Hybrid / "claude" text)
//    GEMINI_API_KEY      (needed for Gemini text and all images)
//
//  Run locally:   ANTHROPIC_API_KEY=... GEMINI_API_KEY=... node server.js
// ============================================================

import http from "node:http";

const PORT = process.env.PORT || 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY || "";

// Model IDs — override via env if Google/Anthropic rename them.
const CLAUDE_MODEL       = process.env.CLAUDE_MODEL       || "claude-sonnet-4-6";   // or "claude-haiku-4-5-20251001" for cheaper
const GEMINI_TEXT_MODEL  = process.env.GEMINI_TEXT_MODEL  || "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"; // "Nano Banana" (free tier)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 2_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}

// ---- Claude (Anthropic) text ----
async function claudeText(system, prompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens || 1200,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Claude error");
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

// ---- Gemini text ----
async function geminiText(system, prompt, maxTokens) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set on the server.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const reqBody = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };
  if (maxTokens) reqBody.generationConfig = { maxOutputTokens: maxTokens };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini text error");
  const parts = d?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

// ---- Gemini image (Nano Banana, free tier) -> returns a data URL ----
async function geminiImage(prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set on the server.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini image error");
  const parts = d?.candidates?.[0]?.content?.parts || [];
  const part = parts.find((p) => p.inlineData || p.inline_data);
  const inline = part?.inlineData || part?.inline_data;
  if (!inline?.data) throw new Error("Gemini returned no image (check model name / quota).");
  const mime = inline.mimeType || inline.mime_type || "image/png";
  return `data:${mime};base64,${inline.data}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  try {
    if (req.method === "GET" && req.url === "/") {
      return send(res, 200, { ok: true, service: "story-director-backend" });
    }
    if (req.method === "POST" && req.url === "/story") {
      const { system = "", prompt = "", provider = "gemini", maxTokens } = await readBody(req);
      if (!prompt) return send(res, 400, { error: "Missing prompt" });
      const text = provider === "claude" ? await claudeText(system, prompt, maxTokens) : await geminiText(system, prompt, maxTokens);
      return send(res, 200, { text });
    }
    if (req.method === "POST" && req.url === "/image") {
      const { prompt = "" } = await readBody(req);
      if (!prompt) return send(res, 400, { error: "Missing prompt" });
      const url = await geminiImage(prompt);
      return send(res, 200, { url });
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log(`Story Director backend listening on :${PORT}`));
