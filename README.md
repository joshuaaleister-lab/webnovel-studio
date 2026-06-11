# Story Director — how to run it

A 7-stage AI story engine: it writes seven "movements" and generates one image per movement. There are **three modes**, switchable in the page's **Mode** dropdown — pick based on whether you want it free, and where you want it to run.

| Mode | Text | Images | Cost | Runs where |
|------|------|--------|------|------------|
| **Claude preview** | in-app Claude | MAGNIFIC (your connector) | covered by your MAGNIFIC plan | inside the Claude app only |
| **Self-host · Hybrid** | Claude (your key) | free Gemini (your key) | ~a few cents/story | anywhere |
| **Self-host · Gemini only** | free Gemini | free Gemini | $0 (within free limits) | anywhere |

---

## What's in this folder

```
story-director.html     Story ideation app (7 movements). Has the Mode dropdown.
webnovel-studio.html    Long-form NOVEL writer — endless chapters with memory + autosave.
server.js               Backend as a plain Node server (run locally / any Node host).
api/story.js            Backend for Vercel  (POST /api/story)
api/image.js            Backend for Vercel  (POST /api/image)
api/_providers.js       Shared logic for the Vercel functions
worker.js               Backend for Cloudflare Workers (single file)
wrangler.toml           Cloudflare deploy config
package.json            Node metadata
```

You only need **one** backend. Use `server.js` for local testing, OR `api/*` for Vercel, OR `worker.js` for Cloudflare — not all three.

---

## Step 1 — Get your keys

- **Gemini API key (free):** Google AI Studio → aistudio.google.com → "Get API key". Needed for every self-host mode.
- **Anthropic key (optional, Hybrid only):** console.anthropic.com → API keys. New accounts usually get trial credits.

If you only want **Claude preview** mode, you need no keys — skip to Step 4.

---

## Step 2 — Pick how you'll run the backend

### Option A — Local (fastest to test)

Requires Node 18+. No `npm install` (zero dependencies).

```bash
# Gemini only (free):
GEMINI_API_KEY=your_key node server.js

# Hybrid (adds Claude text):
ANTHROPIC_API_KEY=sk-ant-... GEMINI_API_KEY=your_key node server.js
```

Backend URL to use in the app: `http://localhost:8787`

### Option B — Vercel (copy-paste deploy, free tier)

1. Install the CLI: `npm i -g vercel`
2. From this folder: `vercel` (follow prompts), then `vercel --prod`
3. Dashboard → project → Settings → Environment Variables, add:
   - `GEMINI_API_KEY` = your Gemini key
   - `ANTHROPIC_API_KEY` = your Anthropic key (only for Hybrid)
4. Redeploy so the vars take effect.

Backend URL to use in the app: `https://YOUR-PROJECT.vercel.app/api`
(Note the **/api** — Vercel serves the functions under that path.)

### Option C — Cloudflare Workers (free tier)

1. Install: `npm i -g wrangler` then `wrangler login`
2. Set secrets:
   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put ANTHROPIC_API_KEY   # only for Hybrid
   ```
3. Deploy: `wrangler deploy`

Backend URL to use in the app: `https://story-director.YOUR-SUBDOMAIN.workers.dev`

---

## Step 3 — Quick test the backend (optional)

```bash
curl -X POST <YOUR_BACKEND_URL>/image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a lighthouse at dusk, cinematic, no text"}'
```

A working call returns `{"url":"data:image/png;base64,...."}`. If you get a model-name error, edit the model constants at the top of your backend file (Google occasionally renames models) and redeploy.

---

## Step 4 — Open the app and choose a mode

1. Open `story-director.html` in a browser (double-click, or host it anywhere static).
2. In the **Mode** dropdown pick one:
   - **Claude preview** → only works when the page is opened *inside Claude*. Nothing else to set.
   - **Self-host · Hybrid** or **Gemini only** → a **Backend URL** field appears. Paste the URL from Step 2.
3. Type a seed (or leave it blank), then **Compose** each movement or hit **▶ Direct the whole story**. Tick **auto-illustrate** to generate an image for every movement automatically.

That's it.

---

## Writing a webnovel (webnovel-studio.html)

