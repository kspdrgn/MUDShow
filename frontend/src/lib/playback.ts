import { CompletionManager } from './completion';
import { stripTelnet } from './formatting';

/**
 * Rich transcript entry that preserves metadata for re-rendering
 */
export interface RichTranscriptEntry {
  id: string; // Unique identifier for the entry
  text: string;
  lines: number;
  timestamp: number; // Unix timestamp
  type: 'user' | 'system' | 'output' | 'error'; // Entry type for styling and processing
  metadata?: Record<string, any>; // Additional metadata that may be needed for re-rendering
}

export interface TranscriptChunkEntry {
  id: number;
  text: string;
  lineCount: number;
  charCount: number;
  timestamp: number;
}

/**
 * Sliding prefix-sum index for virtual transcript layout.
 *
 * Appending and trimming are amortized O(1); locating a visible range is
 * O(log n). Keeping the removed prefix in place avoids rebuilding all 50,000
 * retained chunks for every incoming message while still allowing occasional
 * compaction of the backing array.
 */
export class TranscriptHeightIndex {
  private readonly heights: number[] = [0];
  private start = 0;
  private ids: number[] = [];

  get length(): number {
    return this.ids.length - this.start;
  }

  get totalHeight(): number {
    return this.heights[this.ids.length] - this.heights[this.start];
  }

  clear(): void {
    this.heights.length = 1;
    this.heights[0] = 0;
    this.ids = [];
    this.start = 0;
  }

  append(id: number, height: number): void {
    const normalizedHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
    const previous = this.heights[this.ids.length] ?? 0;
    this.heights.push(previous + normalizedHeight);
    this.ids.push(id);
  }

  trimFront(count: number): void {
    this.start = Math.min(this.ids.length, this.start + Math.max(0, Math.round(count)));
    this.compactIfNeeded();
  }

  getId(index: number): number | undefined {
    if (index < 0 || index >= this.length) {
      return undefined;
    }

    return this.ids[this.start + index];
  }

  getHeight(index: number): number {
    if (index < 0 || index >= this.length) {
      return 0;
    }

    const absoluteIndex = this.start + index;
    return this.heights[absoluteIndex + 1] - this.heights[absoluteIndex];
  }

  getRange(startOffset: number, viewportHeight: number, overscanPx: number, anchorBottom = false): {
    startIndex: number;
    endIndex: number;
    topSpacer: number;
    bottomSpacer: number;
  } {
    const length = this.length;
    if (length === 0) {
      return { startIndex: 0, endIndex: 0, topSpacer: 0, bottomSpacer: 0 };
    }

    const viewport = Math.max(0, viewportHeight);
    const targetTop = anchorBottom
      ? Math.max(0, this.totalHeight - viewport)
      : Math.max(0, startOffset);
    const visibleStart = Math.max(0, targetTop - Math.max(0, overscanPx));
    const visibleEnd = Math.max(visibleStart + 1, targetTop + viewport + Math.max(0, overscanPx));
    const base = this.heights[this.start];
    const first = Math.max(0, this.upperBound(base + visibleStart) - this.start - 1);
    const last = Math.max(first + 1, this.lowerBound(base + visibleEnd) - this.start);
    const clampedLast = Math.min(length, last);
    const topHeight = this.heights[this.start + first] - base;
    const renderedHeight = this.heights[this.start + clampedLast] - base;

    return {
      startIndex: first,
      endIndex: clampedLast,
      topSpacer: Math.max(0, topHeight),
      bottomSpacer: Math.max(0, this.totalHeight - renderedHeight),
    };
  }

  private lowerBound(value: number): number {
    let low = this.start;
    let high = this.ids.length + 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if ((this.heights[middle] ?? Number.POSITIVE_INFINITY) < value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return Math.min(this.ids.length, low);
  }

  private upperBound(value: number): number {
    let low = this.start;
    let high = this.ids.length + 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if ((this.heights[middle] ?? Number.POSITIVE_INFINITY) <= value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return Math.min(this.ids.length, low);
  }

  private compactIfNeeded(): void {
    if (this.start <= 1024 || this.start * 2 <= this.ids.length) {
      return;
    }

    const base = this.heights[this.start];
    this.heights.splice(0, this.start);
    for (let index = 0; index < this.heights.length; index += 1) {
      this.heights[index] -= base;
    }
    this.ids.splice(0, this.start);
    this.start = 0;
  }
}

export function getTranscriptRangeText(
  transcript: Pick<PlayTranscript, 'getChunkCount' | 'getChunk'>,
  startIndex: number,
  endIndex: number,
): string {
  const count = transcript.getChunkCount();
  const first = Math.max(0, Math.min(startIndex, endIndex));
  const last = Math.min(count - 1, Math.max(startIndex, endIndex));
  if (count === 0 || last < first) {
    return '';
  }

  let text = '';
  for (let index = first; index <= last; index += 1) {
    text += transcript.getChunk(index)?.text ?? '';
  }
  return text;
}

/**
 * Canonical transcript store - keeps all original content with enough state to re-render later
 */
export class CanonicalTranscriptStore {
  private entries: RichTranscriptEntry[] = [];
  private maxEntries: number;
  
  constructor(maxEntries: number = 50000) {
    this.maxEntries = maxEntries;
  }

  getEntries(): RichTranscriptEntry[] {
    return [...this.entries]; // Return a copy
  }

  addEntry(entry: Omit<RichTranscriptEntry, 'id' | 'timestamp'>): void {
    const newEntry: RichTranscriptEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now()
    };
    
    this.entries.push(newEntry);
    
    // Trim if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  updateEntry(id: string, updates: Partial<RichTranscriptEntry>): void {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index !== -1) {
      this.entries[index] = { ...this.entries[index], ...updates };
    }
  }

