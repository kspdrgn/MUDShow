export type StyleScope =
  | { kind: 'app' }
  | { kind: 'world'; worldId: string }
  | { kind: 'character'; worldId: string; characterId: string };

export type StyleSectionScope = 'output' | 'input';
export type StyleColorChannel = 'foreground' | 'background';
export type StyleImageFit = 'cover' | 'contain' | 'repeat';

export interface StyleBackgroundImageValue {
  path: string;
  fit: StyleImageFit;
  opacity: number;
}

export interface StyleSectionValue {
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontStretch: string;
  fontSize: number;
  foregroundColor: string;
  backgroundColor: string;
  backgroundImage: StyleBackgroundImageValue;
}

export interface AppStyleValues {
  output: StyleSectionValue;
  input: StyleSectionValue;
}

export interface StyleBackgroundImageOverrides {
  path?: string;
  fit?: StyleImageFit;
  opacity?: number;
}

export interface StyleSectionOverrides {
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fontStretch?: string;
  fontSize?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  backgroundImage?: StyleBackgroundImageOverrides;
}

export interface AppStyleOverrides {
  output?: StyleSectionOverrides;
  input?: StyleSectionOverrides;
}

export interface StyleSectionEditor {
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontStretch: string;
  fontFamilyEnabled: boolean;
  fontSize: number;
  fontSizeEnabled: boolean;
  foregroundColor: string;
  foregroundColorEnabled: boolean;
  backgroundColor: string;
  backgroundColorEnabled: boolean;
  backgroundImagePath: string;
  backgroundImageFit: StyleImageFit;
  backgroundImageOpacity: number;
  backgroundImageEnabled: boolean;
}

export interface AppStyleEditor {
  output: StyleSectionEditor;
  input: StyleSectionEditor;
}

const DEFAULT_FONT_FAMILY = 'var(--font-mono)';
const DEFAULT_FONT_WEIGHT = 400;
const DEFAULT_FONT_STYLE: 'normal' | 'italic' = 'normal';
const DEFAULT_FONT_STRETCH = 'normal';
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_FOREGROUND_COLOR = '#c8c8c8';
const DEFAULT_INPUT_FOREGROUND_COLOR = '#e8e8e8';
const DEFAULT_BACKGROUND_COLOR = '#000000';
const DEFAULT_INPUT_BACKGROUND_COLOR = '#050505';
const DEFAULT_BACKGROUND_IMAGE_PATH = '';
const DEFAULT_BACKGROUND_IMAGE_FIT: StyleImageFit = 'cover';
const DEFAULT_BACKGROUND_IMAGE_OPACITY = 100;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeColorValue(value: unknown, fallback: string): string {
  const text = normalizeText(value);
  return text.length > 0 ? text : fallback;
}

function normalizeFitValue(value: unknown): StyleImageFit {
  return value === 'contain' || value === 'repeat' ? value : 'cover';
}

function normalizeFontWeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_FONT_WEIGHT;
  }

  return Math.max(1, Math.round(value));
}

function normalizeFontStyle(value: unknown): 'normal' | 'italic' {
  return value === 'italic' ? 'italic' : 'normal';
}

function normalizeFontStretch(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FONT_STRETCH;
}

function normalizeOpacityValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_BACKGROUND_IMAGE_OPACITY;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function isDefaultBackgroundImage(value: StyleBackgroundImageValue): boolean {
  return (
    value.path.trim().length === 0 &&
    value.fit === DEFAULT_BACKGROUND_IMAGE_FIT &&
    value.opacity === DEFAULT_BACKGROUND_IMAGE_OPACITY
  );
}

function createDefaultBackgroundImage(): StyleBackgroundImageValue {
  return {
    path: DEFAULT_BACKGROUND_IMAGE_PATH,
    fit: DEFAULT_BACKGROUND_IMAGE_FIT,
    opacity: DEFAULT_BACKGROUND_IMAGE_OPACITY,
  };
}

function createDefaultSectionValue(scope: StyleSectionScope): StyleSectionValue {
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: DEFAULT_FONT_WEIGHT,
    fontStyle: DEFAULT_FONT_STYLE,
    fontStretch: DEFAULT_FONT_STRETCH,
    fontSize: DEFAULT_FONT_SIZE,
    foregroundColor: scope === 'output' ? DEFAULT_FOREGROUND_COLOR : DEFAULT_INPUT_FOREGROUND_COLOR,
    backgroundColor: scope === 'output' ? DEFAULT_BACKGROUND_COLOR : DEFAULT_INPUT_BACKGROUND_COLOR,
    backgroundImage: createDefaultBackgroundImage(),
  };
}

