export type StyleScope =
  | { kind: 'app' }
  | { kind: 'world'; worldId: string }
  | { kind: 'character'; worldId: string; characterId: string };

export type StyleSectionScope = 'output' | 'input';
export type StyleColorChannel = 'foreground' | 'background';

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

export const STYLE_SECTION_CONTENT: Record<
  StyleSectionScope,
  { title: string }
> = {
  output: {
    title: 'output',
  },
  input: {
    title: 'input',
  },
};

export const STYLE_COLOR_CHANNEL_LABELS: Record<StyleColorChannel, string> = {
  foreground: 'foreground',
  background: 'background',
};
