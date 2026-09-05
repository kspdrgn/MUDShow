export type SettingsTabId =
  | 'database'
  | 'window'
  | 'transcript'
  | 'logging'
  | 'connections'
  | 'spellcheck'
  | 'style'
  | 'ui';

export interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
}

export const SETTINGS_PAGE_TABS: SettingsTabDefinition[] = [
  { id: 'database', label: 'Database' },
  { id: 'window', label: 'Window' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'logging', label: 'Logging' },
  { id: 'connections', label: 'Connections' },
  { id: 'spellcheck', label: 'Spellcheck' },
  { id: 'style', label: 'Default Style' },
  { id: 'ui', label: 'UI' },
];

export const SETTINGS_PAGE_TAB_ICONS: Record<SettingsTabId, string> = {
  database: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5c0 1.66 4.03 3 9 3s9-1.34 9-3-4.03-3-9-3-9 1.34-9 3Z"/><path d="M4.5 7.5v9c0 1.66 4.03 3 9 3s9-1.34 9-3v-9"/><path d="M4.5 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>`,
  window: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="14" rx="2"/><path d="M4.5 9h15"/><path d="M8 5v14"/></svg>`,
  transcript: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5h12"/><path d="M6 10h12"/><path d="M6 14.5h8"/><path d="M6 19h12"/><path d="M4.5 4.5v15h15"/></svg>`,
  logging: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5.5h11l2 3v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"/><path d="M8 12h8"/><path d="M8 15.5h5"/></svg>`,
  connections: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14.5a4 4 0 0 1 6.7-2.9"/><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5"/><path d="M15.5 12a3.5 3.5 0 0 1 5.5 2.8"/><path d="M11 17.5h2"/><path d="M12 17.5v3"/></svg>`,
  spellcheck: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h6"/><path d="M5 11h4"/><path d="M5 15.5h8"/><path d="M14.5 7.5l2.25 2.75L21 5.75"/><path d="M15 16l2.5 2.5 4-4"/></svg>`,
  style: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5c4.4 0 8 3.1 8 7 0 2.2-1.1 4.2-3 5.5V20l-3.5-2h-1.5c-4.4 0-8-3.1-8-7s3.6-7.5 8-7.5Z"/><path d="M9 11.5h6"/><path d="M12 8.5v6"/></svg>`,
  ui: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="2"/><path d="M8 8h8"/><path d="M8 12h5"/><path d="M8 16h3"/></svg>`,
};

export const SETTINGS_PAGE_PLACEHOLDER_TABS = new Set<SettingsTabId>(['connections']);
