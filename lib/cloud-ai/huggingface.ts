// lib/cloud-ai/huggingface.ts
import { STTProvider, TranscriptResult, TranscribeOptions, TranscriptSegment } from './types';

// Map user-facing model names to Hugging Face model IDs
const MODEL_URLS: Record<string, string> = {
  small:  'https://api-inference.huggingface.co/models/openai/whisper-small',
  medium: 'https://api-inference.huggingface.co/models/openai/whisper-medium',
  large:  'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
};

export class HuggingFaceProvider implements STTProvider {
  private maxRetries = 3;

  constructor(private token: string, private model: string = 'small') {
    if (!token) throw new Error('HUGGINGFACE_TOKEN is required');
  }

  private getApiUrl(): string {
    return MODEL_URLS[this.model] ?? MODEL_URLS.small;
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: TranscribeOptions & { prompt?: string; model?: string },
    retryCount = 0
  ): Promise<TranscriptResult> {
    // Allow per-call model override
    const effectiveModel = options?.model ?? this.model;
    const apiUrl = MODEL_URLS[effectiveModel] ?? MODEL_URLS.small;

    try {
      const params = new URLSearchParams({ return_timestamps: 'true' });

      if (options?.language && options.language !== 'auto') {
        params.set('language', options.language);
      }

      // Build request body: send audio bytes + optional initial prompt
      let body: BodyInit = new Uint8Array(audioBuffer);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/octet-stream',
      };

      // If a custom prompt is provided, use JSON input format instead
      if (options?.prompt && options.prompt.trim()) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          inputs: audioBuffer.toString('base64'),
          parameters: {
            return_timestamps: true,
            language: options.language !== 'auto' ? options.language : undefined,
            initial_prompt: options.prompt.trim(),
          },
        });
      }

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        if (response.status === 503 && retryCount < this.maxRetries) {
          const waitMs = (retryCount + 1) * 6000;
          console.log(`[HuggingFace] Model loading, retrying in ${waitMs / 1000}s (attempt ${retryCount + 1}/${this.maxRetries})...`);
          await new Promise((r) => setTimeout(r, waitMs));
          return this.transcribe(audioBuffer, options, retryCount + 1);
        }
        const errorText = await response.text();
        throw new Error(`Hugging Face API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        // Model loading / warming up — retry
        if (typeof data.error === 'string' && data.error.includes('loading') && retryCount < this.maxRetries) {
          const waitMs = (retryCount + 1) * 8000;
          console.log(`[HuggingFace] Model warming up, retrying in ${waitMs / 1000}s...`);
          await new Promise((r) => setTimeout(r, waitMs));
          return this.transcribe(audioBuffer, options, retryCount + 1);
        }
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      const segments = this.extractSegments(data);

      return {
        language: data.language || options?.language || 'auto',
        text: data.text || '',
        segments,
        duration: data.duration || this.calculateDuration(segments),
      };
    } catch (error: any) {
      throw new Error(`Hugging Face transcription failed: ${error.message}`);
    }
  }

  private extractSegments(data: any): TranscriptSegment[] {
    if (data.chunks && Array.isArray(data.chunks)) {
      return data.chunks
        .filter((c: any) => c.text && c.text.trim())
        .map((c: any) => ({
          start: c.timestamp?.[0] ?? 0,
          end: c.timestamp?.[1] ?? 0,
          text: c.text.trim(),
        }));
    }
    if (data.text) {
      return [{ start: 0, end: data.duration || 0, text: data.text.trim() }];
    }
    return [];
  }

  private calculateDuration(segments: TranscriptSegment[]): number {
    if (!segments.length) return 0;
    return segments[segments.length - 1].end;
  }
}