'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: string;
}

interface SubtitleEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  language?: string;
  duration?: number;
  error?: string;
  srtContent?: string;
  subtitles?: SubtitleEntry[];
}

interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  description: string;
  freeInfo: string;
  signupUrl: string;
  envKey: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '🌐 Auto Detect',   desc: 'বাংলা + English মিশ্র' },
  { value: 'bn',   label: '🇧🇩 বাংলা',         desc: 'Bengali only' },
  { value: 'en',   label: '🇬🇧 English',        desc: 'English only' },
  { value: 'hi',   label: '🇮🇳 Hindi',          desc: 'हिंदी' },
  { value: 'ur',   label: '🇵🇰 Urdu',           desc: 'اردو' },
  { value: 'ar',   label: '🇸🇦 Arabic',         desc: 'العربية' },
  { value: 'fr',   label: '🇫🇷 French',         desc: 'Français' },
  { value: 'de',   label: '🇩🇪 German',         desc: 'Deutsch' },
  { value: 'es',   label: '🇪🇸 Spanish',        desc: 'Español' },
  { value: 'zh',   label: '🇨🇳 Chinese',        desc: '中文' },
  { value: 'ja',   label: '🇯🇵 Japanese',       desc: '日本語' },
  { value: 'ko',   label: '🇰🇷 Korean',         desc: '한국어' },
  { value: 'pt',   label: '🇧🇷 Portuguese',     desc: 'Português' },
  { value: 'ru',   label: '🇷🇺 Russian',        desc: 'Русский' },
  { value: 'tr',   label: '🇹🇷 Turkish',        desc: 'Türkçe' },
  { value: 'it',   label: '🇮🇹 Italian',        desc: 'Italiano' },
];

const MODEL_OPTIONS = [
  { value: 'small',  label: '⚡ Whisper Small',   badge: 'Fast',        color: '#059669', desc: 'Best for most videos — fast & accurate' },
  { value: 'medium', label: '🎯 Whisper Medium',  badge: 'Balanced',    color: '#d97706', desc: 'Better for noisy audio or strong accents' },
  { value: 'large',  label: '👑 Whisper Large-v3',badge: 'Max Quality', color: '#7c3aed', desc: 'Maximum accuracy — slower processing' },
];

const QUICK_TAGS = ['ভিডিও এডিটিং', 'সাবটাইটেল', 'টাইমস্ট্যাম্প', 'Premiere Pro', 'CapCut', 'DaVinci Resolve', 'YouTube'];

