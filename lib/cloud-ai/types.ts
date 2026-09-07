export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
}

export interface TranscriptResult {
  language: string;
  text: string;
  segments: TranscriptSegment[];
  duration?: number;
  confidence?: number;
}

export interface STTProvider {
  transcribe(
    audioBuffer: Buffer, 
    options?: TranscribeOptions
  ): Promise<TranscriptResult>;
}

export interface TranscribeOptions {
  language?: string;
  detectLanguage?: boolean;
  punctuation?: boolean;
  formatText?: boolean;
  prompt?: string;
}

export type AIProviderType = 'huggingface' | 'assemblyai' | 'deepgram' | 'openai';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  options?: Record<string, any>;
}