import type { InputBarConfig, InputBarId } from '../../input-bars';
import {
  getSpellcheckAnnotations,
  getSpellcheckSuggestions,
  getWordBounds,
  renderSpellcheckUnderlayHtml,
} from '../../spellcheck';
import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';

export interface InputBarsSpellcheckState {
  menuBar: InputBarId | null;
  menuPosition: { x: number; y: number };
  menuWord: string;
  menuSuggestions: string[];
  menuLoading: boolean;
  liveUnderlays: Record<InputBarId, string>;
  liveLoading: Record<InputBarId, boolean>;
  liveScrollX: Record<InputBarId, number>;
  liveScrollY: Record<InputBarId, number>;
}

export function createInputBarsSpellcheckState(): InputBarsSpellcheckState {
  return {
    menuBar: null,
    menuPosition: { x: 0, y: 0 },
    menuWord: '',
    menuSuggestions: [],
    menuLoading: false,
    liveUnderlays: {},
    liveLoading: {},
    liveScrollX: {},
    liveScrollY: {},
  };
}

export interface InputBarsSpellcheckControllerDeps {
  getInput: (bar: InputBarId) => HTMLTextAreaElement | null;
  onIgnoreWord: (word: string) => void;
  spellcheckEnabled: () => boolean;
  spellcheckLanguage: () => string;
  spellcheckIgnoredWords: () => string;
  spellcheckSuggestionLimit: () => number;
  spellcheckMinimumWordLength: () => number;
  spellcheckDebounceMs: () => number;
  updateState: (
    updater: (state: InputBarsSpellcheckState) => InputBarsSpellcheckState,
  ) => void;
}

function updateRecord<T>(record: Record<InputBarId, T>, bar: InputBarId, value: T): Record<InputBarId, T> {
  return {
    ...record,
    [bar]: value,
  };
}

function removeRecordKey<T>(record: Record<InputBarId, T>, bar: InputBarId): Record<InputBarId, T> {
  if (!(bar in record)) {
    return record;
  }

  const next = { ...record };
  delete next[bar];
  return next;
}

