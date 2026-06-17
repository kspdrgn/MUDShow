import type { Character, HighlightRule } from './types';
import { MudConnection } from './connection';
import { loadNotes, saveCharacters, saveHighlights, saveNotes } from './storage';
import { buildHighlightRegexes } from './formatting';
import { PlayTranscript, playBeep } from './playback';

export type Screen = 'list' | 'play';
export type ConnectionStatus = 'idle' | 'connected' | 'error';

export interface SessionUi {
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
  highlightInput: string;
  highlightColor: string;
  inputOne: string;
  inputTwo: string;
  modalOpen: boolean;
  modalTitle: string;
  editingIndex: number | null;
  modalName: string;
  modalHost: string;
  modalPort: string;
  modalTls: boolean;
  modalWidth: string;
  modalSound: boolean;
}

export interface SessionBindings {
  setUi(patch: Partial<SessionUi>): void;
  getUi(): SessionUi;
  getCharacters(): Character[];
  setCharacters(next: Character[]): void;
  getHighlights(): HighlightRule[];
  setHighlights(next: HighlightRule[]): void;
  focusBar(bar: 1 | 2): void;
  focusNotes(): void;
  focusHighlights(): void;
  scrollToBottom(): void;
  getTranscriptElement(): HTMLDivElement | null;
}

export class MudSessionController {
  private readonly connection = new MudConnection();
  private readonly transcript = new PlayTranscript();
  private highlightRegexes: ReturnType<typeof buildHighlightRegexes> = [];

  constructor(private readonly bindings: SessionBindings) {
    this.highlightRegexes = buildHighlightRegexes(bindings.getHighlights());
  }

  refreshHighlights(): void {
    this.highlightRegexes = buildHighlightRegexes(this.bindings.getHighlights());
  }

  dispose(): void {
    this.connection.close();
  }

  handleVisibilityChange(): void {
    const ui = this.bindings.getUi();

    if (!document.hidden) {
      this.bindings.setUi({ hasNewActivity: false });

      if (!ui.userScrolled) {
        this.bindings.scrollToBottom();
      }
    }
  }

  handleGlobalKeyDown(event: KeyboardEvent): void {
    const ui = this.bindings.getUi();

    if (ui.modalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeModal();
      }
      return;
    }

    if (ui.screen !== 'play') {
      return;
    }

