// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000')
  ),
  title: 'AI Subtitle & SRT Generator — বাংলা & English',
  description:
    'Upload any video or audio file and get AI-generated Bengali & English subtitles with SRT/VTT download. Powered by OpenAI Whisper via Hugging Face.',
  keywords: [
    'subtitle generator',
    'Bengali subtitles',
    'SRT generator',
    'AI transcription',
    'বাংলা সাবটাইটেল',
    'Whisper AI',
    'SRT download',
  ],
  openGraph: {
    title: 'AI Subtitle & SRT Generator',
    description: 'Generate perfect Bengali & English subtitles from any video or audio file.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070b14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-BD" className={inter.variable}>
      <body className={`antialiased ${inter.className}`}>{children}</body>
    </html>
  );
}