export function createInputBarsSpellcheckController(deps: InputBarsSpellcheckControllerDeps) {
  const liveTimers = new Map<InputBarId, number>();
  const liveSignatures = new Map<InputBarId, string>();
  const liveRequestTokens = new Map<InputBarId, number>();
  let menuRequestToken = 0;

  function updateState(
    updater: (state: InputBarsSpellcheckState) => InputBarsSpellcheckState,
  ): void {
    deps.updateState(updater);
  }

  function getLiveSpellcheckSignature(bar: InputBarId, value: string): string {
    return [
      bar,
      value,
      deps.spellcheckEnabled() ? '1' : '0',
      deps.spellcheckLanguage(),
      deps.spellcheckIgnoredWords(),
      deps.spellcheckSuggestionLimit(),
      deps.spellcheckMinimumWordLength(),
    ].join('\u0000');
  }

  function clearLiveSpellcheckTimer(bar: InputBarId): void {
    const timer = liveTimers.get(bar);
    if (timer !== undefined) {
      clearTimeout(timer);
      liveTimers.delete(bar);
    }
  }

  function clearLiveSpellcheck(bar: InputBarId): void {
    clearLiveSpellcheckTimer(bar);
    updateState((state) => ({
      ...state,
      liveUnderlays: updateRecord(state.liveUnderlays, bar, ''),
      liveLoading: updateRecord(state.liveLoading, bar, false),
      liveScrollX: updateRecord(state.liveScrollX, bar, 0),
      liveScrollY: updateRecord(state.liveScrollY, bar, 0),
    }));
  }

  async function refreshLiveSpellcheck(bar: InputBarId, value: string): Promise<void> {
    const signature = getLiveSpellcheckSignature(bar, value);
    liveSignatures.set(bar, signature);

    if (!deps.spellcheckEnabled()) {
      clearLiveSpellcheck(bar);
      return;
    }

    const token = (liveRequestTokens.get(bar) ?? 0) + 1;
    liveRequestTokens.set(bar, token);
    updateState((state) => ({
      ...state,
      liveLoading: updateRecord(state.liveLoading, bar, true),
    }));

    try {
      const annotations = await getSpellcheckAnnotations({
        text: value,
        word: '',
        language: deps.spellcheckLanguage(),
        ignoredWords: deps.spellcheckIgnoredWords(),
        minimumWordLength: deps.spellcheckMinimumWordLength(),
        suggestionLimit: deps.spellcheckSuggestionLimit(),
      });

      if ((liveRequestTokens.get(bar) ?? 0) !== token) {
        return;
      }

      updateState((state) => ({
        ...state,
        liveUnderlays: updateRecord(state.liveUnderlays, bar, renderSpellcheckUnderlayHtml(value, annotations)),
      }));
    } catch (error) {
      if ((liveRequestTokens.get(bar) ?? 0) === token) {
        console.error('failed to fetch live spellcheck annotations:', error);
        updateState((state) => ({
          ...state,
          liveUnderlays: updateRecord(state.liveUnderlays, bar, ''),
        }));
      }
    } finally {
      if ((liveRequestTokens.get(bar) ?? 0) === token) {
        updateState((state) => ({
          ...state,
          liveLoading: updateRecord(state.liveLoading, bar, false),
        }));
      }
    }
  }

  function scheduleLiveSpellcheck(bar: InputBarId, value: string): void {
    const signature = getLiveSpellcheckSignature(bar, value);

    if (liveSignatures.get(bar) === signature) {
      return;
    }

    liveSignatures.set(bar, signature);
    clearLiveSpellcheckTimer(bar);

    if (!deps.spellcheckEnabled()) {
      clearLiveSpellcheck(bar);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshLiveSpellcheck(bar, value);
    }, deps.spellcheckDebounceMs());

    liveTimers.set(bar, timer);
  }

  function syncLiveSpellcheckScroll(bar: InputBarId, event: Event): void {
    const input = event.currentTarget as HTMLTextAreaElement | null;
    if (!input) {
      return;
    }

    updateState((state) => ({
      ...state,
      liveScrollX: updateRecord(state.liveScrollX, bar, input.scrollLeft),
      liveScrollY: updateRecord(state.liveScrollY, bar, input.scrollTop),
    }));
  }

  function clearSpellcheckMenu(): void {
    menuRequestToken += 1;
    updateState((state) => ({
      ...state,
      menuBar: null,
      menuWord: '',
      menuSuggestions: [],
      menuLoading: false,
    }));
  }

  async function loadSpellcheckMenuSuggestions(bar: InputBarId, word: string): Promise<void> {
    const token = ++menuRequestToken;
    const normalizedWord = word.trim();

    if (!normalizedWord || normalizedWord.length < deps.spellcheckMinimumWordLength()) {
      if (menuRequestToken === token) {
        updateState((state) => ({
          ...state,
          menuSuggestions: [],
          menuLoading: false,
        }));
      }
      return;
    }

    updateState((state) => ({
      ...state,
      menuLoading: true,
    }));

    try {
      const suggestions = await getSpellcheckSuggestions({
        word: normalizedWord,
        language: deps.spellcheckLanguage(),
        ignoredWords: deps.spellcheckIgnoredWords(),
        minimumWordLength: deps.spellcheckMinimumWordLength(),
        suggestionLimit: deps.spellcheckSuggestionLimit(),
      });

      if (menuRequestToken !== token) {
        return;
      }

      updateState((state) =>
        state.menuBar === bar
          ? {
              ...state,
              menuSuggestions: suggestions,
            }
          : state,
      );
    } catch (error) {
      if (menuRequestToken === token) {
        console.error('failed to fetch spellcheck suggestions:', error);
        updateState((state) => ({
          ...state,
          menuSuggestions: [],
        }));
      }
    } finally {
      if (menuRequestToken === token) {
        updateState((state) => ({
          ...state,
          menuLoading: false,
        }));
      }
    }
  }

  function getSpellcheckInput(bar: InputBarId): HTMLTextAreaElement | null {
    return deps.getInput(bar);
  }

  function applyReplacement(bar: InputBarId, replacement: string, start?: number, end?: number): void {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    const selectionStart = start ?? input.selectionStart ?? 0;
    const selectionEnd = end ?? input.selectionEnd ?? selectionStart;
    input.setRangeText(replacement, selectionStart, selectionEnd, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  function handleChooseSuggestion(bar: InputBarId, replacement: string): void {
    applyReplacement(bar, replacement);
    clearSpellcheckMenu();
  }

  async function handleCopySpellcheck(bar: InputBarId): Promise<void> {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const selectedText = input.value.slice(selectionStart, selectionEnd);
    if (!selectedText) {
      return;
    }

    try {
      await copyTextToClipboard(selectedText);
    } catch (error) {
      console.error('failed to copy spellcheck selection:', error);
    }
  }

  async function handleCutSpellcheck(bar: InputBarId): Promise<void> {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const selectedText = input.value.slice(selectionStart, selectionEnd);
    if (!selectedText) {
      return;
    }

    try {
      await copyTextToClipboard(selectedText);
      applyReplacement(bar, '', selectionStart, selectionEnd);
    } catch (error) {
      console.error('failed to cut spellcheck selection:', error);
    }
  }

  async function handlePasteSpellcheck(bar: InputBarId): Promise<void> {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    try {
      const pastedText = await readTextFromClipboard();
      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? selectionStart;
      applyReplacement(bar, pastedText, selectionStart, selectionEnd);
    } catch (error) {
      console.error('failed to paste spellcheck text:', error);
    }
  }

  function handleSelectAllSpellcheck(bar: InputBarId): void {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(0, input.value.length);
  }

  function openSpellcheckMenu(bar: InputBarId, event: MouseEvent): void {
    const input = getSpellcheckInput(bar);
    if (!input) {
      return;
    }

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const selectedText = input.value.slice(selectionStart, selectionEnd).trim();
    const word = getWordBounds(input.value, selectionStart, selectionEnd);

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'spellcheck' } }));
    updateState((state) => ({
      ...state,
      menuBar: bar,
      menuPosition: {
        x: event.clientX,
        y: event.clientY,
      },
      menuWord: selectedText || word?.word || '',
      menuSuggestions: [],
      menuLoading: false,
    }));
    void loadSpellcheckMenuSuggestions(bar, selectedText || word?.word || '');
  }

  function handleIgnoreOnce(): void {
    clearSpellcheckMenu();
  }

  function handleIgnoreAlways(): void {
    updateState((current) => {
      if (current.menuWord) {
        deps.onIgnoreWord(current.menuWord);
      }

      return {
        ...current,
        menuBar: null,
        menuWord: '',
        menuSuggestions: [],
        menuLoading: false,
      };
    });
    menuRequestToken += 1;
  }

  function syncBars(bars: InputBarConfig[]): void {
    const barIds = new Set(bars.map((bar) => bar.id));

    updateState((state) => {
      let next = state;
      let changed = false;

      for (const bar of bars) {
        if (!(bar.id in next.liveUnderlays)) {
          next = {
            ...next,
            liveUnderlays: updateRecord(next.liveUnderlays, bar.id, ''),
            liveLoading: updateRecord(next.liveLoading, bar.id, false),
            liveScrollX: updateRecord(next.liveScrollX, bar.id, 0),
            liveScrollY: updateRecord(next.liveScrollY, bar.id, 0),
          };
          changed = true;
        }
      }

      for (const key of Object.keys(next.liveUnderlays)) {
        const barId = Number(key) as InputBarId;
        if (barIds.has(barId)) {
          continue;
        }

        clearLiveSpellcheckTimer(barId);
        liveSignatures.delete(barId);
        liveRequestTokens.delete(barId);
        next = {
          ...next,
          liveUnderlays: removeRecordKey(next.liveUnderlays, barId),
          liveLoading: removeRecordKey(next.liveLoading, barId),
          liveScrollX: removeRecordKey(next.liveScrollX, barId),
          liveScrollY: removeRecordKey(next.liveScrollY, barId),
        };
        changed = true;
      }

      if (next.menuBar !== null && !barIds.has(next.menuBar)) {
        menuRequestToken += 1;
        next = {
          ...next,
          menuBar: null,
          menuWord: '',
          menuSuggestions: [],
          menuLoading: false,
        };
        changed = true;
      }

      return changed ? next : state;
    });
  }

  function destroy(): void {
    for (const timer of liveTimers.values()) {
      clearTimeout(timer);
    }

    liveTimers.clear();
    liveSignatures.clear();
    liveRequestTokens.clear();
    menuRequestToken += 1;
  }

  return {
    syncBars,
    scheduleLiveSpellcheck,
    syncLiveSpellcheckScroll,
    openSpellcheckMenu,
    clearSpellcheckMenu,
    handleChooseSuggestion,
    handleCopySpellcheck,
    handleCutSpellcheck,
    handlePasteSpellcheck,
    handleSelectAllSpellcheck,
    handleIgnoreOnce,
    handleIgnoreAlways,
    destroy,
  };
}
