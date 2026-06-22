import type { Writable } from 'svelte/store';
import type { Character, CharacterDraft } from './types';
import { saveCharacters } from './storage';
import type { SessionState } from './session-state';
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

  function saveCharacter(draft: CharacterDraft): void {
    const name = draft.name.trim();
    const host = draft.host.trim();
    const port = Number.parseInt(draft.port, 10);
    const parsedWidth = typeof draft.width !== 'string' || draft.width.trim() === '' || draft.width.trim() === '0'
      ? undefined
      : Number.parseInt(draft.width, 10);
    const state = getState();

    if (!name || !host || !Number.isFinite(port)) {
      return;
    }

    const nextCharacter: Character = {
      name,
      host,
      port,
      tls: draft.tls,
      verifyCertificate: draft.tls ? draft.verifyCertificate : false,
      sound: draft.sound,
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

    saveCharacters(nextCharacters);
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
    next.splice(index, 1);
    saveCharacters(next);
    patch({ characters: next });
  }

  return {
    openModal,
    closeModal,
    saveCharacter,
    deleteCharacter,
  };
}
