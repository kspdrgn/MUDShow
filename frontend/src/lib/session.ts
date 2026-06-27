import { get, writable } from 'svelte/store';
import { MudConnection } from './connection';
import { buildHighlightRegexes } from './formatting';
import { PlayTranscript } from './playback';
import { createCharacterActions } from './session-character-actions';
import { createInitialState, type SessionState } from './session-state';
import { createPlaybackActions } from './session-playback-actions';
import { loadSessionData } from './storage';

function createSession() {
  const state = writable<SessionState>(createInitialState());
  const connection = new MudConnection();
  const transcript = new PlayTranscript();
  let highlightRegexes = buildHighlightRegexes(get(state).highlights);

  const getState = () => get(state);
  const patch = (partial: Partial<SessionState>) => {
    state.update((current) => ({ ...current, ...partial }));
  };

  const load = async () => {
    try {
      const { characters, highlights } = await loadSessionData();
      patch({ characters, highlights });
      highlightRegexes = buildHighlightRegexes(highlights);
    } catch (error) {
      console.error('failed to load persisted session data:', error);
    }
  };

  const characterActions = createCharacterActions({
    state,
    getState,
    patch,
  });

  const playbackActions = createPlaybackActions({
    state,
    getState,
    patch,
    connection,
    transcript,
    getHighlightRegexes: () => highlightRegexes,
    setHighlightRegexes: (regexes) => {
      highlightRegexes = regexes;
    },
  });

  return {
    subscribe: state.subscribe,
    load,
    dispose: () => connection.close(),
    ...characterActions,
    ...playbackActions,
  };
}

export const session = createSession();
