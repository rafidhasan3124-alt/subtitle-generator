// lib/cloud-ai/deepgram.ts
import { STTProvider, TranscriptResult, TranscribeOptions } from './types';

export class DeepgramProvider implements STTProvider {
  private apiUrl = 'https://api.deepgram.com/v1/listen';
  
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('DEEPGRAM_KEY is required');
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: TranscribeOptions
  ): Promise<TranscriptResult> {
    try {
      const params = new URLSearchParams({
        model: 'nova-2',
        smart_format: 'true',
        punctuate: 'true',
      });

      if (options?.language && options.language !== 'auto') {
        params.set('language', options.language);
      } else {
        params.set('detect_language', 'true');
      }

      const response = await fetch(`${this.apiUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(audioBuffer),
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();
      
      // Extract results
      const channel = data.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      
      if (!alternative) {
        throw new Error('No transcription result found');
      }

      // Extract segments from words
      const segments = this.extractSegments(alternative.words || []);
      
      return {
        language: data.metadata?.language || options?.language || 'auto',
        text: alternative.transcript || '',
        segments: segments,
        duration: data.metadata?.duration || 0,
        confidence: alternative.confidence,
      };
      
    } catch (error: any) {
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }
  }

  private extractSegments(words: any[]): Array<{start: number; end: number; text: string}> {
    if (!words || words.length === 0) {
      return [];
    }

    const segments: Array<{start: number; end: number; text: string}> = [];
    let currentSegment = {
      start: words[0].start,
      end: words[0].end,
      words: [words[0].word],
    };

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1];
      
      // If gap is less than 0.5 seconds, keep in same segment
      if (word.start - prevWord.end < 0.5) {
        currentSegment.end = word.end;
        currentSegment.words.push(word.word);
      } else {
        // Push current segment
        segments.push({
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.words.join(' '),
        });
        
        // Start new segment
        currentSegment = {
          start: word.start,
          end: word.end,
          words: [word.word],
        };
      }
    }

    // Push last segment
    if (currentSegment.words.length > 0) {
      segments.push({
        start: currentSegment.start,
        end: currentSegment.end,
        text: currentSegment.words.join(' '),
      });
    }

    return segments;
  }
}