For full multi-chapter novels (even 1000+ chapters), open **`webnovel-studio.html`** instead of the ideation app. It uses the **same backend** — run the server exactly as in Step 2, then:

1. Open `webnovel-studio.html`, set **Engine** (Gemini = free, Claude = better prose) and paste your **Backend URL**.
2. Type your idea + genre/tone, choose chapter length, optionally a target chapter count.
3. **Build the story bible** → edit it if you like.
4. **Write next chapter**, or **Auto-write** to keep generating until you press Stop (or hit the target).

How it handles long novels: it keeps your bible plus a rolling summary of recent chapters, so continuity holds without the prompt ever getting huge. Progress **autosaves in your browser**, and **Export manuscript** / **Save backup** let you download the whole book (`.md`) or a reloadable project (`.json`).

**Continuity tools (in the Continuity & steering panel):**
- **Canon notes** — facts the AI can never contradict.
- **Current story goal** — steering that carries forward until changed.
- **Characters** — an auto-updating cast ledger; it fills itself in as chapters are written and feeds back so names/traits stay consistent.
- **Story arcs / outline** — press **Plan the arcs** to map chapter ranges to arcs (e.g. `1-15 | The Awakening | ...`); each chapter automatically follows whichever arc its number falls into.

**Style for Webnovel:** the **Writing style** selector defaults to *Web-serial (Webnovel-style)* — punchy, dialogue-heavy, cliffhanger endings. Optional **System / LitRPG elements** adds status screens and level-ups.

**Posting to Webnovel:** Webnovel's author tool (Inkstone, at inkstone.webnovel.com or the app's Write icon) is paste-per-chapter — there is no bulk upload for regular authors. Workflow: open a chapter in the reader, press **⧉ Copy**, then in Inkstone create a chapter, paste, and Publish. (Use **Export manuscript** for a full backup of the whole book.)

Reality check on free: Gemini's free tier limits daily requests, so a 1000-chapter marathon will hit a pause — wait and resume, spread it across days, or switch the Engine to Claude (pennies per chapter) for uninterrupted runs. Covers use free Pollinations.

## Hosting the page publicly

The HTML is static, so it can live on the same Vercel/Cloudflare project, GitHub Pages, Netlify, etc. The backend's CORS is open, so page and backend can be on different domains. To hard-wire the backend URL (so users don't paste it), set `BACKEND_URL` near the top of the `<script>` in `story-director.html`.

## Put it on your phone

`localhost` only works on the PC running the server, so to use it on your phone you deploy it once. Easiest no-terminal route (Vercel):

1. Create a free account at **github.com** and a free account at **vercel.com** (sign in with GitHub).
2. Make a new GitHub repository and upload this whole folder to it (GitHub's web uploader works — keep the `api/` folder intact).
3. In Vercel: **Add New → Project → Import** your repo → **Deploy**.
4. In the Vercel project: **Settings → Environment Variables**, add `GEMINI_API_KEY` (and `ANTHROPIC_API_KEY` if you'll use the Claude engine). Then **Redeploy**.
5. On your phone, open `https://YOUR-PROJECT.vercel.app/webnovel-studio.html`. Set the engine and put `https://YOUR-PROJECT.vercel.app/api` in the Backend URL field (it's saved, so you only type it once).

That's it — write and Copy chapters from anywhere. (Prefer the command line? `npm i -g vercel` then `vercel --prod` from this folder does the same thing.)

Tip: to skip typing the backend URL on phone, open `webnovel-studio.html` in a text editor and set `let BACKEND_URL = "/api";` near the top of the script — when the page and API live on the same Vercel project, that relative path just works.

## Notes & gotchas

- **Never put an API key in `story-director.html`.** It's sent to every visitor. Keys belong only in the backend's environment variables.
- **Claude preview mode** relies on Claude's in-app API and only works inside Claude — it won't run on your own hosted page. Use the self-host modes there.
- **Gemini free tier** has daily/rate limits (tightened Dec 2025) and may use inputs for training. Fine for personal/demo use; review terms before sending confidential material.
- **Model names** are overridable via env vars in every backend file — handy if a provider renames a model.
- **Images are free via Pollinations** (no key, no quota) in the self-host modes and for novel covers. Google zeroed out its free image API tier, so we don't rely on it.