  removeEntry(id: string): boolean {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter(entry => entry.id !== id);
    return this.entries.length < initialLength;
  }

  clear(): void {
    this.entries = [];
  }

  private generateId(): string {
    // Simple ID generation for now - in production, consider UUIDs or more robust methods
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Hot render cache - keeps recently rendered HTML for fast display
 */
export class RenderCache {
  private cache: Map<string, string> = new Map(); // entryId -> renderedHTML
  private maxEntries: number;
  
  constructor(maxEntries: number = 1000) { // Keep last 1000 rendered entries
    this.maxEntries = maxEntries;
  }

  getEntry(id: string): string | undefined {
    return this.cache.get(id);
  }

  getOrSet(id: string, factory: () => string): string {
    const cached = this.cache.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const value = factory();
    this.setEntry(id, value);
    return value;
  }

  setEntry(id: string, html: string): void {
    // Add to cache
    this.cache.set(id, html);
    
    // If we exceed the limit, remove oldest entries (simple LRU approach)
    if (this.cache.size > this.maxEntries) {
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < keys.length - this.maxEntries; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export interface TranscriptHistoryEntry {
  text: string;
  lines: number;
}

export const DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS = 50000;

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

class ChunkDeque<T> {
  private items: T[] = [];
  private head = 0;
  private count = 0;

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.items = [];
    this.head = 0;
    this.count = 0;
  }

  push(item: T): void {
    this.items[this.head + this.count] = item;
    this.count += 1;
  }

  trimFront(removeCount: number): void {
    if (removeCount <= 0) {
      return;
    }

    this.head += removeCount;
    this.count -= removeCount;

    if (this.count <= 0) {
      this.clear();
      return;
    }

    if (this.head > 1024 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head, this.head + this.count);
      this.head = 0;
    }
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }

    return this.items[this.head + index];
  }

  toArray(): T[] {
    if (this.count <= 0) {
      return [];
    }

    if (this.head === 0) {
      return this.items.slice(0, this.count);
    }

    return this.items.slice(this.head, this.head + this.count);
  }
}

export interface TranscriptSnapshot {
  endsWithBr: boolean;
  chunkCount: number;
}

export class PlayTranscript {
  private completion = new CompletionManager();
  private outputEndsWithBr = true;
  private maxChunks = DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS;
  private nextChunkId = 0;
  private chunks = new ChunkDeque<TranscriptChunkEntry>();

  constructor(maxChunks = DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS) {
    this.setMaxChunks(maxChunks);
  }

  setMaxChunks(maxChunks: number): void {
    this.maxChunks = Math.max(1, Math.round(maxChunks));
    this.trimChunks();
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  getChunk(index: number): TranscriptChunkEntry | undefined {
    return this.chunks.get(index);
  }

  getChunks(): TranscriptChunkEntry[] {
    return this.chunks.toArray();
  }

  getText(): string {
    return this.getChunks().map((chunk) => chunk.text).join('');
  }

  getEndsWithBr(): boolean {
    return this.outputEndsWithBr;
  }

  reset(): void {
    this.chunks.clear();
    this.outputEndsWithBr = true;
    this.nextChunkId = 0;
    this.completion.resetCycle();
  }

  loadHistory(entries: TranscriptHistoryEntry[]): TranscriptSnapshot {
    this.reset();

    for (const entry of entries) {
      this.append(entry.text);
    }

    return this.snapshot();
  }

  harvest(text: string): void {
    this.completion.harvest(text);
  }

  append(rawText: string): void {
    const text = stripTelnet(rawText).replace(/\r+\n/g, '\n');
    this.completion.harvest(text);

    let chunk = text;
    const lineCount = countTranscriptLines(text);

    if (!this.outputEndsWithBr && !chunk.startsWith('\n')) {
      chunk = '\n' + chunk;
    }

    this.outputEndsWithBr = chunk.endsWith('\n');
    this.chunks.push({
      id: this.nextChunkId,
      text: chunk,
      lineCount,
      charCount: chunk.length,
      timestamp: Date.now(),
    });
    this.nextChunkId += 1;
    this.trimChunks();
  }

  private trimChunks(): void {
    const overflow = this.chunks.length - this.maxChunks;
    if (overflow > 0) {
      this.chunks.trimFront(overflow);
    }
  }

  snapshot(): TranscriptSnapshot {
    return {
      endsWithBr: this.outputEndsWithBr,
      chunkCount: this.chunks.length,
    };
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
