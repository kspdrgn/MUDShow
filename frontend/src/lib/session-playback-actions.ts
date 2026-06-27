import type { Writable } from 'svelte/store';
import type { MudConnection } from './connection';
import {
  appendTranscriptHistory,
  type TranscriptHistoryEntry,
  PlayTranscript,
  playBeep,
} from './playback';
import {
  loadNotes,
  loadTranscriptHistory,
  saveHighlights,
  saveNotes as persistNotes,
  saveTranscriptHistory,
} from './storage';
import { buildHighlightRegexes } from './formatting';
import {
  createInputBar,
  getInputBarInputId,
  getNextInputBarId,
  normalizeInputBars,
  type InputBarId,
} from './input-bars';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { nextFrame, focusElement, scrollElementToBottom } from './session-dom';

interface PlaybackActionContext {
  state: Writable<SessionState>;
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  connection: MudConnection;
  transcript: PlayTranscript;
  getHighlightRegexes: () => ReturnType<typeof buildHighlightRegexes>;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
}

export function createPlaybackActions({
  getState,
  patch,
  connection,
  transcript,
  getHighlightRegexes,
  setHighlightRegexes,
}: PlaybackActionContext) {
  let transcriptHistory: TranscriptHistoryEntry[] = [];

  function handleVisibilityChange(): void {
    const state = getState();

    if (!document.hidden) {
      patch({ hasNewActivity: false });

      if (!state.userScrolled) {
        scrollElementToBottom('output-area');
      }
    }
  }

  function handleGlobalKeyDown(event: KeyboardEvent): void {
    const state = getState();

    if (state.modalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        patch({ modalOpen: false });
      }
      return;
    }

    if (state.screen !== 'play') {
      return;
    }

    const hotkeyBar = state.inputBars.find((bar) => bar.label === event.key);

    if (hotkeyBar) {
      event.preventDefault();
      patch({ activeBar: hotkeyBar.id });
      focusElement(getInputBarInputId(hotkeyBar.id));
    } else if (event.key === 'F3') {
      event.preventDefault();
      void togglePanel('notes');
    } else if (event.key === 'F4') {
      event.preventDefault();
      void togglePanel('highlights');
    }
  }

  async function connectToCharacter(index: number): Promise<void> {
    const state = getState();
    const character = state.characters[index];
    if (!character) {
      return;
    }

    const maxHistoryLines = character.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;
    const highlightRegexes = buildHighlightRegexes(state.highlights);
    const [notes, history] = await Promise.all([
      loadNotes(character.name),
      loadTranscriptHistory(character.name, maxHistoryLines),
    ]);

    const historySnapshot = maxHistoryLines > 0
      ? transcript.loadHistory(history, highlightRegexes)
      : transcript.loadHistory([], highlightRegexes);

    transcriptHistory = history;
    setHighlightRegexes(highlightRegexes);

    const initialBar = state.inputBars[0]?.id ?? 1;

    patch({
      screen: 'play',
      currentCharacter: character,
      notesVisible: false,
      highlightsVisible: false,
      connectionStatus: 'idle',
      hasNewActivity: false,
      outputChunks: historySnapshot.chunks,
      outputEndsWithBr: historySnapshot.endsWithBr,
      userScrolled: false,
      activeBar: initialBar,
      notes,
    });

    focusElement(getInputBarInputId(initialBar));

    await connection.connect(
      {
        host: character.host,
        port: character.port,
        tls: character.tls !== false,
        verifyCertificate: character.verifyCertificate !== false,
      },
      {
        onOpen: () => {
          patch({ connectionStatus: 'connected' });
          void appendOutput(`\x1b[90m[connected to ${character.host}:${character.port}]\x1b[0m\n`);
        },
        onMessage: (text) => {
          void appendOutput(text);

          const current = getState();
          if (document.hidden && !current.hasNewActivity) {
            if (character.sound) {
              playBeep();
            }

            patch({ hasNewActivity: true });
          }
        },
        onClose: () => {
          patch({ connectionStatus: 'error' });
          void appendOutput('\x1b[90m[disconnected - press F5 to reconnect]\x1b[0m\n');
        },
        onError: (message) => {
          patch({ connectionStatus: 'error' });
          void appendOutput(`\x1b[31m[connection error] ${message}\x1b[0m\n`);
        },
      },
    );
  }

  async function appendOutput(rawText: string): Promise<void> {
    const state = getState();
    const next = transcript.append(rawText, getHighlightRegexes());
    const maxHistoryLines = state.currentCharacter?.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;

    if (state.currentCharacter && maxHistoryLines > 0) {
      transcriptHistory = appendTranscriptHistory(transcriptHistory, rawText, maxHistoryLines);
      void saveTranscriptHistory(state.currentCharacter.name, transcriptHistory, maxHistoryLines);
    }

    patch({
      outputChunks: next.chunks,
      outputEndsWithBr: next.endsWithBr,
    });

    await nextFrame();
    if (!state.userScrolled) {
      scrollElementToBottom('output-area');
    }
  }

  function handleOutputScroll(): void {
    const outputEl = document.getElementById('output-area');

    if (!outputEl) {
      return;
    }

    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    patch({ userScrolled: distance > 50 });
  }

  function handleInputFocus(bar: InputBarId): void {
    patch({ activeBar: bar });
  }

  function handleInputSubmit(_bar: InputBarId, value: string): void {
    if (!value.trim()) {
      return;
    }

    connection.send(value + '\r\n');

    const state = getState();
    if (!state.userScrolled) {
      scrollElementToBottom('output-area');
    }
  }

  function completeInput(value: string, selectionStart: number): { value: string; cursor: number } | null {
    return transcript.complete(value, selectionStart);
  }

  function resetCompletion(): void {
    transcript.resetCompletion();
  }

  async function togglePanel(panel: 'notes' | 'highlights'): Promise<void> {
    const state = getState();
    const shouldOpen = panel === 'notes' ? !state.notesVisible : !state.highlightsVisible;

    if (panel === 'notes') {
      patch({
        notesVisible: shouldOpen,
        highlightsVisible: false,
      });
    } else {
      patch({
        highlightsVisible: shouldOpen,
        notesVisible: false,
      });
    }

    await nextFrame();

    if (shouldOpen) {
      focusElement(panel === 'notes' ? 'notes-editor' : 'highlight-input');
    } else {
      focusElement(getInputBarInputId(getState().activeBar));
    }
  }

  async function addInputBarAfter(barId: InputBarId): Promise<void> {
    const state = getState();
    const currentIndex = state.inputBars.findIndex((bar) => bar.id === barId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : state.inputBars.length;
    const nextBar = createInputBar(getNextInputBarId(state.inputBars));

    const nextBars = normalizeInputBars([
      ...state.inputBars.slice(0, insertIndex),
      nextBar,
      ...state.inputBars.slice(insertIndex),
    ]);

    patch({
      inputBars: nextBars,
      activeBar: nextBar.id,
    });

    await nextFrame();
    focusElement(getInputBarInputId(nextBar.id));
  }

  async function removeInputBar(barId: InputBarId): Promise<void> {
    const state = getState();
    if (state.inputBars.length <= 1) {
      return;
    }

    const currentIndex = state.inputBars.findIndex((bar) => bar.id === barId);
    if (currentIndex < 0) {
      return;
    }

    const remainingBars = normalizeInputBars(
      state.inputBars.filter((bar) => bar.id !== barId),
    );

    const nextActiveBar =
      state.activeBar === barId
        ? remainingBars[Math.min(currentIndex, remainingBars.length - 1)]?.id ??
          remainingBars[remainingBars.length - 1]?.id ??
          remainingBars[0]?.id ??
          state.activeBar
        : state.activeBar;

    patch({
      inputBars: remainingBars,
      activeBar: nextActiveBar,
    });

    await nextFrame();
    focusElement(getInputBarInputId(nextActiveBar));
  }

  function resizeInputBar(barId: InputBarId, delta: -1 | 1): void {
    const state = getState();
    const nextBars = state.inputBars.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        lines: Math.min(10, Math.max(1, bar.lines + delta)),
      };
    });

    patch({ inputBars: normalizeInputBars(nextBars) });
  }

  function addHighlight(pattern: string, color: string): void {
    const trimmed = pattern.trim();

    if (!trimmed) {
      return;
    }

    const state = getState();
    const next = [...state.highlights, { pattern: trimmed, color }];
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function deleteHighlight(index: number): void {
    const state = getState();
    const next = [...state.highlights];
    next.splice(index, 1);
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function saveNotes(notes: string): void {
    const state = getState();

    if (!state.currentCharacter) {
      return;
    }

    void persistNotes(state.currentCharacter.name, notes);
    patch({ notes });
  }

  return {
    handleVisibilityChange,
    handleGlobalKeyDown,
    connectToCharacter,
    appendOutput,
    handleOutputScroll,
    handleInputFocus,
    handleInputSubmit,
    completeInput,
    resetCompletion,
    togglePanel,
    addInputBarAfter,
    removeInputBar,
    resizeInputBar,
    addHighlight,
    deleteHighlight,
    saveNotes,
  };
}
