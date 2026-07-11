import { setDesktopStorageMode, type DesktopStorageMode } from './storage';

const SETTINGS_KEY = 'mudshow_app_settings';

export interface AppSettings {
  storageMode: DesktopStorageMode;
  storageFilePath: string | null;
  titleAttention: boolean;
  linkImagePreviews: boolean;
  showCurrentOutputWhenScrollingUp: boolean;
  connectionTimeoutSeconds: number;
  connectionRetries: number;
  keepAlive: boolean;
  spellcheckLanguage: string;
  colorScheme: string;
  alwaysOnTop: boolean;
  transparency: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  storageMode: 'file',
  storageFilePath: null,
  titleAttention: true,
  linkImagePreviews: false,
  showCurrentOutputWhenScrollingUp: true,
  connectionTimeoutSeconds: 10,
  connectionRetries: 3,
  keepAlive: true,
  spellcheckLanguage: 'en-US',
  colorScheme: 'midnight',
  alwaysOnTop: false,
  transparency: 100,
};

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

function clampTransparency(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.transparency;
  }

  return Math.min(100, Math.max(60, Math.round(value)));
}

function normalizeStorageFilePath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_APP_SETTINGS };
  }

  const raw = safeParse<Partial<AppSettings>>(localStorage.getItem(SETTINGS_KEY), {});
  const settings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...raw,
    storageMode: 'file',
    storageFilePath: normalizeStorageFilePath(raw.storageFilePath),
    titleAttention: raw.titleAttention !== false,
    linkImagePreviews: raw.linkImagePreviews === true,
    showCurrentOutputWhenScrollingUp: raw.showCurrentOutputWhenScrollingUp !== false,
    connectionTimeoutSeconds: typeof raw.connectionTimeoutSeconds === 'number' && Number.isFinite(raw.connectionTimeoutSeconds)
      ? Math.max(1, Math.round(raw.connectionTimeoutSeconds))
      : DEFAULT_APP_SETTINGS.connectionTimeoutSeconds,
    connectionRetries: typeof raw.connectionRetries === 'number' && Number.isFinite(raw.connectionRetries)
      ? Math.max(0, Math.round(raw.connectionRetries))
      : DEFAULT_APP_SETTINGS.connectionRetries,
    keepAlive: raw.keepAlive !== false,
    spellcheckLanguage: typeof raw.spellcheckLanguage === 'string' && raw.spellcheckLanguage.trim()
      ? raw.spellcheckLanguage.trim()
      : DEFAULT_APP_SETTINGS.spellcheckLanguage,
    colorScheme: typeof raw.colorScheme === 'string' && raw.colorScheme.trim()
      ? raw.colorScheme.trim()
      : DEFAULT_APP_SETTINGS.colorScheme,
    alwaysOnTop: raw.alwaysOnTop === true,
    transparency: clampTransparency(
      typeof raw.transparency === 'number' ? raw.transparency : DEFAULT_APP_SETTINGS.transparency,
    ),
  };

  setDesktopStorageMode(settings.storageMode);
  return settings;
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  const next: AppSettings = {
    ...settings,
    storageMode: 'file',
    storageFilePath: normalizeStorageFilePath(settings.storageFilePath),
    titleAttention: settings.titleAttention !== false,
    linkImagePreviews: settings.linkImagePreviews === true,
    showCurrentOutputWhenScrollingUp: settings.showCurrentOutputWhenScrollingUp !== false,
    connectionTimeoutSeconds: Math.max(1, Math.round(settings.connectionTimeoutSeconds)),
    connectionRetries: Math.max(0, Math.round(settings.connectionRetries)),
    keepAlive: settings.keepAlive !== false,
    spellcheckLanguage: settings.spellcheckLanguage.trim() || DEFAULT_APP_SETTINGS.spellcheckLanguage,
    colorScheme: settings.colorScheme.trim() || DEFAULT_APP_SETTINGS.colorScheme,
    alwaysOnTop: settings.alwaysOnTop === true,
    transparency: clampTransparency(settings.transparency),
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  setDesktopStorageMode(next.storageMode);
}