const PROVIDER_ICONS: Record<string, string> = {
  huggingface: '🤗',
  assemblyai:  '🔬',
  deepgram:    '🎙️',
  openai:      '✨',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

function toSRTTime(s: number) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sc)},${pad(ms, 3)}`;
}

function buildSRT(subs: SubtitleEntry[]) {
  return subs.map((s) => `${s.index}\n${toSRTTime(s.startTime)} --> ${toSRTTime(s.endTime)}\n${s.text}\n`).join('\n');
}

function buildVTT(subs: SubtitleEntry[]) {
  return 'WEBVTT\n\n' + subs.map((s) =>
    `${s.index}\n${toSRTTime(s.startTime).replace(',', '.')} --> ${toSRTTime(s.endTime).replace(',', '.')}\n${s.text}\n`
  ).join('\n');
}

function download(content: string, name: string, mime: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: name,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Components ───────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'info' | 'warning'; onClose: () => void }) {
  const colors = {
    error:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',  icon: '⚠️', title: 'Something went wrong' },
    warning: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', icon: '🔑', title: 'Action Required' },
    info:    { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)', icon: 'ℹ️', title: 'Info' },
  }[type];
  return (
    <div
      className="mb-6 p-4 rounded-2xl flex items-start gap-3 animate-fade-in"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <span className="text-xl flex-shrink-0">{colors.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm mb-1" style={{ color: type === 'error' ? '#fca5a5' : type === 'warning' ? '#fcd34d' : '#a5b4fc' }}>
          {colors.title}
        </p>
        <p className="text-xs break-words leading-relaxed" style={{ color: type === 'error' ? '#fecaca' : type === 'warning' ? '#fef3c7' : '#c7d2fe' }}>
          {message}
        </p>
      </div>
      <button onClick={onClose} className="flex-shrink-0 text-lg opacity-50 hover:opacity-100 transition-opacity">✕</button>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: '#0f172a', height: 8, border: '1px solid #1e293b' }}>
      <div
        style={{
          width: `${Math.min(Math.max(value, 0), 100)}%`,
          background: 'linear-gradient(90deg,#4f46e5,#7c3aed,#a855f7)',
          height: '100%',
          borderRadius: 99,
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Upload', 'Processing', 'Download'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8 select-none">
      {steps.map((label, i) => {
        const n = i + 1;
        const done   = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all"
                style={{
                  background: done ? 'linear-gradient(135deg,#059669,#10b981)' : active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#1e293b',
                  color: '#fff',
                  boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.25)' : 'none',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span className="text-xs font-semibold hidden sm:block" style={{ color: active ? '#a5b4fc' : done ? '#34d399' : '#475569' }}>
                {label}
              </span>
            </div>
            {i < 2 && <div className="w-6 h-px hidden sm:block" style={{ background: done ? '#10b981' : '#1e293b' }} />}
          </div>
        );
      })}
    </div>
  );
}

// Provider card component
function ProviderCard({
  provider, selected, onSelect,
}: { provider: ProviderStatus; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      id={`provider-${provider.id}`}
      onClick={onSelect}
      className="flex items-start gap-3 w-full text-left rounded-xl px-4 py-3 transition-all"
      style={{
        background:  selected ? 'rgba(79,70,229,0.15)' : '#0a1120',
        border:      `1px solid ${selected ? '#6366f1' : '#1e293b'}`,
        boxShadow:   selected ? '0 0 0 1px rgba(99,102,241,0.25)' : 'none',
        cursor:      provider.configured ? 'pointer' : 'pointer',
        opacity:     1,
      }}
    >
      {/* Radio */}
      <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
        style={{ borderColor: selected ? '#6366f1' : '#334155' }}>
        {selected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>
            {PROVIDER_ICONS[provider.id]} {provider.name}
          </span>
          {provider.configured ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
              ✓ Ready
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              🔑 Token not added
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold ml-auto"
            style={{ background: '#0f172a', color: '#64748b', border: '1px solid #1e293b' }}>
            {provider.freeInfo}
          </span>
        </div>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#475569' }}>{provider.description}</p>
        {!provider.configured && (
          <p className="text-[10px] mt-1.5 font-semibold" style={{ color: '#94a3b8' }}>
            Add <code className="px-1 py-0.5 rounded" style={{ background: '#0f172a', color: '#818cf8' }}>{provider.envKey}</code> in Netlify Environment Variables (or .env.local) •{' '}
            <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer"
              className="underline hover:text-indigo-400 transition-colors" style={{ color: '#818cf8' }}>
              Get free API key →
            </a>
          </p>
        )}
      </div>
    </button>
  );
}

// Model selector
function ModelCard({ opt, selected, onSelect }: { opt: typeof MODEL_OPTIONS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" id={`model-${opt.value}`} onClick={onSelect}
      className="flex items-center gap-3 w-full text-left rounded-xl px-4 py-3 transition-all"
      style={{
        background: selected ? 'rgba(79,70,229,0.15)' : '#0a1120',
        border: `1px solid ${selected ? '#6366f1' : '#1e293b'}`,
        boxShadow: selected ? '0 0 0 1px rgba(99,102,241,0.2)' : 'none',
      }}>
      <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
        style={{ borderColor: selected ? '#6366f1' : '#334155' }}>
        {selected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>{opt.label}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{ background: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}44` }}>
            {opt.badge}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{opt.desc}</p>
      </div>
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [file,               setFile]               = useState<File | null>(null);
  const [uploadedFile,       setUploadedFile]        = useState<UploadedFile | null>(null);
  const [jobId,              setJobId]               = useState<string | null>(null);
  const [jobStatus,          setJobStatus]           = useState<JobStatus | null>(null);
  const [editableSubs,       setEditableSubs]        = useState<SubtitleEntry[]>([]);
  const [providers,          setProviders]           = useState<ProviderStatus[]>([]);
  const [providersLoading,   setProvidersLoading]    = useState(true);

  const [language,      setLanguage]     = useState('auto');
  const [model,         setModel]        = useState('small');
  const [aiProvider,    setAiProvider]   = useState('huggingface');
  const [customPrompt,  setCustomPrompt] = useState('ভিডিও এডিটিং, সাবটাইটেল, Premiere Pro, CapCut');

  const [isUploading,   setIsUploading]  = useState(false);
  const [isProcessing,  setIsProcessing] = useState(false);
  const [uploadPct,     setUploadPct]    = useState(0);
  const [processPct,    setProcessPct]   = useState(0);
  const [error,         setError]        = useState<string | null>(null);
  const [errorType,     setErrorType]    = useState<'error' | 'warning'>('error');
  const [copied,        setCopied]       = useState(false);
  const [settingsOpen,  setSettingsOpen] = useState(true);
  const [dots,          setDots]         = useState('');

  // Animated dots during processing
  useEffect(() => {
    if (!isUploading && !isProcessing) return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, [isUploading, isProcessing]);

  // Load provider statuses on mount
  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) setProviders(data.providers);
      })
      .catch(() => {})
      .finally(() => setProvidersLoading(false));
  }, []);

  const step: 1 | 2 | 3 = jobStatus?.status === 'completed' ? 3 : (isUploading || isProcessing) ? 2 : 1;
  const busy = isUploading || isProcessing;
  const subs = editableSubs.length ? editableSubs : (jobStatus?.subtitles || []);

  const showError = (msg: string, type: 'error' | 'warning' = 'error') => {
    setError(msg);
    setErrorType(type);
  };

  const resetAll = useCallback(() => {
    setFile(null); setUploadedFile(null); setJobId(null); setJobStatus(null);
    setEditableSubs([]); setIsUploading(false); setIsProcessing(false);
    setUploadPct(0); setProcessPct(0); setError(null); setCopied(false);
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (f: File): Promise<string> => {
    setIsUploading(true);
    setUploadPct(5);
    const fd = new FormData();
    fd.append('file', f);
    fd.append('userId', 'anonymous');

    const tick = setInterval(() => setUploadPct((p) => Math.min(p + 10, 85)), 250);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      clearInterval(tick);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Upload failed. Please try again.');
      }
      setUploadPct(100);
      const d = await res.json();
      setUploadedFile(d.file);
      return d.file.id as string;
    } catch (e: any) {
      clearInterval(tick);
      throw e;
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Poll status ────────────────────────────────────────────────────────────
  const pollStatus = useCallback(async (id: string) => {
    let attempts = 0;
    const MAX = 360;
    const poll = async (): Promise<void> => {
      if (attempts >= MAX) {
        showError('Processing timed out after 12 minutes. Please try a shorter file or try again.');
        setIsProcessing(false);
        return;
      }
      try {
        const res = await fetch(`/api/subtitles/${id}`);
        if (!res.ok) throw new Error('Could not check processing status. Please wait.');
        const data: JobStatus = await res.json();
        setJobStatus(data);
        if (data.status === 'completed') {
          setProcessPct(100);
          setIsProcessing(false);
          if (data.subtitles) setEditableSubs(data.subtitles);
          return;
        }
        if (data.status === 'failed') {
          const msg = data.error || 'Transcription failed.';
          // Detect token-not-configured errors surfaced via job failure
          if (msg.includes('TOKEN_NOT_CONFIGURED')) {
            showError('The selected AI provider token is not configured. Please choose a different provider or add the API key to .env.local.', 'warning');
          } else {
            showError(msg);
          }
          setIsProcessing(false);
          return;
        }
        setProcessPct(Math.min(5 + (attempts / MAX) * 85, 90));
        attempts++;
        await new Promise((r) => setTimeout(r, 2500));
        return poll();
      } catch (e: any) {
        showError(e.message || 'Network error while checking status.');
        setIsProcessing(false);
      }
    };
    return poll();
  }, []);

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    setProcessPct(5);

    try {
      const fileId = await uploadFile(file);

      const res = await fetch('/api/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, language, model, prompt: customPrompt, aiProvider }),
      });

      const data = await res.json();

      // ── Token not configured ──
      if (res.status === 402 || data.error === 'TOKEN_NOT_CONFIGURED') {
        setIsProcessing(false);
        showError(
          `🔑 ${data.providerName || 'Selected provider'} API key is not added yet.\n\nTo use this provider, add ${data.envKey || 'the API key'} in your Netlify Environment Variables (or .env.local for local development).\n\nGet a free key at: ${data.signupUrl || 'the provider website'}.\n\nYou can use Hugging Face for free — it's already configured ✅`,
          'warning'
        );
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start subtitle generation.');
      }

      const id = data.subtitleId || data.id;
      setJobId(id);

      if (data.status === 'completed' && data.subtitles) {
        setJobStatus(data);
        setEditableSubs(data.subtitles);
        setProcessPct(100);
        setIsProcessing(false);
        return;
      }

      pollStatus(id);
    } catch (e: any) {
      setIsProcessing(false);
      showError(e.message || 'Unexpected error. Please try again.');
    }
  }, [file, language, model, customPrompt, aiProvider, uploadFile, pollStatus]);

  // ── Dropzone ───────────────────────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((accepted: File[]) => {
      if (accepted.length) { setFile(accepted[0]); setError(null); }
    }, []),
    onDropRejected: (rej) => {
      const reason = rej[0]?.errors[0]?.code;
      if (reason === 'file-too-large')   showError('File is too large. Maximum size is 500 MB.');
      else if (reason === 'file-invalid-type') showError('File type not supported. Please upload MP4, MP3, WAV, M4A, MKV, MOV, or WebM.');
      else showError('File rejected. Please try a different file.');
    },
    accept: { 'audio/*': ['.mp3','.wav','.m4a','.ogg'], 'video/*': ['.mp4','.mov','.webm','.mkv'] },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
    disabled: busy,
  });

  const addTag = (t: string) => {
    if (!customPrompt.includes(t)) setCustomPrompt((p) => p ? `${p}, ${t}` : t);
  };

  const fname = file?.name.replace(/\.[^.]+$/, '') || 'subtitles';
  const copySRT = async () => {
    await navigator.clipboard.writeText(buildSRT(subs));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen selection:bg-indigo-500 selection:text-white"
      style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(79,70,229,0.1) 0%, #070b14 55%)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#a5b4fc' }}>
              AI-Powered Speech Recognition
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-4">
            <span style={{ color: '#fff' }}>🎬 AI </span>
            <span className="gradient-text">Subtitle</span>
            <span style={{ color: '#fff' }}> Generator</span>
          </h1>
          <p className="text-base max-w-lg mx-auto leading-relaxed" style={{ color: '#64748b' }}>
            যেকোনো ভিডিও বা অডিও থেকে{' '}
            <span style={{ color: '#818cf8' }} className="font-bold">বাংলা</span> ও{' '}
            <span style={{ color: '#34d399' }} className="font-bold">English</span> সাবটাইটেল তৈরি করুন
          </p>
        </header>

        {/* ── MAIN CARD ───────────────────────────────────────────────────── */}
        <div className="rounded-3xl p-5 md:p-7"
          style={{
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px -16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>

          <StepIndicator step={step} />

          {/* Error / warning toast */}
          {error && (
            <Toast
              message={error}
              type={errorType}
              onClose={() => setError(null)}
            />
          )}

          {/* ── IDLE STATE ────────────────────────────────────────────────── */}
          {!busy && step !== 3 && (
            <div className="space-y-4">

              {/* Dropzone */}
              <div
                {...getRootProps()}
                id="dropzone"
                className="rounded-2xl border-2 border-dashed cursor-pointer transition-all"
                style={{
                  background:   isDragActive ? 'rgba(99,102,241,0.1)' : file ? 'rgba(16,185,129,0.07)' : 'rgba(15,23,42,0.4)',
                  borderColor:  isDragActive ? '#6366f1' : file ? '#10b981' : '#1e293b',
                  padding:      file ? '1.25rem' : '2.5rem 1.5rem',
                }}
              >
                <input {...getInputProps()} id="file-input" />
                {file ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      📹
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold truncate text-sm" style={{ color: '#fff' }}>{file.name}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: '#34d399' }}>{fmtBytes(file.size)}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>✅ Ready • click to change</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
                      style={{ background: '#1e293b', color: '#94a3b8' }} title="Remove">✕</button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="text-5xl animate-float">{isDragActive ? '📂' : '📁'}</div>
                    <div>
                      <p className="text-lg font-extrabold mb-1" style={{ color: '#fff' }}>
                        {isDragActive ? 'Drop it here!' : 'Click to Browse or Drag & Drop'}
                      </p>
                      <p className="text-sm" style={{ color: '#475569' }}>
                        MP4, MP3, WAV, M4A, MKV, MOV, WebM up to <strong style={{ color: '#a5b4fc' }}>500 MB</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── SETTINGS PANEL ────────────────────────────────────────── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>

                {/* Settings toggle */}
                <button type="button" id="settings-toggle" onClick={() => setSettingsOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                  style={{ background: '#0a1120' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚙️</span>
                    <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>AI Settings & Language</span>
                    {!providersLoading && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                        {providers.filter((p) => p.configured).length}/{providers.length} providers ready
                      </span>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: settingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Settings body — always rendered, just hidden when collapsed */}
                <div style={{
                  display: settingsOpen ? 'block' : 'none',
                  borderTop: '1px solid #1e293b',
                  background: 'rgba(7,11,20,0.8)',
                }}>
                  <div className="p-5 space-y-6">

                    {/* ── AI PROVIDER ─────────────────────────────────────── */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
                        🤖 AI Provider
                      </p>
                      {providersLoading ? (
                        <div className="flex items-center gap-2 py-4" style={{ color: '#475569' }}>
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                          <span className="text-sm">Loading providers...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {providers.map((p) => (
                            <ProviderCard
                              key={p.id}
                              provider={p}
                              selected={aiProvider === p.id}
                              onSelect={() => setAiProvider(p.id)}
                            />
                          ))}
                        </div>
                      )}
                      {/* Unconfigured provider warning */}
                      {!providersLoading && providers.find((p) => p.id === aiProvider && !p.configured) && (
                        <div className="mt-3 p-3 rounded-xl flex items-start gap-2"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                          <span className="text-base flex-shrink-0">🔑</span>
                          <div>
                            <p className="text-xs font-bold mb-0.5" style={{ color: '#fcd34d' }}>Token not added</p>
                            <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                              This provider is selected but its API key is missing.
                              You can still select it, but generating will not work until you add the token to <code style={{ color: '#fbbf24' }}>.env.local</code>.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── LANGUAGE & MODEL ─────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Language */}
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>🌐 Language</p>
                        <div className="relative">
                          <select
                            id="language-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full appearance-none rounded-xl px-4 py-3 pr-9 text-sm font-semibold outline-none"
                            style={{ background: '#0a1120', color: '#f1f5f9', border: '1px solid #1e293b', cursor: 'pointer' }}
                            onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                            onBlur={(e) => (e.target.style.borderColor = '#1e293b')}
                          >
                            {LANGUAGE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} style={{ background: '#0f172a' }}>
                                {o.label} — {o.desc}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: '#334155' }}>
                          বাংলা+English মিক্সড হলে Auto Detect বেছে নিন
                        </p>
                      </div>

                      {/* Model */}
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>🧠 Whisper Model</p>
                        <div className="space-y-1.5">
                          {MODEL_OPTIONS.map((o) => (
                            <ModelCard key={o.value} opt={o} selected={model === o.value} onSelect={() => setModel(o.value)} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── CUSTOM VOCABULARY ────────────────────────────────── */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>
                        📝 Custom Vocabulary
                      </p>
                      <p className="text-xs mb-2" style={{ color: '#334155' }}>
                        বিশেষ শব্দ বা টেকনিক্যাল টার্ম লিখুন — AI সঠিকভাবে চিনবে
                      </p>
                      <textarea
                        id="custom-prompt"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all"
                        style={{ background: '#0a1120', color: '#f1f5f9', border: '1px solid #1e293b' }}
                        placeholder="e.g. ভিডিও এডিটিং, Premiere Pro, CapCut"
                        onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                        onBlur={(e) => (e.target.style.borderColor = '#1e293b')}
                      />
                      <div className="flex flex-wrap gap-2 mt-2 items-center">
                        <span className="text-xs" style={{ color: '#334155' }}>Quick add:</span>
                        {QUICK_TAGS.map((t) => {
                          const active = customPrompt.includes(t);
                          return (
                            <button key={t} type="button" onClick={() => addTag(t)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                              style={{
                                background: active ? 'rgba(79,70,229,0.2)' : '#0f172a',
                                color:      active ? '#a5b4fc' : '#64748b',
                                border:     `1px solid ${active ? '#4338ca' : '#1e293b'}`,
                              }}>
                              {active ? '✓' : '+'} {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* ── GENERATE BUTTON ──────────────────────────────────────── */}
              <button
                id="generate-btn"
                onClick={generate}
                disabled={!file}
                className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: file ? 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#9333ea 100%)' : '#1e293b',
                  color:      file ? '#fff' : '#334155',
                  boxShadow:  file ? '0 16px 40px -8px rgba(79,70,229,0.45)' : 'none',
                  cursor:     file ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={(e) => { if (file) e.currentTarget.style.transform = 'scale(1.015)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {file
                  ? <>🚀 Generate Subtitles — সাবটাইটেল তৈরি করুন</>
                  : <>📁 Upload a file above to get started</>}
              </button>

            </div>
          )}

          {/* ── PROCESSING STATE ────────────────────────────────────────────── */}
          {busy && (
            <div className="py-10 text-center space-y-5 max-w-sm mx-auto">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.35)', animation: 'pulse 2s ease-in-out infinite' }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  {isUploading ? '📤' : '🧠'}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black mb-1" style={{ color: '#fff' }}>
                  {isUploading ? `Uploading${dots}` : `AI Processing${dots}`}
                </h3>
                <p className="text-xs font-semibold truncate" style={{ color: '#818cf8' }}>{file?.name}</p>
              </div>
              <div className="space-y-1.5">
                <ProgressBar value={isUploading ? uploadPct : processPct} />
                <div className="flex justify-between text-xs font-semibold" style={{ color: '#475569' }}>
                  <span>{isUploading ? 'Uploading file...' : `Running ${PROVIDER_ICONS[aiProvider] || '🤖'} Whisper AI...`}</span>
                  <span>{Math.round(isUploading ? uploadPct : processPct)}%</span>
                </div>
              </div>
              {isProcessing && (
                <div className="text-xs text-left p-4 rounded-xl space-y-1" style={{ background: '#0a1120', border: '1px solid #1e293b', color: '#475569' }}>
                  <p>🎙️ Extracting audio from media file</p>
                  <p>🤖 Running {MODEL_OPTIONS.find((m) => m.value === model)?.label} speech recognition</p>
                  <p>📝 Generating subtitle timestamps</p>
                  <p className="pt-1" style={{ color: '#334155' }}>⏳ Usually takes 30 sec – 3 min</p>
                </div>
              )}
              <button onClick={resetAll}
                className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                style={{ color: '#475569', border: '1px solid #1e293b', background: 'transparent' }}>
                Cancel & Start Over
              </button>
            </div>
          )}

          {/* ── RESULT STATE ────────────────────────────────────────────────── */}
          {step === 3 && jobStatus?.status === 'completed' && (
            <div className="space-y-4">

              {/* Success bar */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg">🎉</span>
                      <span className="font-black text-sm" style={{ color: '#6ee7b7' }}>Subtitles Generated!</span>
                    </div>
                    <p className="text-xs" style={{ color: '#a7f3d0' }}>
                      {subs.length} segments
                      {jobStatus.language ? ` • Language: ${jobStatus.language}` : ''}
                      {jobStatus.duration ? ` • ${Math.round(jobStatus.duration)}s` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button id="copy-srt-btn" onClick={copySRT}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                      style={{ background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }}>
                      {copied ? '✓ Copied!' : '📋 Copy SRT'}
                    </button>
                    <button id="download-vtt-btn" onClick={() => download(buildVTT(subs), `${fname}.vtt`, 'text/vtt')}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(49,46,129,0.5)', color: '#e0e7ff', border: '1px solid #4338ca' }}>
                      📄 VTT
                    </button>
                    <button id="download-srt-btn" onClick={() => download(buildSRT(subs), `${fname}.srt`, 'text/plain')}
                      className="px-4 py-2 rounded-xl text-xs font-black transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', boxShadow: '0 8px 24px -4px rgba(5,150,105,0.4)' }}>
                      ⬇️ Download SRT
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ background: '#0a1120', borderBottom: '1px solid #1e293b' }}>
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                    ✏️ Subtitle Editor <span className="font-normal" style={{ color: '#334155' }}>({subs.length})</span>
                  </span>
                  <span className="text-xs" style={{ color: '#334155' }}>Click text to edit</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 420, background: '#070b14' }}>
                  {subs.map((item, idx) => (
                    <div key={item.index}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.015]"
                      style={{ borderBottom: idx < subs.length - 1 ? '1px solid #0f172a' : 'none' }}>
                      <div className="text-xs font-mono px-2.5 py-1.5 rounded-lg flex-shrink-0 whitespace-nowrap"
                        style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#6366f1' }}>
                        <span style={{ color: '#334155' }}>#{item.index} </span>
                        {toSRTTime(item.startTime)} <span style={{ color: '#334155' }}>→</span> {toSRTTime(item.endTime)}
                      </div>
                      <input
                        id={`sub-${item.index}`}
                        type="text"
                        value={item.text}
                        onChange={(e) => setEditableSubs((prev) =>
                          prev.map((s) => s.index === item.index ? { ...s, text: e.target.value } : s)
                        )}
                        className="flex-1 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                        style={{ background: '#0a1120', color: '#f1f5f9', border: '1px solid #1e293b' }}
                        onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                        onBlur={(e) => (e.target.style.borderColor = '#1e293b')}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button id="process-another-btn" onClick={resetAll}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                  style={{ background: '#0f172a', color: '#64748b', border: '1px solid #1e293b' }}>
                  🔄 Process Another File
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── FEATURE STRIP ───────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: '🤗', t: 'Hugging Face',    d: '100% free Whisper AI — no credit card' },
            { icon: '🇧🇩', t: 'Bangla Ready',    d: 'Custom vocab for Banglish content' },
            { icon: '🎬', t: 'SRT & VTT',        d: 'Works with Premiere, CapCut, YouTube' },
          ].map(({ icon, t, d }) => (
            <div key={t} className="rounded-2xl p-4 text-center transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-xs font-bold mb-0.5" style={{ color: '#e2e8f0' }}>{t}</p>
              <p className="text-[11px] leading-snug" style={{ color: '#475569' }}>{d}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#1e293b' }}>
          AI Subtitle Generator · Powered by OpenAI Whisper
        </p>
      </div>
    </div>
  );
}