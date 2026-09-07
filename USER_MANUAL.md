# 📖 AI Subtitle Generator — Complete User Manual

> **For everyone — no technical knowledge needed!**
> This guide explains everything step by step in simple language.

---

## 📋 Table of Contents

1. [What is this app?](#1-what-is-this-app)
2. [Starting the App](#2-starting-the-app)
3. [Using the App — Step by Step](#3-using-the-app--step-by-step)
4. [AI Settings Explained](#4-ai-settings-explained)
5. [Downloading Your Subtitles](#5-downloading-your-subtitles)
6. [Editing Subtitles](#6-editing-subtitles)
7. [Using Subtitles in Video Editors](#7-using-subtitles-in-video-editors)
8. [Common Errors and Fixes](#8-common-errors-and-fixes)
9. [FAQ](#9-faq)
10. [Adding More AI Providers](#10-adding-more-ai-providers)

---

## 1. What is this app?

This app automatically creates **subtitles** (captions) for any video or audio file using **Artificial Intelligence (AI)**.

**What it can do:**
- 🎙️ Listen to your video or audio and write down everything that is said
- 🇧🇩 Understands **বাংলা (Bengali)** and **English** — including Banglish mix
- 📄 Saves the subtitles as **.SRT** or **.VTT** files (industry standard formats)
- ✏️ Lets you edit any mistakes before downloading
- 🎬 Works with Premiere Pro, DaVinci Resolve, CapCut, YouTube, and more

---

## 2. Starting the App

### Option A — Using the start script (Easiest)

1. Open a **Terminal** window
2. Type this and press Enter:
   ```
   cd subtitle-generator
   bash start_app.sh
   ```
3. Wait until you see: **Ready**
4. Open your browser and go to: **http://localhost:3000**

### Option B — Manual Start

Open a **Terminal** and run these two commands in two separate terminal tabs:

**Tab 1** — The website:
```
cd subtitle-generator
npm run dev
```

**Tab 2** — The AI worker:
```
cd subtitle-generator
npx tsx --env-file=.env.local workers/transcribe-worker.ts
```

**Tab 3** — Open your browser at: `http://localhost:3000`

> **Important:** Keep all Terminal windows open while using the app. Closing them stops the app.

---

## 3. Using the App — Step by Step

When you open `http://localhost:3000` you will see the dashboard.

### Step 1 — Upload Your File

- **Click** the upload box (the one that says "Click to Browse or Drag & Drop")
- **OR** drag your video or audio file directly onto the box
- Supported formats: **MP4, MP3, WAV, M4A, MKV, MOV, WebM**
- Maximum file size: **500 MB**

Once uploaded, the file name and size will appear with a green checkmark ✅

---

### Step 2 — Choose Your Settings (Optional)

Below the upload box is the **AI Settings & Language** panel. It is open by default.

Configure language, AI model, and provider. See Section 4 for a full explanation.

---

### Step 3 — Click Generate

The big purple button at the bottom becomes active once a file is uploaded:

> **🚀 Generate Subtitles — সাবটাইটেল তৈরি করুন**

Click it. The app will:
1. Upload your file
2. Run AI speech recognition
3. Create timestamps for each sentence

This takes **30 seconds to 3 minutes** depending on file length.

---

### Step 4 — Download or Edit

When done, a green banner appears and your subtitles are listed below. You can:
- Edit any subtitle line by clicking on it
- Download as SRT (most common)
- Download as VTT (for web and YouTube)
- Copy SRT text to clipboard

---

## 4. AI Settings Explained

### 🤖 AI Provider

This is the AI service that listens to your audio. There are 4 options:

| Provider | Cost | Best For |
|----------|------|----------|
| 🤗 Hugging Face | **Free forever** | Bengali, multilingual |
| 🔬 AssemblyAI | Free $5 credit | English, Hindi, speaker detection |
| 🎙️ Deepgram Nova | Free $200 credit | Long files, fast results |
| ✨ OpenAI Whisper | Pay per use | Maximum accuracy |

Each provider shows a status badge:
- **✓ Ready** (green) — configured and ready to use
- **🔑 Token not added** (red) — needs an API key (see Section 10)

> **Recommendation: Use Hugging Face** — it is free and already configured!

---

### 🌐 Language

Choose the language spoken in your video:

| Setting | Use When |
|---------|----------|
| **Auto Detect** | Mixed Bengali and English (Banglish) |
| **বাংলা** | Entirely in Bengali |
| **English** | Entirely in English |
| **Hindi, Arabic, etc.** | Select the matching language |

> **Not sure?** Choose **Auto Detect**. The AI will figure it out automatically.

---

### 🧠 Whisper Model

Choose the AI power level:

| Model | Speed | Accuracy | When to Use |
|-------|-------|----------|-------------|
| ⚡ Small | ~30 seconds | Good | Start here — works for most videos |
| 🎯 Medium | ~1 minute | Better | Noisy audio or heavy accent |
| 👑 Large-v3 | ~2-3 minutes | Best | Critical content needing maximum accuracy |

> **Tip:** Start with Small. If results are inaccurate, try Large-v3.

---

### 📝 Custom Vocabulary (Optional)

Type special words, names, or brands that the AI might not recognize.

**Examples:**
- `CapCut, Premiere Pro, DaVinci Resolve`
- `Shajgoj, Chaldal, bKash`
- Technical terms from your industry

Click the **Quick Add** buttons below the box to add common terms instantly.

---

## 5. Downloading Your Subtitles

After generation completes, three buttons appear:

| Button | Format | Best For |
|--------|--------|----------|
| ⬇️ Download SRT | .srt | Premiere Pro, DaVinci, CapCut, Facebook |
| 📄 Download VTT | .vtt | YouTube, web players, HTML5 video |
| 📋 Copy SRT | clipboard | Pasting directly into tools |

---

## 6. Editing Subtitles

After generation, the **Subtitle Editor** appears as a list of all subtitle lines.

**How to edit:**
1. Click on any subtitle text line
2. The box highlights in purple
3. Type your correction
4. Click elsewhere to save
5. Download again — your edits are included

**Example correction:**
```
Before: আমি ক্যাপকাট এ কাজ করি
After:  আমি CapCut এ কাজ করি
```

The timestamps are correct automatically — only fix the text if needed.

---

## 7. Using Subtitles in Video Editors

### Adobe Premiere Pro
1. Download the `.srt` file
2. In Premiere: **File → Import** → select the `.srt` file
3. Drag the subtitle track onto the timeline above your video

### DaVinci Resolve
1. Download the `.srt` file
2. Go to **Edit** tab → **File → Import Subtitle**
3. Select the file and drag onto the timeline

### CapCut (Desktop)
1. Download the `.srt` file
2. In CapCut: **Text → Auto Captions → Import SRT**

### YouTube
1. Download the `.vtt` file
2. YouTube Studio → select your video → **Subtitles → Add → Upload file**
3. Select the `.vtt` file

---

## 8. Common Errors and Fixes

### "This site can't be reached" or blank page
**Cause:** The app is not running.
**Fix:** Open Terminal and run:
```
cd subtitle-generator
npm run dev
```
Wait for **Ready** then refresh the browser.

---

### "🔑 Token not added" warning
**Cause:** The selected AI provider does not have an API key set up.
**Fix:** Switch to **Hugging Face** (it is free and already ready), or add an API key (see Section 10).

---

### "File is too large"
**Cause:** Your file is over 500 MB.
**Fix:** Compress the video using [HandBrake](https://handbrake.fr) (free), or extract just the audio using VLC: **Media → Convert → Audio only → MP3**.

---

### "No speech detected"
**Cause:** The AI could not find any speech in the file.
**Fixes:**
- Make sure the file actually has audio
- Increase audio volume in any video editor first
- Try converting to MP3 format before uploading

---

### "Processing timed out after 12 minutes"
**Cause:** Very long or large file.
**Fix:** Split into 20-30 minute segments using VLC or a video editor, then process each part separately.

---

### Subtitles have many spelling mistakes
**Fix:**
- Add correct spellings to the **Custom Vocabulary** box
- Switch to the **Large-v3** model for maximum accuracy
- Select the correct **Language** instead of Auto Detect

---

### Worker not running / "Error connecting to worker"
**Fix:** Open a second Terminal and run:
```
cd subtitle-generator
npx tsx --env-file=.env.local workers/transcribe-worker.ts
```
Keep this Terminal open while using the app.

---

## 9. FAQ

**Q: Is this app free?**
A: Yes. Hugging Face provider is 100% free with no credit card required. Other providers have generous free tiers.

**Q: Does it work offline?**
A: No. The AI runs on cloud servers and requires an internet connection.

**Q: How accurate is it?**
A: Typically 85-95% for clear audio. Use **Large-v3** model and add words to Custom Vocabulary for best results.

**Q: Can it separate multiple speakers?**
A: It transcribes all speech but does not label who said what.

**Q: What is the maximum video length?**
A: No hard limit. For files over 1 hour, split into 30-minute segments for best results.

**Q: My Bengali text has wrong spelling. What do I do?**
A: Add the correct Bengali words to the **Custom Vocabulary** box before generating. Also try the **Large-v3** model.

**Q: Can I use these subtitles commercially?**
A: Yes. The subtitles you generate are entirely yours.

**Q: How do I stop the app?**
A: Press **Ctrl + C** in the Terminal window.

**Q: I used the app yesterday but it does not work today.**
A: The app needs to be started fresh each time. Run `npm run dev` and the worker again.

---

## 10. Adding More AI Providers

### Step 1 — Sign up and get a free API key

| Provider | Sign-up Link | Free Amount |
|----------|-------------|-------------|
| AssemblyAI | assemblyai.com/dashboard/signup | $5 free credit |
| Deepgram | console.deepgram.com/signup | $200 free credit |
| OpenAI | platform.openai.com/api-keys | Pay per use |

### Step 2 — Open .env.local

1. Open the `subtitle-generator` folder
2. Find the file called **`.env.local`**

   > **Note:** This file may be hidden. In Windows File Explorer, click **View → Show → Hidden items**. On Mac, press **Cmd + Shift + .** to show hidden files.

3. Open it with any text editor (Notepad, TextEdit, VS Code)

### Step 3 — Paste your API key

Find the line for your provider and replace the placeholder text:

```
# Replace: xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# With your real key:

ASSEMBLYAI_KEY=your_real_assemblyai_key_here
DEEPGRAM_KEY=your_real_deepgram_key_here
OPENAI_KEY=sk-your_real_openai_key_here
```

Save the file.

### Step 4 — Restart the app

1. Press **Ctrl + C** in both Terminal windows
2. Run `npm run dev` again
3. Refresh `http://localhost:3000`
4. The provider now shows **✓ Ready** in green ✅

---

## Quick Reference Card

| Task | What to Do |
|------|-----------|
| Start app | `npm run dev` in Terminal |
| Start AI worker | `npx tsx --env-file=.env.local workers/transcribe-worker.ts` |
| Open the app | Browser → `http://localhost:3000` |
| Best free provider | Hugging Face (already configured) |
| Best for Bengali | Auto Detect language + Large-v3 model |
| Best file format to upload | MP4 or MP3 |
| Download format for Premiere | SRT |
| Download format for YouTube | VTT |
| File too large fix | Compress with HandBrake |
| Improve accuracy | Add words to Custom Vocabulary |

---

*AI Subtitle Generator · Powered by OpenAI Whisper · Documentation v2.0*
