// lib/cloud-ai/assemblyai.ts
import { STTProvider, TranscriptResult, TranscribeOptions } from './types';

export class AssemblyAIProvider implements STTProvider {
  private apiUrl = 'https://api.assemblyai.com/v2';
  
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_KEY is required');
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: TranscribeOptions
  ): Promise<TranscriptResult> {
    try {
      // 1. Upload audio
      const uploadUrl = await this.uploadAudio(audioBuffer);
      
      // 2. Start transcription
      const transcriptId = await this.startTranscription(uploadUrl, options);
      
      // 3. Poll for completion
      const result = await this.pollTranscription(transcriptId);
      
      // 4. Format results
      return this.formatResult(result);
      
    } catch (error: any) {
      throw new Error(`AssemblyAI transcription failed: ${error.message}`);
    }
  }

  private async uploadAudio(buffer: Buffer): Promise<string> {
    const response = await fetch(`${this.apiUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    return data.upload_url;
  }

  private async startTranscription(
    audioUrl: string,
    options?: TranscribeOptions
  ): Promise<string> {
    const response = await fetch(`${this.apiUrl}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: options?.language || 'bn',
        punctuate: options?.punctuation !== false,
        format_text: options?.formatText !== false,
        speaker_labels: false,
        utterances: true,
        utterances_gap: 0.5,
        confidence_threshold: 0.6,
        word_boost: ['বাংলা', 'Bangla', 'ঢাকা', 'Dhaka'],
        boost_param: 'high',
      }),
    });

    if (!response.ok) {
      throw new Error(`Start transcription failed: ${response.status}`);
    }

    const data = await response.json();
    return data.id;
  }

  private async pollTranscription(
    id: string,
    maxAttempts = 120,
    interval = 1000
  ): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${this.apiUrl}/transcript/${id}`, {
        headers: { 'Authorization': this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'completed') {
        return data;
      }

      if (data.status === 'failed') {
        throw new Error(data.error || 'Transcription failed');
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Transcription timeout');
  }

  private formatResult(result: any): TranscriptResult {
    return {
      language: result.language_code || 'bn',
      text: result.text || '',
      segments: result.utterances?.map((utt: any) => ({
        start: utt.start / 1000,
        end: utt.end / 1000,
        text: utt.text,
        confidence: utt.confidence,
        speaker: utt.speaker,
      })) || [],
      duration: result.audio_duration,
      confidence: result.confidence,
    };
  }
}