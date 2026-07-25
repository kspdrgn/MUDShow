import { invoke } from './tauri';

export interface SpellcheckCursorWord {
  word: string;
  start: number;
  end: number;
}

export interface SpellcheckAnnotation extends SpellcheckCursorWord {}

export interface SpellcheckQueryOptions {
  word: string;
  language: string;
  ignoredWords: string;
  minimumWordLength: number;
  suggestionLimit: number;
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

export function splitSpellcheckIgnoredWords(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function normalizeSpellcheckWord(word: string): string {
  return word
    .trim()
    .replace(/^[^A-Za-z0-9'-]+|[^A-Za-z0-9'-]+$/g, '')
    .replace(/^['-]+|['-]+$/g, '');
}

export function tokenizeSpellcheckWords(text: string): SpellcheckCursorWord[] {
  const words: SpellcheckCursorWord[] = [];
  const wordRegex = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
}

export function escapeSpellcheckHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderSpellcheckUnderlayHtml(text: string, annotations: SpellcheckAnnotation[]): string {
  if (!text) {
    return '';
  }

  const sortedAnnotations = [...annotations].sort((left, right) => left.start - right.start || left.end - right.end);
  const fragments: string[] = [];
  let cursor = 0;

  for (const annotation of sortedAnnotations) {
    const start = Math.max(0, Math.min(annotation.start, text.length));
    const end = Math.max(start, Math.min(annotation.end, text.length));

    if (start > cursor) {
      fragments.push(escapeSpellcheckHtml(text.slice(cursor, start)));
    }

    if (end > cursor) {
      fragments.push(
        `<span class="spellcheck-underlay-word spellcheck-underlay-word--error">${escapeSpellcheckHtml(text.slice(start, end))}</span>`,
      );
      cursor = end;
    }
  }

  if (cursor < text.length) {
    fragments.push(escapeSpellcheckHtml(text.slice(cursor)));
  }

  return fragments.join('');
}

function logSpellcheckCommand(command: string, details: Record<string, unknown>): void {
  console.debug('[spellcheck] command', {
    command,
    ...details,
  });
}

export async function checkSpellcheckWord(options: SpellcheckQueryOptions): Promise<boolean> {
  const word = normalizeSpellcheckWord(options.word);
  if (!word || word.length < options.minimumWordLength) {
    return true;
  }

  logSpellcheckCommand('spellcheck_check', {
    word,
    language: options.language,
    minimumWordLength: options.minimumWordLength,
  });

  return invoke<boolean>('spellcheck_check', {
    language: options.language,
    ignoredWords: options.ignoredWords,
    minimumWordLength: options.minimumWordLength,
    word,
  });
}

export async function suggestSpellcheckWords(options: SpellcheckQueryOptions): Promise<string[]> {
  const word = normalizeSpellcheckWord(options.word);
  if (!word || word.length < options.minimumWordLength) {
    return [];
  }

  logSpellcheckCommand('spellcheck_suggest', {
    word,
    language: options.language,
    minimumWordLength: options.minimumWordLength,
    suggestionLimit: options.suggestionLimit,
  });

  return invoke<string[]>('spellcheck_suggest', {
    language: options.language,
    ignoredWords: options.ignoredWords,
    minimumWordLength: options.minimumWordLength,
    suggestionLimit: options.suggestionLimit,
    word,
  });
}

export async function getSpellcheckSuggestions(options: SpellcheckQueryOptions): Promise<string[]> {
  const isCorrect = await checkSpellcheckWord(options);
  if (isCorrect) {
    return [];
  }

  return suggestSpellcheckWords(options);
}

export async function getSpellcheckAnnotations(options: SpellcheckQueryOptions & { text: string }): Promise<SpellcheckAnnotation[]> {
  const text = options.text;
  if (!text || !options.minimumWordLength || options.minimumWordLength < 1) {
    return [];
  }

  const tokens = tokenizeSpellcheckWords(text);
  const uniqueWords = new Map<string, SpellcheckCursorWord[]>();

  for (const token of tokens) {
    const normalized = normalizeSpellcheckWord(token.word);
    if (!normalized || normalized.length < options.minimumWordLength) {
      continue;
    }

    const key = normalized.toLowerCase();
    const entries = uniqueWords.get(key) ?? [];
    entries.push(token);
    uniqueWords.set(key, entries);
  }

  if (uniqueWords.size === 0) {
    return [];
  }

  const results = new Map<string, boolean>();
  await Promise.all(
    [...uniqueWords.keys()].map(async (word) => {
      results.set(
        word,
        await checkSpellcheckWord({
          ...options,
          word,
        }),
      );
    }),
  );

  const annotations: SpellcheckAnnotation[] = [];
  for (const [word, entries] of uniqueWords.entries()) {
    if (results.get(word) !== false) {
      continue;
    }

    annotations.push(...entries);
  }

  return annotations;
}

export async function addSpellcheckWord(word: string, language: string): Promise<boolean> {
  const normalized = normalizeSpellcheckWord(word);
  if (!normalized) {
    return false;
  }

  logSpellcheckCommand('spellcheck_add', {
    word: normalized,
    language,
  });

  return invoke<boolean>('spellcheck_add', {
    language,
    word: normalized,
  });
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
