import { CompletionManager } from './completion';
import { ansiToHtml, applyHighlights, stripTelnet, type HighlightRegex } from './formatting';

export interface TranscriptHistoryEntry {
  text: string;
  lines: number;
}

export function countTranscriptLines(rawText: string): number {
  const text = stripTelnet(rawText).replace(/\r+\n/g, '\n');

  if (!text) {
    return 0;
  }

  const breaks = text.match(/\n/g)?.length ?? 0;
  return breaks + (text.endsWith('\n') ? 0 : 1);
}

export function trimTranscriptHistory(
  entries: TranscriptHistoryEntry[],
  maxLines: number,
): TranscriptHistoryEntry[] {
  if (maxLines <= 0) {
    return [];
  }

  const nextEntries = entries.filter((entry) => entry.lines > 0);
  let totalLines = nextEntries.reduce((sum, entry) => sum + entry.lines, 0);

  while (nextEntries.length > 0 && totalLines > maxLines) {
    totalLines -= nextEntries.shift()?.lines ?? 0;
  }

  return nextEntries;
}

export function appendTranscriptHistory(
  entries: TranscriptHistoryEntry[],
  rawText: string,
  maxLines: number,
): TranscriptHistoryEntry[] {
  if (maxLines <= 0) {
    return [];
  }

  const lines = countTranscriptLines(rawText);
  if (lines <= 0) {
    return entries;
  }

  return trimTranscriptHistory([...entries, { text: rawText, lines }], maxLines);
}

export class PlayTranscript {
  private completion = new CompletionManager();
  private outputEndsWithBr = true;
  private readonly maxChunks = 2000;
  chunks: string[] = [];

  reset(): void {
    this.chunks = [];
    this.outputEndsWithBr = true;
    this.completion.resetCycle();
  }

  loadHistory(entries: TranscriptHistoryEntry[], highlightRegexes: HighlightRegex[]): { chunks: string[]; endsWithBr: boolean } {
    this.reset();

    for (const entry of entries) {
      this.append(entry.text, highlightRegexes);
    }

    return { chunks: this.chunks, endsWithBr: this.outputEndsWithBr };
  }

  harvest(text: string): void {
    this.completion.harvest(text);
  }

  append(rawText: string, highlightRegexes: HighlightRegex[]): { chunks: string[]; endsWithBr: boolean } {
    const text = stripTelnet(rawText).replace(/\r+\n/g, '\n');
    this.completion.harvest(text);

    let html = ansiToHtml(text);
    html = applyHighlights(html, highlightRegexes);

    if (!this.outputEndsWithBr && !html.startsWith('<br>')) {
      html = '<br>' + html;
    }

    this.outputEndsWithBr = /<br>\s*(?:<\/[^>]+>)*\s*$/.test(html);
    this.chunks = [...this.chunks, html];

    if (this.chunks.length > this.maxChunks) {
      this.chunks = this.chunks.slice(-this.maxChunks);
    }

    return { chunks: this.chunks, endsWithBr: this.outputEndsWithBr };
  }

  complete(value: string, selectionStart: number): { value: string; cursor: number } | null {
    return this.completion.complete(value, selectionStart);
  }

  resetCompletion(): void {
    this.completion.resetCycle();
  }
}

export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1100;

    const now = ctx.currentTime;
    const attackSec = 0.2;
    const durationSec = 0.55;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + attackSec);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.start(now);
    osc.stop(now + durationSec);
  } catch {
    // Audio can be blocked until user gesture; ignore quietly.
  }
}
