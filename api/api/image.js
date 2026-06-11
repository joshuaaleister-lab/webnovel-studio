import { getProvider } from './_providers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, provider = 'pollinations', style = '' } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const p = getProvider(provider);
    const url = await p.generateImage(prompt, style);
    res.status(200).json({ url });
  } catch (err) {
    console.error('image error:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
}
