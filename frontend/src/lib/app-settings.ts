import { setDesktopStorageMode, type DesktopStorageMode } from './storage';

const SETTINGS_KEY = 'mudshow_app_settings';

export interface AppSettings {
  storageMode: DesktopStorageMode;
  storageFilePath: string | null;
  defaultLogFolder: string | null;
  confirmUnloggedTabClose: boolean;
  titleAttention: boolean;
  linkImagePreviews: boolean;
  imagePreviewCacheVersion: number;
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
  defaultLogFolder: null,
  confirmUnloggedTabClose: false,
  titleAttention: true,
  linkImagePreviews: false,
  imagePreviewCacheVersion: 0,
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

function normalizeLogFolderPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
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
    defaultLogFolder: normalizeLogFolderPath(raw.defaultLogFolder),
    confirmUnloggedTabClose: raw.confirmUnloggedTabClose === true,
    titleAttention: raw.titleAttention !== false,
    linkImagePreviews: raw.linkImagePreviews === true,
    imagePreviewCacheVersion: normalizeNonNegativeInteger(raw.imagePreviewCacheVersion, DEFAULT_APP_SETTINGS.imagePreviewCacheVersion),
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
    defaultLogFolder: normalizeLogFolderPath(settings.defaultLogFolder),
    confirmUnloggedTabClose: settings.confirmUnloggedTabClose === true,
    titleAttention: settings.titleAttention !== false,
    linkImagePreviews: settings.linkImagePreviews === true,
    imagePreviewCacheVersion: normalizeNonNegativeInteger(
      settings.imagePreviewCacheVersion,
      DEFAULT_APP_SETTINGS.imagePreviewCacheVersion,
    ),
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
