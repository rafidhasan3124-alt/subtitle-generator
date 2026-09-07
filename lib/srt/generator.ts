// lib/srt/generator.ts
export interface SRTSubtitle {
  index: number;
  start: number;
  end: number;
  text: string;
}

export class SRTGenerator {
  static generate(subtitles: SRTSubtitle[]): string {
    if (!subtitles || subtitles.length === 0) return '';
    // Each block ends with \n, join('\n') adds the blank line between blocks
    return subtitles
      .map((sub) => {
        const start = this.formatTimestamp(sub.start);
        const end   = this.formatTimestamp(sub.end);
        return `${sub.index}\n${start} --> ${end}\n${sub.text}\n`;
      })
      .join('\n') + '\n'; // final trailing newline for spec compliance
  }

  static formatTimestamp(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h  = Math.floor(seconds / 3600);
    const m  = Math.floor((seconds % 3600) / 60);
    const s  = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  }

  static fromTranscript(
    segments: Array<{ start: number; end: number; text: string }>
  ): SRTSubtitle[] {
    return segments
      .filter((seg) => seg.text && seg.text.trim() !== '')
      .map((seg, i) => ({
        index: i + 1,
        start: Number(seg.start) || 0,
        end:   Number(seg.end)   || 0,
        text:  seg.text.trim(),
      }));
  }

  /** Returns true if the string looks like a valid SRT file */
  static validate(srtContent: string): boolean {
    if (!srtContent || srtContent.trim() === '') return false;
    // Must contain at least one timestamp arrow
    return /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(srtContent);
  }

  static parse(srtContent: string): SRTSubtitle[] {
    const subtitles: SRTSubtitle[] = [];
    if (!srtContent) return subtitles;

    const blocks = srtContent.split(/\n\n+/).filter((b) => b.trim() !== '');

    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      if (lines.length < 3) continue;

      const index = parseInt(lines[0], 10);
      const timeMatch = lines[1].match(
        /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
      );

      if (timeMatch) {
        const start = this.parseTimestamp(timeMatch[1]);
        const end   = this.parseTimestamp(timeMatch[2]);
        const text  = lines.slice(2).join('\n');
        if (isNaN(start) || isNaN(end)) continue;
        subtitles.push({ index: isNaN(index) ? subtitles.length + 1 : index, start, end, text });
      }
    }

    return subtitles;
  }

  /** Parses "HH:MM:SS,mmm" — returns NaN on malformed input instead of crashing */
  static parseTimestamp(timestamp: string): number {
    if (!timestamp || typeof timestamp !== 'string') return NaN;
    const parts = timestamp.split(':');
    if (parts.length !== 3) return NaN;
    const hours   = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const raw     = parts[2];
    if (!raw) return NaN;
    const seconds = parseFloat(raw.replace(',', '.'));
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
  }
}