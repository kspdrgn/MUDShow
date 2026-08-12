import type { Writable } from 'svelte/store';
import type { CharacterDraft, CharacterRecord, WorldDraft, WorldRecord } from './types';
import { deleteNotes, deleteTranscriptHistory, saveConnectionData, saveTriggers } from './storage';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { focusElement, nextFrame } from './session-dom';
import { removeTriggersForCharacter, removeTriggersForWorld } from './session-triggers';

interface CharacterActionContext {
  state: Writable<SessionState>;
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  onRecordsChanged?: () => void;
  onWorldDeleted?: (worldId: string) => void;
  onCharacterDeleted?: (characterId: string) => void;
  onModalWindowOpen?: (kind: 'world' | 'character', title: string) => void;
  onModalWindowClose?: (kind: 'world' | 'character') => void;
}

function createCharacterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `character-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWorldRecordFromDraft(draft: WorldDraft): WorldRecord | null {
  const name = draft.name.trim();
  const host = draft.host.trim();
  const port = Number.parseInt(String(draft.port), 10);

  if (!name || !host || !Number.isFinite(port)) {
    return null;
  }

  const tls = draft.tls;
  return {
    id: '',
    name,
    host,
    port,
    tls,
    verifyCertificate: tls ? draft.verifyCertificate : false,
    compatibility: draft.compatibility,
  };
}

function createCharacterRecordFromDraft(
  draft: CharacterDraft,
  worldId: string,
  existing?: CharacterRecord,
): CharacterRecord {
  const widthValue = String(draft.width);
  const parsedWidth = widthValue.trim() === '' || widthValue.trim() === '0'
    ? undefined
    : Number.parseInt(widthValue, 10);
  const outputHistoryValue = String(draft.outputHistoryLines);
  const parsedOutputHistoryLines = outputHistoryValue.trim() === ''
    ? DEFAULT_OUTPUT_HISTORY_LINES
    : Number.parseInt(outputHistoryValue, 10);

  const nextCharacter: CharacterRecord = {
    id: existing?.id?.trim() || createCharacterId(),
    worldId,
    name: draft.name.trim(),
    width: undefined,
    sound: draft.sound,
    outputHistoryLines: Number.isFinite(parsedOutputHistoryLines)
      ? Math.max(0, parsedOutputHistoryLines)
      : DEFAULT_OUTPUT_HISTORY_LINES,
    connectString: draft.connectString.trim() || undefined,
  };

  if (parsedWidth !== undefined && Number.isFinite(parsedWidth)) {
    nextCharacter.width = parsedWidth;
  }

  return nextCharacter;
}

function createWorldDraftFromWorld(world: WorldRecord): WorldDraft {
  return {
    name: world.name,
    host: world.host,
    port: String(world.port),
    tls: world.tls,
    verifyCertificate: world.verifyCertificate,
    compatibility: world.compatibility,
  };
}

function createCharacterDraftFromCharacter(character: CharacterRecord): CharacterDraft {
  return {
    name: character.name,
    width: String(character.width ?? ''),
    sound: character.sound === true,
    outputHistoryLines: String(character.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES),
    connectString: character.connectString ?? '',
  };
}

export function createCharacterActions({
  getState,
  patch,
  onRecordsChanged,
  onWorldDeleted,
  onCharacterDeleted,
  onModalWindowOpen,
  onModalWindowClose,
}: CharacterActionContext) {
  async function openWorldModal(index: number | null = null): Promise<void> {
    const state = getState();
    const selected = index === null ? null : state.worlds[index] ?? null;
    const title = selected ? 'edit world' : 'add world';

    if (selected) {
      patch({
        modalKind: 'world',
        modalTitle: title,
        worldEditingId: selected.id,
        worldModalDraft: createWorldDraftFromWorld(selected),
        modalOpen: true,
      });
    } else {
      patch({
        modalKind: 'world',
        modalTitle: title,
        worldEditingId: null,
        worldModalDraft: {
          name: '',
          host: '',
          port: '',
          tls: true,
          verifyCertificate: true,
          compatibility: 'telnet',
        },
        modalOpen: true,
      });
    }

    onModalWindowOpen?.('world', title);

    await nextFrame();
    focusElement('world-name');
  }

  async function openCharacterModal(worldId: string, index: number | null = null): Promise<void> {
    const state = getState();
    const world = state.worlds.find((entry) => entry.id === worldId) ?? null;
    if (!world) {
      return;
    }

    const selected = index === null ? null : state.characters[index] ?? null;
    const title = selected ? 'edit character' : 'add character';

    if (selected) {
      patch({
        modalKind: 'character',
        modalTitle: title,
        editingIndex: index,
        characterWorldId: worldId,
        modalDraft: createCharacterDraftFromCharacter(selected),
        modalOpen: true,
      });
    } else {
      patch({
        modalKind: 'character',
        modalTitle: title,
        editingIndex: null,
        characterWorldId: worldId,
        modalDraft: {
          name: '',
          width: '',
          sound: false,
          outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
          connectString: '',
        },
        modalOpen: true,
      });
    }

    onModalWindowOpen?.('character', title);

    await nextFrame();
    focusElement('field-name');
  }

  function closeModal(): void {
    const state = getState();
    if (state.modalKind) {
      onModalWindowClose?.(state.modalKind);
    }

    patch({
      modalOpen: false,
      modalKind: null,
      worldEditingId: null,
      editingIndex: null,
      characterWorldId: null,
    });
  }

  async function saveWorld(draft: WorldDraft): Promise<void> {
    const nextWorld = createWorldRecordFromDraft(draft);
    const state = getState();

    if (!nextWorld) {
      return;
    }

    const previousWorld =
      state.worldEditingId === null ? null : state.worlds.find((world) => world.id === state.worldEditingId) ?? null;
    const nextWorldId =
      previousWorld?.id ??
      `world-${state.worlds.length + 1}-${Date.now().toString(36)}`;
    const world: WorldRecord = {
      ...nextWorld,
      id: nextWorldId,
    };

    const nextWorlds = previousWorld
      ? state.worlds.map((entry) => (entry.id === previousWorld.id ? { ...entry, ...world } : entry))
      : [...state.worlds, world];

    await saveConnectionData(nextWorlds, state.characters);

    patch({
      worlds: nextWorlds,
      modalOpen: false,
      modalKind: null,
      worldEditingId: null,
      editingIndex: null,
      characterWorldId: null,
    });
    if (state.modalKind) {
      onModalWindowClose?.(state.modalKind);
    }
    onRecordsChanged?.();

    void previousWorld;
  }

  async function saveCharacter(draft: CharacterDraft): Promise<void> {
    const state = getState();
    const worldId = state.characterWorldId;
    const world = worldId ? state.worlds.find((entry) => entry.id === worldId) ?? null : null;

    if (!worldId || !world) {
      return;
    }

    const name = draft.name.trim();
    if (!name) {
      return;
    }

    const previousCharacter = state.editingIndex === null ? null : state.characters[state.editingIndex] ?? null;
    const nextCharacter = createCharacterRecordFromDraft(draft, worldId, previousCharacter ?? undefined);
    const nextCharacters = state.editingIndex === null
      ? [...state.characters, nextCharacter]
      : state.characters.map((entry, index) => (index === state.editingIndex ? nextCharacter : entry));

    await saveConnectionData(state.worlds, nextCharacters);

    patch({
      characters: nextCharacters,
      modalOpen: false,
      modalKind: null,
      worldEditingId: null,
      editingIndex: null,
      characterWorldId: null,
    });
    if (state.modalKind) {
      onModalWindowClose?.(state.modalKind);
    }
    onRecordsChanged?.();
  }

  async function deleteWorld(index: number): Promise<void> {
    const state = getState();
    const removed = state.worlds[index];
    if (!removed) {
      return;
    }

    const nextWorlds = state.worlds.filter((_, currentIndex) => currentIndex !== index);
    const removedCharacters = state.characters.filter((character) => character.worldId === removed.id);
    const nextCharacters = state.characters.filter((character) => character.worldId !== removed.id);
    const nextTriggers = removeTriggersForWorld(state.triggers, removed.id, removedCharacters);

    await saveConnectionData(nextWorlds, nextCharacters);
    await Promise.all(removedCharacters.map((character) => deleteNotes(character.id)));
    await Promise.all(removedCharacters.map((character) => deleteTranscriptHistory(character.id)));
    await saveTriggers(nextTriggers);
    onWorldDeleted?.(removed.id);
    patch({
      worlds: nextWorlds,
      characters: nextCharacters,
      triggers: nextTriggers,
    });
    onRecordsChanged?.();
  }

  async function deleteCharacter(index: number): Promise<void> {
    const state = getState();
    const removed = state.characters[index];
    if (!removed) {
      return;
    }

    const next = state.characters.filter((_, currentIndex) => currentIndex !== index);
    const nextTriggers = removeTriggersForCharacter(state.triggers, removed.id);

    await saveConnectionData(state.worlds, next);
    await deleteNotes(removed.id);
    await deleteTranscriptHistory(removed.id);
    await saveTriggers(nextTriggers);
    onCharacterDeleted?.(removed.id);
    patch({
      characters: next,
      triggers: nextTriggers,
      modalOpen: false,
      modalKind: null,
      worldEditingId: null,
      editingIndex: null,
      characterWorldId: null,
    });
    if (state.modalKind) {
      onModalWindowClose?.(state.modalKind);
    }
    onRecordsChanged?.();
  }

  return {
    openWorldModal,
    openCharacterModal,
    closeModal,
    saveWorld,
    saveCharacter,
    deleteWorld,
    deleteCharacter,
  };
}
