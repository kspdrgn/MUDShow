<script lang="ts">
  import { tick } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import StatusDot from './StatusDot.svelte';
  import {
    clampInputBarLines,
    getScopedInputBarContainerId,
    getScopedInputBarInputId,
    MAX_INPUT_BAR_LINES,
    MIN_INPUT_BAR_LINES,
    type InputBarConfig,
    type InputBarId,
  } from '../input-bars';

  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
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

    if (changed) {
      values = nextValues;
      historyState = nextHistoryState;
      controlsVisible = nextControlsVisible;
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

  function handleKeydown(event: KeyboardEvent, bar: InputBarId): void {
    const input = getInput(bar);
    const currentValue = getValue(bar);
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;

    if (event.ctrlKey && event.key === 'Enter') {
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

    if (event.ctrlKey && event.key === 'ArrowUp') {
      event.preventDefault();
      moveHistory(bar, -1);
      return;
    }

    if (event.ctrlKey && event.key === 'ArrowDown') {
      event.preventDefault();
      moveHistory(bar, 1);
      return;
    }

    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        onOutputScrollKey(event.key);
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
</script>

<div class="input-area">
  <div class="input-area-inner">
    {#each bars as bar (bar.id)}
      <div class:focused={activeBar === bar.id} class="input-bar" id={getScopedInputBarContainerId(scope, bar.id)}>
        <textarea
          class="mud-input"
          id={getScopedInputBarInputId(scope, bar.id)}
          rows={clampInputBarLines(bar.lines)}
          bind:value={values[bar.id]}
          autocomplete="off"
          spellcheck="true"
          on:focus={() => handleFocus(bar.id)}
          on:input={(event) => handleInput(bar.id, event)}
          on:keydown={(event) => handleKeydown(event, bar.id)}
          ></textarea>

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
              title="Shrink input bar"
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
              title="Expand input bar"
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
          <div class="status-dot-slot">
            <StatusDot status={connectionStatus} />
            {#if loggingActive}
              <StatusDot status="connected" variant="logging" />
            {/if}
          </div>
        {/if}

      </div>
    {/each}
  </div>
</div>
