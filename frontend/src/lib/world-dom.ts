export function getWorldDomScope(tabId: string): string {
  return tabId;
}

export function getWorldOutputAreaId(scope: string): string {
  return `${scope}-output-area`;
}

export function getWorldNotesPanelId(scope: string): string {
  return `${scope}-notes-panel`;
}

export function getWorldNotesEditorId(scope: string): string {
  return `${scope}-notes-editor`;
}

export function getWorldHighlightsPanelId(scope: string): string {
  return `${scope}-highlights-panel`;
}

export function getWorldHighlightInputId(scope: string): string {
  return `${scope}-highlight-input`;
}

export function getWorldInputBarContainerId(scope: string, barId: number): string {
  return `${scope}-bar-${barId}`;
}

export function getWorldInputBarInputId(scope: string, barId: number): string {
  return `${scope}-input-${barId}`;
}
