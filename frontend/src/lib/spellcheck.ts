export interface SpellcheckCursorWord {
  word: string;
  start: number;
  end: number;
}

export function normalizeSpellcheckIgnoredWords(raw: string): string {
  const words: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    words.push(trimmed);
  }

  return words.join(', ');
}

export function appendSpellcheckIgnoredWord(raw: string, word: string): string {
  const trimmedWord = word.trim();
  if (!trimmedWord) {
    return normalizeSpellcheckIgnoredWords(raw);
  }

  const nextWords = raw ? raw.split(',') : [];
  const nextNormalized = new Set(nextWords.map((entry) => entry.trim().toLowerCase()));

  if (!nextNormalized.has(trimmedWord.toLowerCase())) {
    nextWords.push(trimmedWord);
  }

  return normalizeSpellcheckIgnoredWords(nextWords.join(','));
}

export function getWordBounds(text: string, selectionStart: number, selectionEnd: number): SpellcheckCursorWord | null {
  if (!text) {
    return null;
  }

  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(0, Math.min(selectionEnd, text.length));
  const selectedText = text.slice(start, end).trim();
  if (selectedText) {
    return {
      word: selectedText,
      start,
      end,
    };
  }

  const wordRegex = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const wordStart = match.index;
    const wordEnd = wordStart + match[0].length;

    if (start >= wordStart && start <= wordEnd) {
      return {
        word: match[0],
        start: wordStart,
        end: wordEnd,
      };
    }
  }

  return null;
}

