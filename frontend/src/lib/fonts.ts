import { invoke, isTauriAvailable } from './tauri';

export type BuiltInFontId = 'jetbrains-mono' | 'system-ui' | 'serif';
export type FontShelfEntry =
  | {
      source: 'builtin';
      id: BuiltInFontId;
      label: string;
      cssFamily: string;
      weight: number;
      fontStyle: 'normal' | 'italic';
      stretch: string;
    }
  | {
      source: 'system';
      id: string;
      family: string;
      label: string;
      cssFamily: string;
      weight: number;
      fontStyle: 'normal' | 'italic';
      stretch: string;
      postscriptName: string;
      status?: 'available' | 'missing';
    };

export interface SystemFontFace {
  family: string;
  styleName: string;
  weight: number;
  italic: boolean;
  stretch: string;
  postscriptName: string;
  displayName: string;
  monospaced: boolean;
}

export interface SystemFontFamily {
  family: string;
  faces: SystemFontFace[];
}

export interface SystemFontValidationResult {
  family: string;
  available: boolean;
  matchedFace?: SystemFontFace;
}

export const BUILT_IN_FONT_SHELF: FontShelfEntry[] = [
  {
    source: 'builtin',
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    cssFamily: 'var(--font-mono)',
    weight: 400,
    fontStyle: 'normal',
    stretch: 'normal',
  },
  {
    source: 'builtin',
    id: 'system-ui',
    label: 'System UI',
    cssFamily: 'system-ui',
    weight: 400,
    fontStyle: 'normal',
    stretch: 'normal',
  },
  {
    source: 'builtin',
    id: 'serif',
    label: 'Serif',
    cssFamily: 'serif',
    weight: 400,
    fontStyle: 'normal',
    stretch: 'normal',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.round(value)) : 400;
}

function normalizeFontStyle(value: unknown): 'normal' | 'italic' {
  return value === 'italic' ? 'italic' : 'normal';
}

function normalizeStretch(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'normal';
}

function createSystemFontId(family: string, face?: Pick<SystemFontFace, 'weight' | 'italic' | 'stretch' | 'postscriptName'>): string {
  const normalizedFamily = family.trim().toLowerCase();
  if (!face) {
    return `system:${normalizedFamily}:400:normal:normal`;
  }

  const style = face.italic ? 'italic' : 'normal';
  const postscript = face.postscriptName.trim().toLowerCase();
  return `system:${normalizedFamily}:${face.weight}:${style}:${face.stretch}:${postscript}`;
}

function quoteCssFamily(family: string): string {
  return `"${family.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}", var(--font-mono)`;
}

function normalizeSystemShelfEntry(value: Record<string, unknown>): FontShelfEntry | null {
  const family = typeof value.family === 'string' ? value.family.trim() : '';
  if (!family) {
    return null;
  }

  const status = value.status === 'missing' ? 'missing' : 'available';
  const weight = normalizeWeight(value.weight);
  const fontStyle = normalizeFontStyle(value.fontStyle);
  const stretch = normalizeStretch(value.stretch);
  const postscriptName = typeof value.postscriptName === 'string' ? value.postscriptName.trim() : '';
  const fallbackFace: SystemFontFace = {
    family,
    styleName: fontStyle === 'italic' ? 'italic' : 'regular',
    weight,
    italic: fontStyle === 'italic',
    stretch,
    postscriptName,
    displayName: '',
    monospaced: false,
  };

  return {
    source: 'system',
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : createSystemFontId(family, fallbackFace),
    family,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : `${family} ${fallbackFace.styleName}`,
    cssFamily: typeof value.cssFamily === 'string' && value.cssFamily.trim() ? value.cssFamily.trim() : quoteCssFamily(family),
    weight,
    fontStyle,
    stretch,
    postscriptName,
    status,
  };
}

export function normalizeFontShelf(raw: unknown): FontShelfEntry[] {
  const systemEntries = Array.isArray(raw)
    ? raw
        .map((entry) => (isRecord(entry) && entry.source === 'system' ? normalizeSystemShelfEntry(entry) : null))
        .filter((entry): entry is Extract<FontShelfEntry, { source: 'system' }> => entry !== null)
    : [];

  const byKey = new Map<string, FontShelfEntry>();
  for (const entry of BUILT_IN_FONT_SHELF) {
    byKey.set(`${entry.source}:${entry.id}`, entry);
  }
  for (const entry of systemEntries) {
    byKey.set(`${entry.source}:${entry.id}`, entry);
  }

  return [...byKey.values()];
}

export function serializeFontShelf(shelf: FontShelfEntry[]): FontShelfEntry[] {
  return normalizeFontShelf(shelf).filter((entry) => entry.source === 'system');
}

export function createSystemFontShelfEntry(family: SystemFontFamily, face: SystemFontFace): FontShelfEntry {
  const name = family.family.trim();
  return {
    source: 'system',
    id: createSystemFontId(name, face),
    family: name,
    label: `${name} ${face.styleName}`,
    cssFamily: quoteCssFamily(name),
    weight: face.weight,
    fontStyle: face.italic ? 'italic' : 'normal',
    stretch: face.stretch,
    postscriptName: face.postscriptName,
    status: 'available',
  };
}

export function findFontShelfEntryByCssFamily(shelf: FontShelfEntry[], cssFamily: string): FontShelfEntry | null {
  return normalizeFontShelf(shelf).find((entry) => entry.cssFamily === cssFamily) ?? null;
}

export async function listSystemFonts(): Promise<SystemFontFamily[]> {
  if (!isTauriAvailable()) {
    return [];
  }

  return invoke<SystemFontFamily[]>('list_system_fonts');
}

export async function validateSystemFont(entry: FontShelfEntry): Promise<SystemFontValidationResult | null> {
  if (!isTauriAvailable() || entry.source !== 'system') {
    return null;
  }

  return invoke<SystemFontValidationResult>('validate_system_font', {
    request: {
      family: entry.family,
      weight: entry.weight,
      italic: entry.fontStyle === 'italic',
      stretch: entry.stretch,
    },
  });
}
