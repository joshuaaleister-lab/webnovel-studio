import { getProvider } from './_providers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    prompt,
    provider = 'claude',
    systemPrompt = '',
    maxTokens = 1000,
    history = []
  } = req.body || {};

  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const p = getProvider(provider);
    const text = await p.generateText({ prompt, systemPrompt, maxTokens, history });
    res.status(200).json({ text });
  } catch (err) {
    console.error('story error:', err);
    res.status(500).json({ error: err.message || 'Story generation failed' });
  }
}
