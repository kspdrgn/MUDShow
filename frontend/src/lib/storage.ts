import type { Character, HighlightRule } from './types';

const CHARACTER_KEY = 'mudshow_chars';
const HIGHLIGHT_KEY = 'mudshow_highlights';
const NOTES_PREFIX = 'mudshow_notes_';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCharacters(): Character[] {
  return safeParse(localStorage.getItem(CHARACTER_KEY), []);
}

export function saveCharacters(characters: Character[]): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(characters));
}

export function loadNotes(characterName: string): string {
  return localStorage.getItem(`${NOTES_PREFIX}${characterName}`) ?? '';
}

export function saveNotes(characterName: string, notes: string): void {
  localStorage.setItem(`${NOTES_PREFIX}${characterName}`, notes);
}

export function loadHighlights(): HighlightRule[] {
  return safeParse(localStorage.getItem(HIGHLIGHT_KEY), []);
}

export function saveHighlights(rules: HighlightRule[]): void {
  localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(rules));
}
