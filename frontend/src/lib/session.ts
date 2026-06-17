import { writable, get } from 'svelte/store';
import type { Character, CharacterDraft, HighlightRule } from './types';
import { MudConnection } from './connection';
import {
  loadCharacters,
  loadHighlights,
  loadNotes,
  saveCharacters,
  saveHighlights,
  saveNotes as persistNotes,
} from './storage';
import { buildHighlightRegexes } from './formatting';
import { PlayTranscript, playBeep } from './playback';

export type Screen = 'list' | 'play';
export type ConnectionStatus = 'idle' | 'connected' | 'error';

export interface SessionState {
  characters: Character[];
  highlights: HighlightRule[];
  screen: Screen;
  currentCharacter: Character | null;
  outputChunks: string[];
  outputEndsWithBr: boolean;
  userScrolled: boolean;
  activeBar: 1 | 2;
  notesVisible: boolean;
  highlightsVisible: boolean;
  connectionStatus: ConnectionStatus;
  hasNewActivity: boolean;
  notes: string;
  modalOpen: boolean;
  modalTitle: string;
  editingIndex: number | null;
  modalDraft: CharacterDraft;
}

const INITIAL_DRAFT: CharacterDraft = {
  name: '',
  host: '',
  port: '',
  tls: true,
  width: '82',
  sound: false,
};