function createSectionEditorFromValue(value: StyleSectionValue): StyleSectionEditor {
  return {
    fontFamily: value.fontFamily,
    fontWeight: value.fontWeight,
    fontStyle: value.fontStyle,
    fontStretch: value.fontStretch,
    fontFamilyEnabled: false,
    fontSize: value.fontSize,
    fontSizeEnabled: false,
    foregroundColor: value.foregroundColor,
    foregroundColorEnabled: false,
    backgroundColor: value.backgroundColor,
    backgroundColorEnabled: false,
    backgroundImagePath: value.backgroundImage.path,
    backgroundImageFit: value.backgroundImage.fit,
    backgroundImageOpacity: value.backgroundImage.opacity,
    backgroundImageEnabled: false,
  };
}

function createSectionValueFromEditor(editor: StyleSectionEditor): StyleSectionValue {
  return {
    fontFamily: editor.fontFamily,
    fontWeight: editor.fontWeight,
    fontStyle: editor.fontStyle,
    fontStretch: editor.fontStretch,
    fontSize: editor.fontSize,
    foregroundColor: editor.foregroundColor,
    backgroundColor: editor.backgroundColor,
    backgroundImage: {
      path: editor.backgroundImagePath,
      fit: editor.backgroundImageFit,
      opacity: editor.backgroundImageOpacity,
    },
  };
}

function normalizeSectionOverrides(
  raw: unknown,
  scope: StyleSectionScope,
): StyleSectionOverrides {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const value = raw as Record<string, unknown>;
  const backgroundImage = typeof value.backgroundImage === 'object' && value.backgroundImage !== null && !Array.isArray(value.backgroundImage)
    ? (value.backgroundImage as Record<string, unknown>)
    : undefined;

  const next: StyleSectionOverrides = {};

  if (typeof value.fontFamily === 'string' && value.fontFamily.trim()) {
    next.fontFamily = value.fontFamily.trim();
  }

  if (typeof value.fontWeight === 'number' && Number.isFinite(value.fontWeight)) {
    next.fontWeight = normalizeFontWeight(value.fontWeight);
  }

  if (value.fontStyle === 'normal' || value.fontStyle === 'italic') {
    next.fontStyle = value.fontStyle;
  }

  if (typeof value.fontStretch === 'string' && value.fontStretch.trim()) {
    next.fontStretch = value.fontStretch.trim();
  }

  if (typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)) {
    next.fontSize = Math.max(1, Math.round(value.fontSize));
  }

  if (typeof value.foregroundColor === 'string' && value.foregroundColor.trim()) {
    next.foregroundColor = value.foregroundColor.trim();
  }

  if (typeof value.backgroundColor === 'string' && value.backgroundColor.trim()) {
    next.backgroundColor = value.backgroundColor.trim();
  }

  if (backgroundImage !== undefined) {
    const nextImage: StyleBackgroundImageOverrides = {};

    if (typeof backgroundImage.path === 'string' && backgroundImage.path.trim()) {
      nextImage.path = backgroundImage.path.trim();
    }

    if (backgroundImage.fit === 'cover' || backgroundImage.fit === 'contain' || backgroundImage.fit === 'repeat') {
      nextImage.fit = backgroundImage.fit;
    }

    if (typeof backgroundImage.opacity === 'number' && Number.isFinite(backgroundImage.opacity)) {
      nextImage.opacity = normalizeOpacityValue(backgroundImage.opacity);
    }

    if (Object.keys(nextImage).length > 0) {
      next.backgroundImage = nextImage;
    }
  }

  const defaults = createDefaultSectionValue(scope);
  if (next.fontFamily === defaults.fontFamily) {
    delete next.fontFamily;
  }
  if (next.fontWeight === defaults.fontWeight) {
    delete next.fontWeight;
  }
  if (next.fontStyle === defaults.fontStyle) {
    delete next.fontStyle;
  }
  if (next.fontStretch === defaults.fontStretch) {
    delete next.fontStretch;
  }
  if (next.fontSize === defaults.fontSize) {
    delete next.fontSize;
  }
  if (next.foregroundColor === defaults.foregroundColor) {
    delete next.foregroundColor;
  }
  if (next.backgroundColor === defaults.backgroundColor) {
    delete next.backgroundColor;
  }
  if (
    next.backgroundImage &&
    (next.backgroundImage.path ?? DEFAULT_BACKGROUND_IMAGE_PATH) === defaults.backgroundImage.path &&
    (next.backgroundImage.fit ?? DEFAULT_BACKGROUND_IMAGE_FIT) === defaults.backgroundImage.fit &&
    (next.backgroundImage.opacity ?? DEFAULT_BACKGROUND_IMAGE_OPACITY) === defaults.backgroundImage.opacity
  ) {
    delete next.backgroundImage;
  }

  return next;
}

