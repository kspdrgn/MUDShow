export type DebugConsoleDirection = 'incoming' | 'outgoing' | 'status';

export interface DebugConsoleEntry {
  id: number;
  timestamp: number;
  direction: DebugConsoleDirection;
  sourceLabel: string;
  text: string;
  lineCount: number;
}

export const DEFAULT_DEBUG_CONSOLE_LINE_LIMIT = 1000;

let nextDebugConsoleEntryId = 0;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function countDebugConsoleLines(rawText: string): number {
  const normalized = rawText.replace(/\r+\n/g, '\n');

  if (!normalized) {
    return 0;
  }

  const breaks = normalized.match(/\n/g)?.length ?? 0;
  return breaks + (normalized.endsWith('\n') ? 0 : 1);
}

export function renderDebugConsoleTextHtml(rawText: string): string {
  let result = '';

  for (const character of rawText) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (character === '\r') {
      result += '<span class="debug-console-control debug-console-control--cr">\\r</span>';
      continue;
    }

    if (character === '\n') {
      result += '<span class="debug-console-control debug-console-control--lf">\\n</span><br>';
      continue;
    }

    if (character === '\t') {
      result += '<span class="debug-console-control debug-console-control--tab">\\t</span>';
      continue;
    }

    if (codePoint === 0x1b) {
      result += '<span class="debug-console-control debug-console-control--escape">\\x1b</span>';
      continue;
    }

    if (codePoint < 32 || codePoint === 127) {
      result += `<span class="debug-console-control">\\x${codePoint.toString(16).padStart(2, '0')}</span>`;
      continue;
    }

    result += escapeHtml(character);
  }

  return result;
}

export function appendDebugConsoleEntry(
  entries: DebugConsoleEntry[],
  entry: Omit<DebugConsoleEntry, 'id' | 'timestamp' | 'lineCount'>,
): DebugConsoleEntry[] {
  const nextEntry: DebugConsoleEntry = {
    ...entry,
    id: nextDebugConsoleEntryId += 1,
    timestamp: Date.now(),
    lineCount: Math.max(1, countDebugConsoleLines(entry.text)),
  };

  return trimDebugConsoleEntries([...entries, nextEntry]);
}

export function trimDebugConsoleEntries(entries: DebugConsoleEntry[]): DebugConsoleEntry[] {
  let totalLines = entries.reduce((sum, entry) => sum + entry.lineCount, 0);
  let trimIndex = 0;

  while (trimIndex < entries.length && totalLines > DEFAULT_DEBUG_CONSOLE_LINE_LIMIT) {
    totalLines -= entries[trimIndex]?.lineCount ?? 0;
    trimIndex += 1;
  }

  return trimIndex > 0 ? entries.slice(trimIndex) : entries;
}