function createInitialState(): SessionState {
  return {
    characters: loadCharacters(),
    highlights: loadHighlights(),
    screen: 'list',
    currentCharacter: null,
    outputChunks: [],
    outputEndsWithBr: true,
    userScrolled: false,
    activeBar: 1,
    notesVisible: false,
    highlightsVisible: false,
    connectionStatus: 'idle',
    hasNewActivity: false,
    notes: '',
    modalOpen: false,
    modalTitle: 'add character',
    editingIndex: null,
    modalDraft: { ...INITIAL_DRAFT },
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

class MudSession {
  private readonly state = writable<SessionState>(createInitialState());
  private readonly connection = new MudConnection();
  private readonly transcript = new PlayTranscript();
  private highlightRegexes = buildHighlightRegexes(get(this.state).highlights);

  subscribe = this.state.subscribe;

  dispose(): void {
    this.connection.close();
  }

  getState(): SessionState {
    return get(this.state);
  }

  handleVisibilityChange(): void {
    const state = get(this.state);

    if (!document.hidden) {
      this.patch({ hasNewActivity: false });

      if (!state.userScrolled) {
        this.scrollToBottom();
      }
    }
  }

  handleGlobalKeyDown(event: KeyboardEvent): void {
    const state = get(this.state);

    if (state.modalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeModal();
      }
      return;
    }

    if (state.screen !== 'play') {
      return;
    }

    if (event.key === 'F1') {
      event.preventDefault();
      this.patch({ activeBar: 1 });
      this.focusBar(1);
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.patch({ activeBar: 2 });
      this.focusBar(2);
    } else if (event.key === 'F3') {
      event.preventDefault();
      void this.togglePanel('notes');
    } else if (event.key === 'F4') {
      event.preventDefault();
      void this.togglePanel('highlights');
    }
  }

  async openModal(index: number | null = null): Promise<void> {
    const state = get(this.state);
    const selected = index === null ? null : state.characters[index] ?? null;

    if (selected) {
      this.patch({
        modalTitle: 'edit character',
        editingIndex: index,
        modalDraft: {
          name: selected.name,
          host: selected.host,
          port: String(selected.port),
          tls: selected.tls !== false,
          width: String(selected.width ?? 82),
          sound: selected.sound === true,
        },
        modalOpen: true,
      });
    } else {
      this.patch({
        modalTitle: 'add character',
        editingIndex: null,
        modalDraft: { ...INITIAL_DRAFT },
        modalOpen: true,
      });
    }

    await nextFrame();
    document.getElementById('field-name')?.focus();
  }

  closeModal(): void {
    this.patch({ modalOpen: false });
  }

  saveCharacter(draft: CharacterDraft): void {
    const name = draft.name.trim();
    const host = draft.host.trim();
    const port = Number.parseInt(draft.port, 10);
    const width = Number.parseInt(draft.width, 10) || 82;
    const state = get(this.state);

    if (!name || !host || !Number.isFinite(port)) {
      return;
    }

    const nextCharacter: Character = {
      name,
      host,
      port,
      tls: draft.tls,
      width,
      sound: draft.sound,
    };

    const nextCharacters = [...state.characters];

    if (state.editingIndex === null) {
      nextCharacters.push(nextCharacter);
    } else {
      nextCharacters[state.editingIndex] = nextCharacter;
    }

    saveCharacters(nextCharacters);
    this.patch({
      characters: nextCharacters,
      modalOpen: false,
      editingIndex: null,
    });

    if (state.currentCharacter?.name === nextCharacter.name) {
      this.patch({ currentCharacter: nextCharacter });
    }
  }

  deleteCharacter(index: number): void {
    const state = get(this.state);
    const next = [...state.characters];
    next.splice(index, 1);
    saveCharacters(next);
    this.patch({ characters: next });
  }

  async connectToCharacter(index: number): Promise<void> {
    const state = get(this.state);
    const character = state.characters[index];
    if (!character) {
      return;
    }

    this.transcript.reset();
    this.highlightRegexes = buildHighlightRegexes(state.highlights);

    this.patch({
      screen: 'play',
      currentCharacter: character,
      notesVisible: false,
      highlightsVisible: false,
      connectionStatus: 'idle',
      hasNewActivity: false,
      outputChunks: [],
      outputEndsWithBr: true,
      userScrolled: false,
      activeBar: 1,
      notes: loadNotes(character.name),
    });

    this.focusBar(1);

    const url = `ws://localhost:8080?host=${encodeURIComponent(character.host)}&port=${character.port}&tls=${character.tls !== false}`;

    this.connection.connect(url, {
      onOpen: () => {
        this.patch({ connectionStatus: 'connected' });
        void this.appendOutput(`\x1b[90m[connected to ${character.host}:${character.port}]\x1b[0m\n`);
      },
      onMessage: (text) => {
        void this.appendOutput(text);

        const current = get(this.state);
        if (document.hidden && !current.hasNewActivity) {
          if (character.sound) {
            playBeep();
          }

          this.patch({ hasNewActivity: true });
        }
      },
      onClose: () => {
        this.patch({ connectionStatus: 'error' });
        void this.appendOutput('\x1b[90m[disconnected - press F5 to reconnect]\x1b[0m\n');
      },
      onError: () => {
        this.patch({ connectionStatus: 'error' });
        void this.appendOutput('\x1b[31m[connection error]\x1b[0m\n');
      },
    });
  }

  async appendOutput(rawText: string): Promise<void> {
    const state = get(this.state);
    const next = this.transcript.append(rawText, this.highlightRegexes);
    this.patch({
      outputChunks: next.chunks,
      outputEndsWithBr: next.endsWithBr,
    });

    await nextFrame();
    if (!state.userScrolled) {
      this.scrollToBottom();
    }
  }

  handleOutputScroll(): void {
    const outputEl = document.getElementById('output-area');

    if (!outputEl) {
      return;
    }

    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    this.patch({ userScrolled: distance > 50 });
  }

  handleInputFocus(bar: 1 | 2): void {
    this.patch({ activeBar: bar });
  }

  handleInputSubmit(bar: 1 | 2, value: string): void {
    if (!value.trim()) {
      return;
    }

    this.connection.send(value + '\r\n');

    const state = get(this.state);
    if (!state.userScrolled) {
      this.scrollToBottom();
    }
  }

  completeInput(value: string, selectionStart: number): { value: string; cursor: number } | null {
    return this.transcript.complete(value, selectionStart);
  }

  resetCompletion(): void {
    this.transcript.resetCompletion();
  }

  async togglePanel(panel: 'notes' | 'highlights'): Promise<void> {
    const state = get(this.state);
    const shouldOpen = panel === 'notes' ? !state.notesVisible : !state.highlightsVisible;

    if (panel === 'notes') {
      this.patch({
        notesVisible: shouldOpen,
        highlightsVisible: false,
      });
    } else {
      this.patch({
        highlightsVisible: shouldOpen,
        notesVisible: false,
      });
    }

    await nextFrame();

    if (shouldOpen) {
      if (panel === 'notes') {
        document.getElementById('notes-editor')?.focus();
      } else {
        document.getElementById('highlight-input')?.focus();
      }
    } else {
      this.focusBar(get(this.state).activeBar);
    }
  }

  addHighlight(pattern: string, color: string): void {
    const trimmed = pattern.trim();

    if (!trimmed) {
      return;
    }

    const state = get(this.state);
    const next = [...state.highlights, { pattern: trimmed, color }];
    saveHighlights(next);
    this.highlightRegexes = buildHighlightRegexes(next);
    this.patch({ highlights: next });
  }

  deleteHighlight(index: number): void {
    const state = get(this.state);
    const next = [...state.highlights];
    next.splice(index, 1);
    saveHighlights(next);
    this.highlightRegexes = buildHighlightRegexes(next);
    this.patch({ highlights: next });
  }

  saveNotes(notes: string): void {
    const state = get(this.state);

    if (!state.currentCharacter) {
      return;
    }

    persistNotes(state.currentCharacter.name, notes);
    this.patch({ notes });
  }

  private focusBar(bar: 1 | 2): void {
    document.getElementById(bar === 1 ? 'input1' : 'input2')?.focus();
  }

  private scrollToBottom(): void {
    const outputEl = document.getElementById('output-area');
    if (!outputEl) {
      return;
    }

    outputEl.scrollTop = outputEl.scrollHeight;
  }

  private patch(patch: Partial<SessionState>): void {
    this.state.update((state) => ({ ...state, ...patch }));
  }
}

export const session = new MudSession();
