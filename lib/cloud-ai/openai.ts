// lib/cloud-ai/openai.ts
import { STTProvider, TranscriptResult, TranscribeOptions } from './types';

export class OpenAIProvider implements STTProvider {
  private apiUrl = 'https://api.openai.com/v1/audio/transcriptions';

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('OPENAI_KEY is required');
  }

  async transcribe(audioBuffer: Buffer, options?: TranscribeOptions): Promise<TranscriptResult> {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' });
      formData.append('file', blob, 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');
      if (options?.language && options.language !== 'auto') {
        formData.append('language', options.language);
      }
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const segments = (data.segments || []).map((s: any, i: number) => ({
        start: s.start,
        end: s.end,
        text: (s.text || '').trim(),
        confidence: s.avg_logprob ? Math.exp(s.avg_logprob) : undefined,
      }));

      return {
        language: data.language || options?.language || 'auto',
        text: data.text || '',
        segments,
        duration: data.duration,
      };
    } catch (err: any) {
      throw new Error(`OpenAI transcription failed: ${err.message}`);
    }
  }
}
