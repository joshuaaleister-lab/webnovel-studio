// Shared helpers for the Vercel serverless functions in /api.
// (Filename starts with "_" so Vercel does NOT treat it as a route.)

export const CLAUDE_MODEL       = process.env.CLAUDE_MODEL       || "claude-sonnet-4-6";
export const GEMINI_TEXT_MODEL  = process.env.GEMINI_TEXT_MODEL  || "gemini-2.5-flash";
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
}

export async function claudeText(system, prompt, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens || 1200, system, messages: [{ role: "user", content: prompt }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Claude error");
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

export async function geminiText(system, prompt, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }] }, maxTokens ? { generationConfig: { maxOutputTokens: maxTokens } } : {})),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini text error");
  const parts = d?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

export async function geminiImage(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`;
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
