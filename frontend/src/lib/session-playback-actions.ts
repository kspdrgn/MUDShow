import type { Writable } from 'svelte/store';
import type { MudConnection } from './connection';
import { loadNotes, saveHighlights, saveNotes as persistNotes } from './storage';
import { buildHighlightRegexes } from './formatting';
import { PlayTranscript, playBeep } from './playback';
import type { SessionState } from './session-state';
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

    if (event.key === 'F1') {
      event.preventDefault();
      patch({ activeBar: 1 });
      focusElement('input1');
    } else if (event.key === 'F2') {
      event.preventDefault();
      patch({ activeBar: 2 });
      focusElement('input2');
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

    transcript.reset();
    setHighlightRegexes(buildHighlightRegexes(state.highlights));

    patch({
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

    focusElement('input1');

    await connection.connect(
      {
        host: character.host,
        port: character.port,
        tls: character.tls !== false,
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

  function handleInputFocus(bar: 1 | 2): void {
    patch({ activeBar: bar });
  }

  function handleInputSubmit(_bar: 1 | 2, value: string): void {
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
      focusElement(getState().activeBar === 1 ? 'input1' : 'input2');
    }
  }

  function addHighlight(pattern: string, color: string): void {
    const trimmed = pattern.trim();

    if (!trimmed) {
      return;
    }

    const state = getState();
    const next = [...state.highlights, { pattern: trimmed, color }];
    saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function deleteHighlight(index: number): void {
    const state = getState();
    const next = [...state.highlights];
    next.splice(index, 1);
    saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function saveNotes(notes: string): void {
    const state = getState();

    if (!state.currentCharacter) {
      return;
    }

    persistNotes(state.currentCharacter.name, notes);
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
    addHighlight,
    deleteHighlight,
    saveNotes,
  };
}
