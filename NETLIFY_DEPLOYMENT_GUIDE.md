# 🚀 Netlify Deployment Guide for AI Subtitle Generator

This guide explains how to deploy the AI Subtitle Generator to **Netlify** with zero errors.

---

## 🛠️ What Was Fixed For Netlify

The original repository was designed as a traditional Node.js server app relying on local background workers and a local Redis instance. Netlify is a **serverless platform**, which caused previous deployments to fail:

1. **Build Error (`@prisma/client did not initialize yet`)**:
   - **Fix**: Added `prisma generate` to the `build` script and `postinstall` script in `package.json`, and added Linux `binaryTargets` in `prisma/schema.prisma`.
2. **Runtime Error (`Queue service is unavailable` / Missing Redis Worker)**:
   - **Fix**: Netlify cannot run long-running background worker processes (`npm run worker`). The app now includes **in-process direct transcription**, executing Speech-to-Text and SRT generation seamlessly within serverless functions when Redis is not running.
3. **Read-Only Filesystem Error (`EROFS`)**:
   - **Fix**: Serverless environments make `process.cwd()` read-only. File uploads and SQLite database storage are now automatically redirected to `os.tmpdir()` (`/tmp`), with an automatic schema initializer and memory store.
4. **Missing Configuration**:
   - **Fix**: Added `netlify.toml` configured with `@netlify/plugin-nextjs`, function timeout of 26s, and Node 20 runtime.
5. **AI Provider Fixes**:
   - **AssemblyAI**: Fixed automatic language detection syntax.
   - **Deepgram**: Fixed hardcoded MIME type to allow video/audio auto-detection.
   - **Hugging Face**: Enhanced token placeholder detection.

---

## 📦 How To Deploy on Netlify (Step-by-Step)

### Option 1: Deploy via GitHub (Recommended)

1. **Commit and Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "Fix: Configure project for Netlify serverless deployment"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Log into [Netlify](https://app.netlify.com/).
   - Click **"Add new site"** → **"Import an existing project"**.
   - Select **GitHub** and choose your repository: `rafidhasan3124-alt/subtitle-generator`.

3. **Verify Build Settings** (Netlify will auto-detect these from `netlify.toml`):
   - **Base directory**: (leave blank or `/`)
   - **Build command**: `prisma generate && next build`
   - **Publish directory**: `.next`

4. **Add Environment Variables** (Critical!):
   In Netlify site setup, go to **Site configuration** → **Environment variables** → **Add a variable**:
   
   | Variable | Value | Description |
   |---|---|---|
   | `HUGGINGFACE_TOKEN` | `hf_...` | **Required for free AI transcription**. Get free token from [Hugging Face](https://huggingface.co/settings/tokens) |
   | `AI_PROVIDER` | `huggingface` | Default AI provider |
   | `MAX_FILE_SIZE` | `524288000` | Max file size (500MB) |

   *(Optional)* If you have keys for other providers:
   - `DEEPGRAM_KEY`: For ultra-fast Deepgram Nova ($200 free credits)
   - `ASSEMBLYAI_KEY`: For AssemblyAI ($5 free credits)
   - `OPENAI_KEY`: For official OpenAI Whisper API

5. **Deploy Site**:
   - Click **"Deploy subtitle-generator"**.
   - Netlify will build the Next.js app and deploy it to a live URL (e.g., `https://your-site.netlify.app`).

---

### Option 2: Deploy via Netlify CLI

If you prefer deploying from your local terminal:

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize and Deploy:
   ```bash
   netlify init
   netlify deploy --prod
   ```

---

## 🔑 Environment Variables Reference

| Variable | Required? | Default | Description |
|---|---|---|---|
| `HUGGINGFACE_TOKEN` | **Recommended** | `none` | 100% Free OpenAI Whisper inference token from Hugging Face |
| `AI_PROVIDER` | Optional | `huggingface` | Preferred provider: `huggingface`, `deepgram`, `assemblyai`, or `openai` |
| `DEEPGRAM_KEY` | Optional | `none` | Deepgram API key |
| `ASSEMBLYAI_KEY` | Optional | `none` | AssemblyAI API key |
| `OPENAI_KEY` | Optional | `none` | OpenAI API key |
| `DATABASE_URL` | Optional | `file:/tmp/dev.db` | Auto-configured for serverless `/tmp` SQLite. Can also point to Supabase or Neon PostgreSQL. |
| `NEXT_PUBLIC_APP_URL` | Optional | Netlify auto-URL | Public URL of your deployed application |

---

## 🔍 Verification Checklist After Deployment

- [ ] Open the deployed site URL in your browser.
- [ ] Check the **⚙️ AI Settings & Language** section: Hugging Face should display **✓ Ready** if `HUGGINGFACE_TOKEN` is configured.
- [ ] Upload a test audio or video file (e.g. 10-30 seconds).
- [ ] Click **🚀 Generate Subtitles**.
- [ ] Verify that subtitles appear in the interactive subtitle editor with timestamps.
- [ ] Click **⬇️ Download SRT** and **📄 VTT** to verify file export.