function normalizeSectionEditor(
  scope: StyleSectionScope,
  overrides: StyleSectionOverrides | undefined,
): StyleSectionEditor {
  const defaults = createDefaultSectionValue(scope);
  const editor = createSectionEditorFromValue(defaults);

  if (!overrides) {
    return editor;
  }

  if (typeof overrides.fontFamily === 'string') {
    editor.fontFamily = overrides.fontFamily;
    editor.fontFamilyEnabled = normalizeText(overrides.fontFamily) !== normalizeText(defaults.fontFamily);
  }

  if (typeof overrides.fontWeight === 'number' && Number.isFinite(overrides.fontWeight)) {
    editor.fontWeight = normalizeFontWeight(overrides.fontWeight);
    editor.fontFamilyEnabled = editor.fontFamilyEnabled || editor.fontWeight !== defaults.fontWeight;
  }

  if (overrides.fontStyle === 'normal' || overrides.fontStyle === 'italic') {
    editor.fontStyle = overrides.fontStyle;
    editor.fontFamilyEnabled = editor.fontFamilyEnabled || editor.fontStyle !== defaults.fontStyle;
  }

  if (typeof overrides.fontStretch === 'string') {
    editor.fontStretch = normalizeFontStretch(overrides.fontStretch);
    editor.fontFamilyEnabled = editor.fontFamilyEnabled || normalizeText(editor.fontStretch) !== normalizeText(defaults.fontStretch);
  }

  if (typeof overrides.fontSize === 'number' && Number.isFinite(overrides.fontSize)) {
    editor.fontSize = Math.max(1, Math.round(overrides.fontSize));
    editor.fontSizeEnabled = editor.fontSize !== defaults.fontSize;
  }

  if (typeof overrides.foregroundColor === 'string') {
    editor.foregroundColor = overrides.foregroundColor;
    editor.foregroundColorEnabled = normalizeText(overrides.foregroundColor) !== normalizeText(defaults.foregroundColor);
  }

  if (typeof overrides.backgroundColor === 'string') {
    editor.backgroundColor = overrides.backgroundColor;
    editor.backgroundColorEnabled = normalizeText(overrides.backgroundColor) !== normalizeText(defaults.backgroundColor);
  }

  if (overrides.backgroundImage) {
    if (typeof overrides.backgroundImage.path === 'string') {
      editor.backgroundImagePath = overrides.backgroundImage.path;
    }

    if (overrides.backgroundImage.fit === 'cover' || overrides.backgroundImage.fit === 'contain' || overrides.backgroundImage.fit === 'repeat') {
      editor.backgroundImageFit = overrides.backgroundImage.fit;
    }

    if (typeof overrides.backgroundImage.opacity === 'number' && Number.isFinite(overrides.backgroundImage.opacity)) {
      editor.backgroundImageOpacity = normalizeOpacityValue(overrides.backgroundImage.opacity);
    }

    editor.backgroundImageEnabled =
      !isDefaultBackgroundImage({
        path: editor.backgroundImagePath,
        fit: editor.backgroundImageFit,
        opacity: editor.backgroundImageOpacity,
      });
  }

  return editor;
}

function serializeSectionEditor(
  scope: StyleSectionScope,
  editor: StyleSectionEditor,
): StyleSectionOverrides {
  const defaults = createDefaultSectionValue(scope);
  const next: StyleSectionOverrides = {};

  if (editor.fontFamilyEnabled && normalizeText(editor.fontFamily) !== normalizeText(defaults.fontFamily)) {
    next.fontFamily = editor.fontFamily.trim();
  }

  if (editor.fontFamilyEnabled && editor.fontWeight !== defaults.fontWeight) {
    next.fontWeight = normalizeFontWeight(editor.fontWeight);
  }

  if (editor.fontFamilyEnabled && editor.fontStyle !== defaults.fontStyle) {
    next.fontStyle = normalizeFontStyle(editor.fontStyle);
  }

  if (editor.fontFamilyEnabled && normalizeText(editor.fontStretch) !== normalizeText(defaults.fontStretch)) {
    next.fontStretch = normalizeFontStretch(editor.fontStretch);
  }

  if (editor.fontSizeEnabled && editor.fontSize !== defaults.fontSize) {
    next.fontSize = Math.max(1, Math.round(editor.fontSize));
  }

  if (editor.foregroundColorEnabled && normalizeText(editor.foregroundColor) !== normalizeText(defaults.foregroundColor)) {
    next.foregroundColor = editor.foregroundColor.trim();
  }

  if (editor.backgroundColorEnabled && normalizeText(editor.backgroundColor) !== normalizeText(defaults.backgroundColor)) {
    next.backgroundColor = editor.backgroundColor.trim();
  }

  if (editor.backgroundImageEnabled) {
    const nextImage: StyleBackgroundImageOverrides = {};

    if (normalizeText(editor.backgroundImagePath) !== normalizeText(defaults.backgroundImage.path)) {
      nextImage.path = editor.backgroundImagePath.trim();
    }

    if (editor.backgroundImageFit !== defaults.backgroundImage.fit) {
      nextImage.fit = editor.backgroundImageFit;
    }

    if (editor.backgroundImageOpacity !== defaults.backgroundImage.opacity) {
      nextImage.opacity = normalizeOpacityValue(editor.backgroundImageOpacity);
    }

    if (Object.keys(nextImage).length > 0) {
      next.backgroundImage = nextImage;
    }
  }

  return next;
}

