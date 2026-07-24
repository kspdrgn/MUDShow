import { invoke } from './tauri';

export interface SpellcheckCursorWord {
  word: string;
  start: number;
  end: number;
}

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

export async function checkSpellcheckWord(options: SpellcheckQueryOptions): Promise<boolean> {
  const word = normalizeSpellcheckWord(options.word);
  if (!word || word.length < options.minimumWordLength) {
    return true;
  }

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

export async function addSpellcheckWord(word: string, language: string): Promise<boolean> {
  const normalized = normalizeSpellcheckWord(word);
  if (!normalized) {
    return false;
  }

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
