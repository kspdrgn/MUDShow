<script lang="ts">
import { tick } from 'svelte';
import { onDestroy, onMount } from 'svelte';
import StatusDot from './StatusDot.svelte';
import SpellcheckContextMenu from './SpellcheckContextMenu.svelte';
import {
  getSpellcheckAnnotations,
  getSpellcheckSuggestions,
  getWordBounds,
  renderSpellcheckUnderlayHtml,
} from '../../spellcheck';
  import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
  import {
    clampInputBarLines,
    getScopedInputBarContainerId,
    getScopedInputBarInputId,
    MAX_INPUT_BAR_LINES,
    MIN_INPUT_BAR_LINES,
    type InputBarConfig,
    type InputBarId,
  } from '../../input-bars';

  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let hasNewActivity = false;
  export let loggingActive = false;
  export let onFocusBar: (bar: InputBarId) => void;
  export let onSubmit: (bar: InputBarId, value: string) => void;
  export let onComplete: (
    bar: InputBarId,
    value: string,
    selectionStart: number
  ) => { value: string; cursor: number } | null;
  export let onAddBar: (bar: InputBarId) => void;
  export let onRemoveBar: (bar: InputBarId) => void;
  export let onResizeBar: (bar: InputBarId, delta: -1 | 1) => void;
  export let onOutputScrollKey: (key: string) => void;
  export let spellcheckEnabled = true;
  export let spellcheckLanguage = 'en-US';
  export let spellcheckIgnoredWords = '';
  export let spellcheckSuggestionLimit = 5;
  export let spellcheckMinimumWordLength = 3;
  export let spellcheckDebounceMs = 250;
  export let onIgnoreWord: (word: string) => void;
  export let scope = 'world';

  const HISTORY_LIMIT = 50;
  const CONTROL_FADE_DELAY = 1400;

  interface HistoryBrowseState {
    cursor: number | null;
    editIndex: number | null;
  }

  let values: Record<InputBarId, string> = {};
  let history: string[] = [];
  let historyState: Record<InputBarId, HistoryBrowseState> = {};
  let controlsVisible: Record<InputBarId, boolean> = {};
  let spellcheckMenuBar: InputBarId | null = null;
  let spellcheckMenuPosition = { x: 0, y: 0 };
  let spellcheckMenuWord = '';
  let spellcheckMenuSuggestions: string[] = [];
  let spellcheckMenuLoading = false;
  let spellcheckMenuRequestToken = 0;
  let liveSpellcheckUnderlays: Record<InputBarId, string> = {};
  let liveSpellcheckLoading: Record<InputBarId, boolean> = {};
  let liveSpellcheckSignatures: Record<InputBarId, string> = {};
  let liveSpellcheckTimers = new Map<InputBarId, ReturnType<typeof setTimeout>>();
  let liveSpellcheckRequestTokens: Record<InputBarId, number> = {};
  let liveSpellcheckScrollX: Record<InputBarId, number> = {};
  let liveSpellcheckScrollY: Record<InputBarId, number> = {};
  let lastSelectedBar: InputBarId = activeBar;
  const controlTimers = new Map<InputBarId, ReturnType<typeof setTimeout>>();

  $: lastSelectedBar = activeBar;

  function getInput(bar: InputBarId): HTMLTextAreaElement | null {
    return document.getElementById(getScopedInputBarInputId(scope, bar)) as HTMLTextAreaElement | null;
  }

  function focusBar(bar: InputBarId): void {
    getInput(bar)?.focus();
  }

  async function restoreFocus(): Promise<void> {
    await tick();

    const nextBar = bars.find((bar) => bar.id === activeBar) ?? bars[0];

    if (nextBar) {
      focusBar(nextBar.id);
    }
  }

  function clearControlTimer(bar: InputBarId): void {
    const timer = controlTimers.get(bar);

    if (timer !== undefined) {
      clearTimeout(timer);
      controlTimers.delete(bar);
    }
  }

  function setControlVisibility(bar: InputBarId, visible: boolean): void {
    controlsVisible = {
      ...controlsVisible,
      [bar]: visible,
    };
  }

  function scheduleControlFade(bar: InputBarId): void {
    clearControlTimer(bar);
    setControlVisibility(bar, true);

    const timer = window.setTimeout(() => {
      setControlVisibility(bar, false);
      controlTimers.delete(bar);
    }, CONTROL_FADE_DELAY);

    controlTimers.set(bar, timer);
  }

  function syncBars(): void {
    const barIds = new Set(bars.map((bar) => bar.id));
    let nextValues = values;
    let nextHistoryState = historyState;
    let nextControlsVisible = controlsVisible;
    let nextLiveSpellcheckUnderlays = liveSpellcheckUnderlays;
    let nextLiveSpellcheckLoading = liveSpellcheckLoading;
    let nextLiveSpellcheckSignatures = liveSpellcheckSignatures;
    let nextLiveSpellcheckRequestTokens = liveSpellcheckRequestTokens;
    let nextLiveSpellcheckScrollX = liveSpellcheckScrollX;
    let nextLiveSpellcheckScrollY = liveSpellcheckScrollY;
    let changed = false;

    for (const bar of bars) {
      if (!(bar.id in nextValues)) {
        nextValues = { ...nextValues, [bar.id]: '' };
        changed = true;
      }

      if (!(bar.id in nextHistoryState)) {
        nextHistoryState = {
          ...nextHistoryState,
          [bar.id]: { cursor: null, editIndex: null },
        };
        changed = true;
      }

      if (!(bar.id in nextControlsVisible)) {
        nextControlsVisible = { ...nextControlsVisible, [bar.id]: true };
        changed = true;
        scheduleControlFade(bar.id);
      }

      if (!(bar.id in nextLiveSpellcheckUnderlays)) {
        nextLiveSpellcheckUnderlays = { ...nextLiveSpellcheckUnderlays, [bar.id]: '' };
        changed = true;
      }

      if (!(bar.id in nextLiveSpellcheckLoading)) {
        nextLiveSpellcheckLoading = { ...nextLiveSpellcheckLoading, [bar.id]: false };
        changed = true;
      }

      if (!(bar.id in nextLiveSpellcheckSignatures)) {
        nextLiveSpellcheckSignatures = { ...nextLiveSpellcheckSignatures, [bar.id]: '' };
        changed = true;
      }

      if (!(bar.id in nextLiveSpellcheckRequestTokens)) {
        nextLiveSpellcheckRequestTokens = { ...nextLiveSpellcheckRequestTokens, [bar.id]: 0 };
        changed = true;
      }

      if (!(bar.id in nextLiveSpellcheckScrollX)) {
        nextLiveSpellcheckScrollX = { ...nextLiveSpellcheckScrollX, [bar.id]: 0 };
        changed = true;
      }

      if (!(bar.id in nextLiveSpellcheckScrollY)) {
        nextLiveSpellcheckScrollY = { ...nextLiveSpellcheckScrollY, [bar.id]: 0 };
        changed = true;
      }
    }

    for (const key of Object.keys(nextValues)) {
      const barId = Number(key) as InputBarId;

      if (!barIds.has(barId)) {
        delete nextValues[barId];
        changed = true;
      }
    }

    for (const key of Object.keys(nextHistoryState)) {
      const barId = Number(key) as InputBarId;

      if (!barIds.has(barId)) {
        delete nextHistoryState[barId];
        changed = true;
      }
    }

    for (const key of Object.keys(nextControlsVisible)) {
      const barId = Number(key) as InputBarId;

      if (!barIds.has(barId)) {
        clearControlTimer(barId);
        delete nextControlsVisible[barId];
        changed = true;
      }
    }

    for (const key of Object.keys(nextLiveSpellcheckUnderlays)) {
      const barId = Number(key) as InputBarId;

      if (!barIds.has(barId)) {
        clearLiveSpellcheckTimer(barId);
        delete nextLiveSpellcheckUnderlays[barId];
        delete nextLiveSpellcheckLoading[barId];
        delete nextLiveSpellcheckSignatures[barId];
        delete nextLiveSpellcheckRequestTokens[barId];
        delete nextLiveSpellcheckScrollX[barId];
        delete nextLiveSpellcheckScrollY[barId];
        changed = true;
      }
    }

    if (changed) {
      values = nextValues;
      historyState = nextHistoryState;
      controlsVisible = nextControlsVisible;
      liveSpellcheckUnderlays = nextLiveSpellcheckUnderlays;
      liveSpellcheckLoading = nextLiveSpellcheckLoading;
      liveSpellcheckSignatures = nextLiveSpellcheckSignatures;
      liveSpellcheckRequestTokens = nextLiveSpellcheckRequestTokens;
      liveSpellcheckScrollX = nextLiveSpellcheckScrollX;
      liveSpellcheckScrollY = nextLiveSpellcheckScrollY;
    }

    if (bars.length > 0 && !barIds.has(activeBar)) {
      const nextBar = bars[0];
      onFocusBar(nextBar.id);
      focusBar(nextBar.id);
    }
  }

  let previousBarSignature = '';

  $: {
    const nextSignature = bars.map((bar) => `${bar.id}:${bar.lines}:${bar.showStatusDot}`).join('|');

    if (nextSignature !== previousBarSignature) {
      previousBarSignature = nextSignature;
      syncBars();
    }
  }

  $: {
    values;
    spellcheckEnabled;
    spellcheckLanguage;
    spellcheckIgnoredWords;
    spellcheckSuggestionLimit;
    spellcheckMinimumWordLength;
    spellcheckDebounceMs;

    for (const bar of bars) {
      const currentValue = values[bar.id] ?? '';
      const signature = getLiveSpellcheckSignature(bar.id, currentValue);

      if (liveSpellcheckSignatures[bar.id] === signature) {
        continue;
      }

      scheduleLiveSpellcheck(bar.id, currentValue);
    }
  }

  onMount(() => {
    const initialBar = bars.find((bar) => bar.id === lastSelectedBar) ?? bars[0];

    if (initialBar) {
      focusBar(initialBar.id);
    }
  });

  onDestroy(() => {
    for (const timer of controlTimers.values()) {
      clearTimeout(timer);
    }

    controlTimers.clear();

    for (const timer of liveSpellcheckTimers.values()) {
      clearTimeout(timer);
    }

    liveSpellcheckTimers.clear();
  });

  function getValue(bar: InputBarId): string {
    return values[bar] ?? '';
  }

  function setValue(bar: InputBarId, value: string): void {
    values = {
      ...values,
      [bar]: value,
    };
  }

  function getLiveSpellcheckSignature(bar: InputBarId, value: string): string {
    return [
      bar,
      value,
      spellcheckEnabled ? '1' : '0',
      spellcheckLanguage,
      spellcheckIgnoredWords,
      spellcheckSuggestionLimit,
      spellcheckMinimumWordLength,
    ].join('\u0000');
  }

  function clearLiveSpellcheckTimer(bar: InputBarId): void {
    const timer = liveSpellcheckTimers.get(bar);
    if (timer !== undefined) {
      clearTimeout(timer);
      liveSpellcheckTimers.delete(bar);
    }
  }

  function clearLiveSpellcheck(bar: InputBarId): void {
    clearLiveSpellcheckTimer(bar);
    liveSpellcheckUnderlays = {
      ...liveSpellcheckUnderlays,
      [bar]: '',
    };
    liveSpellcheckLoading = {
      ...liveSpellcheckLoading,
      [bar]: false,
    };
    liveSpellcheckScrollX = {
      ...liveSpellcheckScrollX,
      [bar]: 0,
    };
    liveSpellcheckScrollY = {
      ...liveSpellcheckScrollY,
      [bar]: 0,
    };
  }

  async function refreshLiveSpellcheck(bar: InputBarId, value: string): Promise<void> {
    const signature = getLiveSpellcheckSignature(bar, value);
    liveSpellcheckSignatures = {
      ...liveSpellcheckSignatures,
      [bar]: signature,
    };

    if (!spellcheckEnabled) {
      clearLiveSpellcheck(bar);
      return;
    }

    const token = (liveSpellcheckRequestTokens[bar] ?? 0) + 1;
    liveSpellcheckRequestTokens = {
      ...liveSpellcheckRequestTokens,
      [bar]: token,
    };
    liveSpellcheckLoading = {
      ...liveSpellcheckLoading,
      [bar]: true,
    };

    try {
      const annotations = await getSpellcheckAnnotations({
        text: value,
        word: '',
        language: spellcheckLanguage,
        ignoredWords: spellcheckIgnoredWords,
        minimumWordLength: spellcheckMinimumWordLength,
        suggestionLimit: spellcheckSuggestionLimit,
      });

      if ((liveSpellcheckRequestTokens[bar] ?? 0) !== token) {
        return;
      }

      liveSpellcheckUnderlays = {
        ...liveSpellcheckUnderlays,
        [bar]: renderSpellcheckUnderlayHtml(value, annotations),
      };
    } catch (error) {
      if ((liveSpellcheckRequestTokens[bar] ?? 0) === token) {
        console.error('failed to fetch live spellcheck annotations:', error);
        liveSpellcheckUnderlays = {
          ...liveSpellcheckUnderlays,
          [bar]: '',
        };
      }
    } finally {
      if ((liveSpellcheckRequestTokens[bar] ?? 0) === token) {
        liveSpellcheckLoading = {
          ...liveSpellcheckLoading,
          [bar]: false,
        };
      }
    }
  }

  function scheduleLiveSpellcheck(bar: InputBarId, value: string): void {
    clearLiveSpellcheckTimer(bar);

    if (!spellcheckEnabled) {
      clearLiveSpellcheck(bar);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshLiveSpellcheck(bar, value);
    }, spellcheckDebounceMs);

    liveSpellcheckTimers.set(bar, timer);
  }

  function syncLiveSpellcheckScroll(bar: InputBarId, event: Event): void {
    const input = event.currentTarget as HTMLTextAreaElement | null;
    if (!input) {
      return;
    }

    liveSpellcheckScrollX = {
      ...liveSpellcheckScrollX,
      [bar]: input.scrollLeft,
    };
    liveSpellcheckScrollY = {
      ...liveSpellcheckScrollY,
      [bar]: input.scrollTop,
    };
  }

  function getEntry(bar: InputBarId): HistoryBrowseState {
    return historyState[bar] ?? { cursor: null, editIndex: null };
  }

  function setEntry(bar: InputBarId, next: HistoryBrowseState): void {
    historyState = {
      ...historyState,
      [bar]: next,
    };
  }

  function resetEntry(bar: InputBarId): void {
    setEntry(bar, { cursor: null, editIndex: null });
  }

  function shiftState(removed: number): void {
    if (removed <= 0) {
      return;
    }

    const shift = (value: number | null): number | null => {
      if (value === null) {
        return null;
      }

      return Math.max(0, value - removed);
    };

    const nextHistoryState: Record<InputBarId, HistoryBrowseState> = {};

    for (const [key, entry] of Object.entries(historyState)) {
      const bar = Number(key) as InputBarId;
      nextHistoryState[bar] = {
        cursor: shift(entry.cursor),
        editIndex: shift(entry.editIndex),
      };
    }

    historyState = nextHistoryState;
  }

  function appendHistory(value: string): number {
    history = [...history, value];

    if (history.length <= HISTORY_LIMIT) {
      return history.length - 1;
    }

    const removed = history.length - HISTORY_LIMIT;
    history = history.slice(removed);
    shiftState(removed);
    return history.length - 1;
  }

  function updateHistory(index: number, value: string): void {
    if (index < 0 || index >= history.length) {
      return;
    }

    const next = [...history];
    next[index] = value;
    history = next;
  }

  function setCursorValue(bar: InputBarId, cursor: number): void {
    const nextValue = history[cursor] ?? '';
    setValue(bar, nextValue);

    requestAnimationFrame(() => {
      getInput(bar)?.setSelectionRange(nextValue.length, nextValue.length);
    });
  }

  function startBrowseFromCurrentValue(bar: InputBarId): boolean {
    const currentValue = getValue(bar);
    const nextValue = currentValue.trim();

    if (!nextValue && history.length === 0) {
      return false;
    }

    let cursor = history.length - 1;

    if (nextValue) {
      if (history[history.length - 1] !== nextValue) {
        appendHistory(nextValue);
      }

      cursor = history.length > 1 ? history.length - 2 : history.length - 1;
    }

    if (cursor < 0) {
      return false;
    }

    setEntry(bar, { cursor, editIndex: null });
    setCursorValue(bar, cursor);
    return true;
  }

  function moveHistory(bar: InputBarId, direction: -1 | 1): boolean {
    const entry = getEntry(bar);

    if (entry.cursor === null) {
      if (direction === 1) {
        return false;
      }

      return startBrowseFromCurrentValue(bar);
    }

    if (direction === -1) {
      if (entry.cursor === 0) {
        return true;
      }

      const cursor = entry.cursor - 1;
      setEntry(bar, {
        cursor,
        editIndex: entry.editIndex === cursor ? entry.editIndex : null,
      });
      setCursorValue(bar, cursor);
      return true;
    }

    if (entry.cursor >= history.length - 1) {
      setValue(bar, '');
      resetEntry(bar);
      return true;
    }

    const cursor = entry.cursor + 1;
    setEntry(bar, {
      cursor,
      editIndex: entry.editIndex === cursor ? entry.editIndex : null,
    });
    setCursorValue(bar, cursor);
    return true;
  }

  function stowCurrentValue(bar: InputBarId): void {
    const currentValue = getValue(bar);

    if (currentValue.trim() && history[history.length - 1] !== currentValue) {
      appendHistory(currentValue);
    }

    setValue(bar, '');
    resetEntry(bar);
  }

  function handleFocus(bar: InputBarId): void {
    lastSelectedBar = bar;
    onFocusBar(bar);
  }

  function moveFocusBetweenBars(bar: InputBarId, direction: -1 | 1): boolean {
    const index = bars.findIndex((entry) => entry.id === bar);
    if (index < 0) {
      return false;
    }

    const nextBar = bars[index + direction];
    if (!nextBar) {
      return false;
    }

    onFocusBar(nextBar.id);
    focusBar(nextBar.id);
    return true;
  }

  function handleKeydown(event: KeyboardEvent, bar: InputBarId): void {
    const input = getInput(bar);
    const currentValue = getValue(bar);
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;

    if (event.key === 'Enter' && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();

      const nextValue = `${currentValue.slice(0, selectionStart)}\n${currentValue.slice(selectionEnd)}`;
      const nextCursor = selectionStart + 1;

      setValue(bar, nextValue);

      requestAnimationFrame(() => {
        input?.setSelectionRange(nextCursor, nextCursor);
      });

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit(bar, currentValue);
      stowCurrentValue(bar);
      return;
    }

    if (event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key === 'ArrowUp') {
      event.preventDefault();
      void moveHistory(bar, -1);
      return;
    }

    if (event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key === 'ArrowDown') {
      event.preventDefault();
      void moveHistory(bar, 1);
      return;
    }

    if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && event.key === 'ArrowUp') {
      event.preventDefault();
      void handleResizeBar(bar, 1);
      return;
    }

    if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && event.key === 'ArrowDown') {
      event.preventDefault();
      void handleResizeBar(bar, -1);
      return;
    }

    if (!event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey && event.key === 'ArrowUp') {
      if (moveFocusBetweenBars(bar, -1)) {
        event.preventDefault();
        return;
      }
    }

    if (!event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey && event.key === 'ArrowDown') {
      if (moveFocusBetweenBars(bar, 1)) {
        event.preventDefault();
        return;
      }
    }

    if (!event.altKey && !event.metaKey) {
      if (!event.shiftKey && event.ctrlKey && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault();
        onOutputScrollKey(event.key === 'Home' ? 'top' : 'bottom');
        return;
      }

      if (!event.ctrlKey && !event.shiftKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
        event.preventDefault();
        onOutputScrollKey(event.key === 'PageUp' ? 'page-up' : 'page-down');
        return;
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const result = onComplete(bar, currentValue, selectionStart);

      if (!result) {
        return;
      }

      setValue(bar, result.value);

      requestAnimationFrame(() => {
        input?.setSelectionRange(result.cursor, result.cursor);
      });
    }
  }

  function handleInput(bar: InputBarId, event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }

    const entry = getEntry(bar);

    if (entry.cursor === null) {
      return;
    }

    if (entry.editIndex !== null && entry.cursor === entry.editIndex) {
      updateHistory(entry.editIndex, target.value);
      return;
    }

    const selectedValue = history[entry.cursor] ?? '';

    if (target.value === selectedValue) {
      return;
    }

    const nextEditIndex = appendHistory(target.value);
    setEntry(bar, {
      cursor: nextEditIndex,
      editIndex: nextEditIndex,
    });
  }

  function handleControlEnter(bar: InputBarId): void {
    clearControlTimer(bar);
    setControlVisibility(bar, true);
  }

  function handleControlLeave(bar: InputBarId): void {
    clearControlTimer(bar);
    setControlVisibility(bar, false);
  }

  function handleCloseBar(bar: InputBarId): void {
    stowCurrentValue(bar);

    if (bars.length <= 1) {
      return;
    }

    onRemoveBar(bar);
  }

  async function handleResizeBar(bar: InputBarId, delta: -1 | 1): Promise<void> {
    onResizeBar(bar, delta);
    await restoreFocus();
  }

  async function handleAddBar(bar: InputBarId): Promise<void> {
    onAddBar(bar);
    await restoreFocus();
  }

  async function handleCloseButton(bar: InputBarId): Promise<void> {
    handleCloseBar(bar);
    await restoreFocus();
  }

  function getConnectionStatusTitle(): string {
    if (connectionStatus === 'idle') {
      return 'Idle';
    }

    if (connectionStatus === 'connecting') {
      return 'Connecting';
    }

    if (connectionStatus === 'connected') {
      return 'Connected';
    }

    return 'Disconnected';
  }

  function getStatusAreaTitle(): string {
    const loggingLabel = loggingActive ? 'Logging' : 'Not Logging';

    return `${getConnectionStatusTitle()} - Activity - ${loggingLabel}`;
  }

  function closeSpellcheckMenu(): void {
    spellcheckMenuRequestToken += 1;
    spellcheckMenuLoading = false;
    spellcheckMenuSuggestions = [];
    spellcheckMenuBar = null;
    spellcheckMenuWord = '';
  }

  async function loadSpellcheckMenuSuggestions(bar: InputBarId, word: string): Promise<void> {
    const token = ++spellcheckMenuRequestToken;
    const normalizedWord = word.trim();

    if (!normalizedWord || normalizedWord.length < spellcheckMinimumWordLength) {
      if (spellcheckMenuRequestToken === token) {
        spellcheckMenuSuggestions = [];
        spellcheckMenuLoading = false;
      }
      return;
    }

    spellcheckMenuLoading = true;

    try {
      const suggestions = await getSpellcheckSuggestions({
        word: normalizedWord,
        language: spellcheckLanguage,
        ignoredWords: spellcheckIgnoredWords,
        minimumWordLength: spellcheckMinimumWordLength,
        suggestionLimit: spellcheckSuggestionLimit,
      });

      if (spellcheckMenuRequestToken !== token || spellcheckMenuBar !== bar) {
        return;
      }

      spellcheckMenuSuggestions = suggestions;
    } catch (error) {
      if (spellcheckMenuRequestToken === token) {
        spellcheckMenuSuggestions = [];
        console.error('failed to fetch spellcheck suggestions:', error);
      }
    } finally {
      if (spellcheckMenuRequestToken === token) {
        spellcheckMenuLoading = false;
      }
    }
  }

  function openSpellcheckMenu(bar: InputBarId, event: MouseEvent): void {
    const input = getInput(bar);
    if (!input) {
      return;
    }

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const selectedText = input.value.slice(selectionStart, selectionEnd).trim();
    const word = getWordBounds(input.value, selectionStart, selectionEnd);

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'spellcheck' } }));
    spellcheckMenuBar = bar;
    spellcheckMenuPosition = {
      x: event.clientX,
      y: event.clientY,
    };
    spellcheckMenuWord = selectedText || word?.word || '';
    spellcheckMenuSuggestions = [];
    void loadSpellcheckMenuSuggestions(bar, spellcheckMenuWord);
  }

  function getSpellcheckInput(bar: InputBarId): HTMLTextAreaElement | null {
    return getInput(bar);
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

  function handleIgnoreOnce(): void {
    closeSpellcheckMenu();
  }

  function handleIgnoreAlways(): void {
    if (spellcheckMenuWord) {
      onIgnoreWord(spellcheckMenuWord);
    }
    closeSpellcheckMenu();
  }
</script>

<div class="input-area">
  <div class="input-area-inner">
    {#each bars as bar (bar.id)}
      <div class:focused={activeBar === bar.id} class="input-bar" id={getScopedInputBarContainerId(scope, bar.id)}>
        <div class="input-editor-shell">
          <div
            class="spellcheck-underlay"
            aria-hidden="true"
            data-loading={liveSpellcheckLoading[bar.id] === true}
          >
            <div
              class="spellcheck-underlay-content"
              style:transform={`translate(${-((liveSpellcheckScrollX[bar.id] ?? 0))}px, ${-((liveSpellcheckScrollY[bar.id] ?? 0))}px)`}
            >
              {@html liveSpellcheckUnderlays[bar.id] ?? ''}
            </div>
          </div>
          <textarea
            class="mud-input spellcheck-input"
            id={getScopedInputBarInputId(scope, bar.id)}
            rows={clampInputBarLines(bar.lines)}
            bind:value={values[bar.id]}
            autocomplete="off"
            lang={spellcheckLanguage}
            spellcheck="false"
            on:focus={() => handleFocus(bar.id)}
            on:input={(event) => handleInput(bar.id, event)}
            on:keydown={(event) => handleKeydown(event, bar.id)}
            on:scroll={(event) => syncLiveSpellcheckScroll(bar.id, event)}
            on:contextmenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openSpellcheckMenu(bar.id, event);
            }}
            ></textarea>
        </div>

        <div
          class:visible={controlsVisible[bar.id] !== false}
          class="input-controls"
          role="group"
          aria-label={`Input bar ${bar.id} controls`}
          on:mouseenter={() => handleControlEnter(bar.id)}
          on:mouseleave={() => handleControlLeave(bar.id)}
          >
          <div class="input-control-grid">
            <button
              type="button"
              class="input-control"
              class:hidden={bar.lines <= MIN_INPUT_BAR_LINES}
              tabindex={controlsVisible[bar.id] !== false ? 0 : -1}
              aria-label="shrink input bar"
              title="Shrink input bar (Ctrl+Alt+Down)"
              on:click={() => void handleResizeBar(bar.id, -1)}
              >
              ↓
            </button>
            <button
              type="button"
              class="input-control"
              class:hidden={bar.lines >= MAX_INPUT_BAR_LINES}
              tabindex={controlsVisible[bar.id] !== false ? 0 : -1}
              aria-label="expand input bar"
              title="Expand input bar (Ctrl+Alt+Up)"
              on:click={() => void handleResizeBar(bar.id, 1)}
              >
              ↑
            </button>
            <button
              type="button"
              class="input-control"
              tabindex={controlsVisible[bar.id] !== false ? 0 : -1}
              aria-label="add input bar below"
              title="Add input bar below"
              on:click={() => void handleAddBar(bar.id)}
              >
              ★
            </button>
            <button
              type="button"
              class="input-control"
              tabindex={controlsVisible[bar.id] !== false ? 0 : -1}
              aria-label="close input bar"
              title="Close input bar"
              on:click={() => void handleCloseButton(bar.id)}
              >
              X
            </button>
          </div>
        </div>

        {#if bar.showStatusDot}
          <div class="status-dot-slot" title={getStatusAreaTitle()} aria-label={getStatusAreaTitle()}>
            <StatusDot status={connectionStatus} />
            <StatusDot status="connected" variant="activity" active={hasNewActivity} />
            <StatusDot status="connected" variant="logging" active={loggingActive} />
          </div>
        {/if}

      </div>
    {/each}
  </div>
</div>

<SpellcheckContextMenu
  open={spellcheckMenuBar !== null}
  position={spellcheckMenuPosition}
  ariaLabel="input spellcheck context menu"
  suggestions={spellcheckMenuSuggestions}
  loading={spellcheckMenuLoading}
  onDismiss={closeSpellcheckMenu}
  onCopy={() => void (spellcheckMenuBar !== null && handleCopySpellcheck(spellcheckMenuBar))}
  onCut={() => void (spellcheckMenuBar !== null && handleCutSpellcheck(spellcheckMenuBar))}
  onPaste={() => void (spellcheckMenuBar !== null && handlePasteSpellcheck(spellcheckMenuBar))}
  onSelectAll={() => spellcheckMenuBar !== null && handleSelectAllSpellcheck(spellcheckMenuBar)}
  onIgnoreOnce={handleIgnoreOnce}
  onIgnoreAlways={handleIgnoreAlways}
  onChooseSuggestion={(suggestion) => {
    if (spellcheckMenuBar === null) {
      return;
    }

    applyReplacement(spellcheckMenuBar, suggestion);
    closeSpellcheckMenu();
  }}
/>