function resolveSectionEditor(scope: StyleSectionScope, editor: StyleSectionEditor): StyleSectionValue {
  const defaults = createDefaultSectionValue(scope);
  const serialized = serializeSectionEditor(scope, editor);

  return {
    fontFamily: serialized.fontFamily ?? defaults.fontFamily,
    fontWeight: serialized.fontWeight ?? defaults.fontWeight,
    fontStyle: serialized.fontStyle ?? defaults.fontStyle,
    fontStretch: serialized.fontStretch ?? defaults.fontStretch,
    fontSize: serialized.fontSize ?? defaults.fontSize,
    foregroundColor: serialized.foregroundColor ?? defaults.foregroundColor,
    backgroundColor: serialized.backgroundColor ?? defaults.backgroundColor,
    backgroundImage: {
      path: serialized.backgroundImage?.path ?? defaults.backgroundImage.path,
      fit: serialized.backgroundImage?.fit ?? defaults.backgroundImage.fit,
      opacity: serialized.backgroundImage?.opacity ?? defaults.backgroundImage.opacity,
    },
  };
}

export function getStyleScopeLabel(scope: StyleScope): string {
  switch (scope.kind) {
    case 'app':
      return 'app defaults';
    case 'world':
      return 'world style';
    case 'character':
      return 'character style';
  }
}

export function getStyleScopeSummary(scope: StyleScope): string {
  switch (scope.kind) {
    case 'app':
      return 'This is the shared base style used everywhere unless a world or character overrides it.';
    case 'world':
      return 'This style sits between the app defaults and any character overrides in the same world.';
    case 'character':
      return 'This is the most specific style layer for a single character in one world.';
  }
}

export function getStyleScopePath(scope: StyleScope): string {
  switch (scope.kind) {
    case 'app':
      return 'scope / app';
    case 'world':
      return `scope / world / ${scope.worldId}`;
    case 'character':
      return `scope / world / ${scope.worldId} / character / ${scope.characterId}`;
  }
}

export const STYLE_SECTION_CONTENT: Record<StyleSectionScope, { title: string; description: string }> = {
  output: {
    title: 'output',
    description: 'the output side controls the visible transcript styling.',
  },
  input: {
    title: 'input',
    description: 'the input side controls the prompt and text entry styling.',
  },
};

export const STYLE_COLOR_CHANNEL_LABELS: Record<StyleColorChannel, string> = {
  foreground: 'foreground',
  background: 'background',
};

export const DEFAULT_APP_STYLE_VALUES: AppStyleValues = {
  output: createDefaultSectionValue('output'),
  input: createDefaultSectionValue('input'),
};

export function createDefaultAppStyleEditor(): AppStyleEditor {
  return {
    output: normalizeSectionEditor('output', undefined),
    input: normalizeSectionEditor('input', undefined),
  };
}

export function createAppStyleEditor(overrides: AppStyleOverrides | null | undefined): AppStyleEditor {
  return {
    output: normalizeSectionEditor('output', overrides?.output),
    input: normalizeSectionEditor('input', overrides?.input),
  };
}

export function normalizeAppStyleOverrides(raw: unknown): AppStyleOverrides {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const value = raw as Record<string, unknown>;
  return {
    output: normalizeSectionOverrides(value.output, 'output'),
    input: normalizeSectionOverrides(value.input, 'input'),
  };
}

export function serializeAppStyleEditor(editor: AppStyleEditor): AppStyleOverrides {
  const output = serializeSectionEditor('output', editor.output);
  const input = serializeSectionEditor('input', editor.input);

  return {
    output: Object.keys(output).length > 0 ? output : undefined,
    input: Object.keys(input).length > 0 ? input : undefined,
  };
}

export function resolveAppStyleEditor(editor: AppStyleEditor): AppStyleValues {
  return {
    output: resolveSectionEditor('output', editor.output),
    input: resolveSectionEditor('input', editor.input),
  };
}

export function isAppStyleEditorDirty(editor: AppStyleEditor): boolean {
  const serialized = serializeAppStyleEditor(editor);
  return Boolean(serialized.output || serialized.input);
}
