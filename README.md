# 🎬 AI Subtitle Generator

বাংলা ও English ভাষায় AI-powered Subtitle Generator। Video/Audio upload করলে automatically Speech-to-Text, Subtitle generation, Timestamp এবং SRT file তৈরি করে।

## ✨ Features

- 🎙️ **Automatic Speech-to-Text** — OpenAI Whisper large-v3 via Hugging Face (Free)
- 🇧🇩 **Bengali (বাংলা) Support** — Banglish ও spoken Bengali উভয়ই
- 🌐 **Multi-language** — Bengali, English, Hindi, Urdu + Auto-detect
- ⏱️ **Accurate Timestamps** — Word-level timestamp alignment
- 📄 **SRT Export** — Industry-standard format, যেকোনো video editor-এ কাজ করে
- ⚡ **Fallback Providers** — AssemblyAI, Deepgram support
- 🗄️ **SQLite Database** — Redis server ছাড়াও চলবে (in-memory fallback)
- ☁️ **Netlify & Vercel Ready** — Serverless in-process transcription, zero Redis/worker dependency needed on cloud deployment!

---

## ☁️ Deploy to Netlify (১-ক্লিকে ডিপ্লয়)

See full details in [NETLIFY_DEPLOYMENT_GUIDE.md](./NETLIFY_DEPLOYMENT_GUIDE.md).

1. আপনার GitHub repo Netlify-তে connect করুন।
2. **Environment Variables**-এ `HUGGINGFACE_TOKEN` যোগ করুন।
3. **Deploy!** Netlify automatically `prisma generate && next build` চালাবে এবং serverless mode-এ app লাইভ করবে।

---

## 🚀 Quick Start (5 মিনিটে চালু করুন)

### Step 1 — Dependencies Install

```bash
npm install
```

### Step 2 — Environment Setup

`.env.local` ফাইলে Hugging Face token দিন:

```env
HUGGINGFACE_TOKEN=hf_your_actual_token_here
```

**Hugging Face token পাবেন:** https://huggingface.co/settings/tokens → New token (read access যথেষ্ট)

### Step 3 — Database Setup

```bash
npm run db:setup
```

এটি SQLite database তৈরি করবে (`dev.db`)।

### Step 4 — Redis Start (Optional কিন্তু Recommended)

```bash
# Ubuntu/Debian
sudo apt install redis-server
redis-server

# macOS
brew install redis
redis-server
```

> Redis না থাকলেও app চলবে, তবে job queue কাজ করবে না।

### Step 5 — Worker Start (New Terminal)

```bash
npm run worker
```

### Step 6 — App Start (Another Terminal)

```bash
npm run dev
```

**App খুলুন:** http://localhost:3000

---

## 📁 Project Structure

```
subtitle-generator/
├── app/
│   ├── page.tsx                    # Root → redirects to /dashboard
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   ├── dashboard/page.tsx          # Main UI
│   └── api/
│       ├── upload/route.ts         # File upload endpoint
│       ├── transcribe/route.ts     # Start transcription
│       ├── status/[jobId]/route.ts # Poll job status
│       └── download/[jobId]/route.ts # Download SRT file
├── lib/
│   ├── cloud-ai/
│   │   ├── huggingface.ts          # Whisper via HF Inference API
│   │   ├── assemblyai.ts           # AssemblyAI provider
│   │   ├── deepgram.ts             # Deepgram provider
│   │   ├── factory.ts              # Provider factory
│   │   └── types.ts                # Shared interfaces
│   ├── srt/generator.ts            # SRT format generator & parser
│   ├── queue/redis-queue.ts        # BullMQ job queue (lazy singleton)
│   └── db/prisma.ts                # Prisma client singleton
├── workers/
│   └── transcribe-worker.ts        # BullMQ worker process
├── prisma/schema.prisma            # Database schema
├── .env.local                      # Environment variables
└── uploads/                        # Uploaded files (auto-created)
```

---

## 🔧 AI Provider Configuration

### Option 1: Hugging Face (Default — 100% Free)

```env
AI_PROVIDER="huggingface"
HUGGINGFACE_TOKEN=hf_your_token
```

Model: `openai/whisper-large-v3` — বাংলার জন্য সবচেয়ে ভালো accuracy।

**Note:** প্রথমবার model load হতে 30-60 সেকেন্ড লাগতে পারে।

### Option 2: AssemblyAI (Free $5 credit)

```env
AI_PROVIDER="assemblyai"
ASSEMBLYAI_KEY=your_key
```

### Option 3: Deepgram (Free $200 credit)

```env
AI_PROVIDER="deepgram"
DEEPGRAM_KEY=your_key
```

### Fallback Provider

```env
FALLBACK_PROVIDER="assemblyai"
```

Primary fail হলে automatically fallback provider use করবে।

---

## 🌐 Supported Languages

| Code | Language | Script |
|------|----------|--------|
| `auto` | Auto Detect | — |
| `bn` | Bengali / বাংলা | বাংলা |
| `en` | English | Latin |
| `hi` | Hindi | Devanagari |
| `ur` | Urdu | Arabic |

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `HUGGINGFACE_TOKEN` | — | HF API token (required for HF provider) |
| `ASSEMBLYAI_KEY` | — | AssemblyAI API key |
| `DEEPGRAM_KEY` | — | Deepgram API key |
| `DATABASE_URL` | `file:./dev.db` | SQLite or PostgreSQL URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `AI_PROVIDER` | `huggingface` | Primary provider |
| `FALLBACK_PROVIDER` | — | Fallback if primary fails |
| `MAX_FILE_SIZE` | `104857600` | Max upload size (100MB) |

---

## 🐛 Common Issues

### "Model is loading" / 503 Error
HuggingFace cold-start সমস্যা। App automatically 3 বার retry করবে। একটু অপেক্ষা করুন।

### Redis Connection Error
Redis না থাকলেও app চলবে। Job queue ছাড়া in-process transcription হবে না। Redis install করুন।

### "No speech detected"
- File-এ audio আছে কিনা check করুন
- File corrupted না তো?
- খুব short (< 1 second) audio হলে detect নাও হতে পারে

### Large File (> 100MB)
`.env.local`-এ `MAX_FILE_SIZE` বাড়ান বা file compress করুন।

---

## 🔄 Development

```bash
# Dev server
npm run dev

# Worker (watch mode — auto restart on change)
npm run worker:dev

# Database GUI
npm run db:studio

# Type check
npx tsc --noEmit
```

---

## 📊 Architecture

```
Browser → Next.js API → BullMQ Queue → Worker → HuggingFace API
                  ↓                        ↓
            SQLite DB              SRT Generator → DB
```