    if (event.key === 'F1') {
      event.preventDefault();
      this.bindings.setUi({ activeBar: 1 });
      this.bindings.focusBar(1);
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.bindings.setUi({ activeBar: 2 });
      this.bindings.focusBar(2);
    } else if (event.key === 'F3') {
      event.preventDefault();
      void this.togglePanel('notes');
    } else if (event.key === 'F4') {
      event.preventDefault();
      void this.togglePanel('highlights');
    }
  }

  async openModal(index: number | null = null): Promise<void> {
    const characters = this.bindings.getCharacters();
    const selected = index === null ? null : characters[index] ?? null;

    if (selected) {
      this.bindings.setUi({
        modalTitle: 'edit character',
        editingIndex: index,
        modalName: selected.name,
        modalHost: selected.host,
        modalPort: String(selected.port),
        modalTls: selected.tls !== false,
        modalWidth: String(selected.width ?? 82),
        modalSound: selected.sound === true,
        modalOpen: true,
      });
    } else {
      this.bindings.setUi({
        modalTitle: 'add character',
        editingIndex: null,
        modalName: '',
        modalHost: '',
        modalPort: '',
        modalTls: true,
        modalWidth: '82',
        modalSound: false,
        modalOpen: true,
      });
    }

    await Promise.resolve();
    document.getElementById('field-name')?.focus();
  }

  closeModal(): void {
    this.bindings.setUi({ modalOpen: false, editingIndex: null });
  }

  saveCharacter(): void {
    const ui = this.bindings.getUi();
    const name = ui.modalName.trim();
    const host = ui.modalHost.trim();
    const port = Number.parseInt(ui.modalPort, 10);
    const width = Number.parseInt(ui.modalWidth, 10) || 82;

    if (!name || !host || !Number.isFinite(port)) {
      return;
    }

    const nextCharacter: Character = {
      name,
      host,
      port,
      tls: ui.modalTls,
      width,
      sound: ui.modalSound,
    };

    const characters = this.bindings.getCharacters();
    const next = [...characters];

    if (ui.editingIndex === null) {
      next.push(nextCharacter);
    } else {
      next[ui.editingIndex] = nextCharacter;
    }

    this.bindings.setCharacters(next);
    saveCharacters(next);
    this.closeModal();
  }

  deleteCharacter(index: number): void {
    const next = [...this.bindings.getCharacters()];
    next.splice(index, 1);
    this.bindings.setCharacters(next);
    saveCharacters(next);
  }

  async connectToCharacter(index: number): Promise<void> {
    const character = this.bindings.getCharacters()[index];
    if (!character) {
      return;
    }

    this.bindings.setUi({
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
      inputOne: '',
      inputTwo: '',
      notes: loadNotes(character.name),
    });

    this.transcript.reset();
    this.refreshHighlights();
    this.bindings.focusBar(1);

    const url = `ws://localhost:8080?host=${encodeURIComponent(character.host)}&port=${character.port}&tls=${character.tls !== false}`;

    this.connection.connect(url, {
      onOpen: () => {
        this.bindings.setUi({ connectionStatus: 'connected' });
        void this.appendOutput(`\x1b[90m[connected to ${character.host}:${character.port}]\x1b[0m\n`);
      },
      onMessage: (text) => {
        void this.appendOutput(text);

        const ui = this.bindings.getUi();
        if (document.hidden && !ui.hasNewActivity) {
          if (character.sound) {
            playBeep();
          }

          this.bindings.setUi({ hasNewActivity: true });
        }
      },
      onClose: () => {
        this.bindings.setUi({ connectionStatus: 'error' });
        void this.appendOutput('\x1b[90m[disconnected - press F5 to reconnect]\x1b[0m\n');
      },
      onError: () => {
        this.bindings.setUi({ connectionStatus: 'error' });
        void this.appendOutput('\x1b[31m[connection error]\x1b[0m\n');
      },
    });
  }

  async appendOutput(rawText: string): Promise<void> {
    const next = this.transcript.append(rawText, this.highlightRegexes);
    this.bindings.setUi({
      outputChunks: next.chunks,
      outputEndsWithBr: next.endsWithBr,
    });

    await Promise.resolve();
    const ui = this.bindings.getUi();
    if (!ui.userScrolled) {
      this.bindings.scrollToBottom();
    }
  }

  handleOutputScroll(): void {
    const outputEl = this.bindings.getTranscriptElement();
    if (!outputEl) {
      return;
    }

    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    this.bindings.setUi({ userScrolled: distance > 50 });
  }

  handleInputFocus(bar: 1 | 2): void {
    this.bindings.setUi({ activeBar: bar });
  }

  async handleInputKeydown(event: KeyboardEvent, bar: 1 | 2): Promise<void> {
    const ui = this.bindings.getUi();
    const currentValue = bar === 1 ? ui.inputOne : ui.inputTwo;
    const selectionStart = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.selectionStart : null;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.sendInput(currentValue);

      this.bindings.setUi({
        inputOne: bar === 1 ? '' : ui.inputOne,
        inputTwo: bar === 2 ? '' : ui.inputTwo,
      });

      this.transcript.resetCompletion();
      await Promise.resolve();

      if (!this.bindings.getUi().userScrolled) {
        this.bindings.scrollToBottom();
      }

      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const result = this.transcript.complete(currentValue, selectionStart ?? currentValue.length);

      if (!result) {
        return;
      }

      this.bindings.setUi({
        inputOne: bar === 1 ? result.value : ui.inputOne,
        inputTwo: bar === 2 ? result.value : ui.inputTwo,
      });

      await Promise.resolve();

      if (event.currentTarget instanceof HTMLInputElement) {
        event.currentTarget.setSelectionRange(result.cursor, result.cursor);
      }

      return;
    }

    if (event.key !== 'Shift') {
      this.transcript.resetCompletion();
    }
  }

  async togglePanel(panel: 'notes' | 'highlights'): Promise<void> {
    const ui = this.bindings.getUi();
    const shouldOpen = panel === 'notes' ? !ui.notesVisible : !ui.highlightsVisible;

    if (panel === 'notes') {
      this.bindings.setUi({
        notesVisible: shouldOpen,
        highlightsVisible: false,
      });
    } else {
      this.bindings.setUi({
        highlightsVisible: shouldOpen,
        notesVisible: false,
      });
    }

    await Promise.resolve();

    if (shouldOpen) {
      if (panel === 'notes') {
        this.bindings.focusNotes();
      } else {
        this.bindings.focusHighlights();
      }
    } else {
      this.bindings.focusBar(this.bindings.getUi().activeBar);
    }
  }

  addHighlight(): void {
    const ui = this.bindings.getUi();
    const pattern = ui.highlightInput.trim();

    if (!pattern) {
      return;
    }

    const next = [...this.bindings.getHighlights(), { pattern, color: ui.highlightColor }];
    this.bindings.setHighlights(next);
    saveHighlights(next);
    this.refreshHighlights();
    this.bindings.setUi({ highlightInput: '' });
    this.bindings.focusHighlights();
  }

  deleteHighlight(index: number): void {
    const next = [...this.bindings.getHighlights()];
    next.splice(index, 1);
    this.bindings.setHighlights(next);
    saveHighlights(next);
    this.refreshHighlights();
  }

  handleNotesInput(): void {
    const ui = this.bindings.getUi();
    if (ui.currentCharacter) {
      saveNotes(ui.currentCharacter.name, ui.notes);
    }
  }

  private sendInput(value: string): void {
    if (!value.trim()) {
      return;
    }

    this.connection.send(value + '\r\n');
  }
}
