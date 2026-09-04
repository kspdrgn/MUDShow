import {
  themeAbyss,
  themeAbyssSpaced,
  themeCatppuccinMocha,
  themeCatppuccinMochaSpaced,
  themeDark,
  themeDracula,
  themeGithubDark,
  themeGithubDarkSpaced,
  themeGithubLight,
  themeGithubLightSpaced,
  themeLight,
  themeLightSpaced,
  themeMonokai,
  themeNord,
  themeNordSpaced,
  themeSolarizedLight,
  themeSolarizedLightSpaced,
  themeVisualStudio,
  type DockviewTheme,
} from 'dockview';

export interface DockviewThemePreview {
  surface: string;
  tab: string;
  active: string;
  accent: string;
  foreground: string;
}

export interface DockviewThemeOption {
  id: string;
  label: string;
  theme: DockviewTheme;
  preview: DockviewThemePreview;
}

export const DOCKVIEW_THEMES = [
  { id: 'dark', label: 'dark', theme: themeDark, preview: { surface: '#1e1e1e', tab: '#252526', active: '#1e1e1e', accent: '#569cd6', foreground: '#ffffff' } },
  { id: 'light', label: 'light', theme: themeLight, preview: { surface: '#ffffff', tab: '#f3f3f3', active: '#ffffff', accent: '#007acc', foreground: '#333333' } },
  { id: 'visualStudio', label: 'visual studio', theme: themeVisualStudio, preview: { surface: '#1e1e1e', tab: '#2d2d30', active: '#007acc', accent: '#007acc', foreground: '#ffffff' } },
  { id: 'abyss', label: 'abyss', theme: themeAbyss, preview: { surface: '#000c18', tab: '#1c1c2a', active: '#000c18', accent: '#5b1ecf', foreground: '#ffffff' } },
  { id: 'dracula', label: 'dracula', theme: themeDracula, preview: { surface: '#282a36', tab: '#44475a', active: '#282a36', accent: '#bd93f9', foreground: '#f8f8f2' } },
  { id: 'abyssSpaced', label: 'abyss (spaced)', theme: themeAbyssSpaced, preview: { surface: '#000c18', tab: '#1c1c2a', active: '#000c18', accent: '#5b1ecf', foreground: '#ffffff' } },
  { id: 'lightSpaced', label: 'light (spaced)', theme: themeLightSpaced, preview: { surface: '#ffffff', tab: '#f3f3f3', active: '#ffffff', accent: '#007acc', foreground: '#333333' } },
  { id: 'nord', label: 'nord', theme: themeNord, preview: { surface: '#2e3440', tab: '#3b4252', active: '#2e3440', accent: '#88c0d0', foreground: '#eceff4' } },
  { id: 'nordSpaced', label: 'nord (spaced)', theme: themeNordSpaced, preview: { surface: '#2e3440', tab: '#3b4252', active: '#2e3440', accent: '#88c0d0', foreground: '#eceff4' } },
  { id: 'catppuccinMocha', label: 'catppuccin mocha', theme: themeCatppuccinMocha, preview: { surface: '#1e1e2e', tab: '#313244', active: '#1e1e2e', accent: '#cba6f7', foreground: '#cdd6f4' } },
  { id: 'catppuccinMochaSpaced', label: 'catppuccin mocha (spaced)', theme: themeCatppuccinMochaSpaced, preview: { surface: '#1e1e2e', tab: '#313244', active: '#1e1e2e', accent: '#cba6f7', foreground: '#cdd6f4' } },
  { id: 'monokai', label: 'monokai', theme: themeMonokai, preview: { surface: '#272822', tab: '#3e3d32', active: '#272822', accent: '#a6e22e', foreground: '#f8f8f2' } },
  { id: 'solarizedLight', label: 'solarized light', theme: themeSolarizedLight, preview: { surface: '#fdf6e3', tab: '#eee8d5', active: '#fdf6e3', accent: '#268bd2', foreground: '#657b83' } },
  { id: 'solarizedLightSpaced', label: 'solarized light (spaced)', theme: themeSolarizedLightSpaced, preview: { surface: '#fdf6e3', tab: '#eee8d5', active: '#fdf6e3', accent: '#268bd2', foreground: '#657b83' } },
  { id: 'githubDark', label: 'github dark', theme: themeGithubDark, preview: { surface: '#0d1117', tab: '#161b22', active: '#0d1117', accent: '#58a6ff', foreground: '#e6edf3' } },
  { id: 'githubDarkSpaced', label: 'github dark (spaced)', theme: themeGithubDarkSpaced, preview: { surface: '#0d1117', tab: '#161b22', active: '#0d1117', accent: '#58a6ff', foreground: '#e6edf3' } },
  { id: 'githubLight', label: 'github light', theme: themeGithubLight, preview: { surface: '#ffffff', tab: '#f6f8fa', active: '#ffffff', accent: '#0969da', foreground: '#1f2328' } },
  { id: 'githubLightSpaced', label: 'github light (spaced)', theme: themeGithubLightSpaced, preview: { surface: '#ffffff', tab: '#f6f8fa', active: '#ffffff', accent: '#0969da', foreground: '#1f2328' } },
] as const satisfies readonly DockviewThemeOption[];

export type DockviewThemeId = (typeof DOCKVIEW_THEMES)[number]['id'];

export const DEFAULT_DOCKVIEW_THEME: DockviewThemeId = 'abyssSpaced';

export function isDockviewThemeId(value: unknown): value is DockviewThemeId {
  return DOCKVIEW_THEMES.some((option) => option.id === value);
}

export function normalizeDockviewThemeId(value: unknown): DockviewThemeId {
  // Migrate the former app-level placeholder theme name to the configured theme.
  if (value === 'midnight') {
    return DEFAULT_DOCKVIEW_THEME;
  }

  return isDockviewThemeId(value) ? value : DEFAULT_DOCKVIEW_THEME;
}
