import type { Writable } from 'svelte/store';
import type { Character, CharacterDraft } from './types';
import { deleteNotes, deleteTranscriptHistory, moveNotes, moveTranscriptHistory, saveCharacters } from './storage';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { focusElement, nextFrame } from './session-dom';

interface CharacterActionContext {
  state: Writable<SessionState>;
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
}

export function createCharacterActions({ getState, patch }: CharacterActionContext) {
  async function openModal(index: number | null = null): Promise<void> {
    const state = getState();
    const selected = index === null ? null : state.characters[index] ?? null;

    if (selected) {
      patch({
        modalTitle: 'edit character',
        editingIndex: index,
        modalDraft: {
          name: selected.name,
          host: selected.host,
          port: String(selected.port),
          tls: selected.tls !== false,
          verifyCertificate: selected.tls !== false && selected.verifyCertificate !== false,
          width: String(selected.width ?? ''),
          sound: selected.sound === true,
          outputHistoryLines: String(selected.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES),
        },
        modalOpen: true,
      });
    } else {
      patch({
        modalTitle: 'add character',
        editingIndex: null,
        modalDraft: {
          name: '',
          host: '',
          port: '',
          tls: true,
          verifyCertificate: true,
          width: '',
          sound: false,
          outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
        },
        modalOpen: true,
      });
    }

    await nextFrame();
    focusElement('field-name');
  }

  function closeModal(): void {
    patch({ modalOpen: false });
  }

  function openWorldSelector(): void {
    patch({ worldSelectorOpen: true });
  }

  function closeWorldSelector(): void {
    patch({ worldSelectorOpen: false });
  }

  function saveCharacter(draft: CharacterDraft): void {
    const name = draft.name.trim();
    const host = draft.host.trim();
    const port = Number.parseInt(String(draft.port), 10);
    const widthValue = String(draft.width);
    const parsedWidth = widthValue.trim() === '' || widthValue.trim() === '0'
      ? undefined
      : Number.parseInt(widthValue, 10);
    const outputHistoryValue = String(draft.outputHistoryLines);
    const parsedOutputHistoryLines = outputHistoryValue.trim() === ''
      ? DEFAULT_OUTPUT_HISTORY_LINES
      : Number.parseInt(outputHistoryValue, 10);
    const state = getState();

    if (!name || !host || !Number.isFinite(port)) {
      return;
    }

    const nextCharacter: Character = {
      name,
      host,
      port,
      tls: draft.tls,
      verifyCertificate: draft.tls
        ? draft.verifyCertificate
        : false,
      sound: draft.sound,
      outputHistoryLines: Number.isFinite(parsedOutputHistoryLines)
        ? Math.max(0, parsedOutputHistoryLines)
        : DEFAULT_OUTPUT_HISTORY_LINES,
    };

    if (parsedWidth !== undefined && Number.isFinite(parsedWidth)) {
      nextCharacter.width = parsedWidth;
    }

    const previousCharacter = state.editingIndex === null ? null : state.characters[state.editingIndex] ?? null;
    const nextCharacters = [...state.characters];

    if (state.editingIndex === null) {
      nextCharacters.push(nextCharacter);
    } else {
      nextCharacters[state.editingIndex] = nextCharacter;
    }

    void saveCharacters(nextCharacters);

    if (previousCharacter && previousCharacter.name !== nextCharacter.name) {
      void moveNotes(previousCharacter.name, nextCharacter.name);
      void moveTranscriptHistory(previousCharacter.name, nextCharacter.name);
    }

    patch({
      characters: nextCharacters,
      modalOpen: false,
      editingIndex: null,
      currentCharacter:
        previousCharacter && state.currentCharacter?.name === previousCharacter.name
          ? nextCharacter
          : state.currentCharacter,
    });
  }

  function deleteCharacter(index: number): void {
    const state = getState();
    const next = [...state.characters];
    const [removed] = next.splice(index, 1);
    void saveCharacters(next);

    if (removed) {
      void deleteNotes(removed.name);
      void deleteTranscriptHistory(removed.name);
    }

    patch({
      characters: next,
      currentCharacter:
        state.currentCharacter?.name === removed?.name ? null : state.currentCharacter,
      notes:
        state.currentCharacter?.name === removed?.name ? '' : state.notes,
    });
  }

  return {
    openModal,
    closeModal,
    openWorldSelector,
    closeWorldSelector,
    saveCharacter,
    deleteCharacter,
  };
}
