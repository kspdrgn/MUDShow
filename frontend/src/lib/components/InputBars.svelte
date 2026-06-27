<script lang="ts">
  import { onMount } from 'svelte';
  import StatusDot from './StatusDot.svelte';

  export let activeBar: 1 | 2 = 1;
  export let connectionStatus: 'idle' | 'connected' | 'error' = 'idle';
  export let onFocusBar: (bar: 1 | 2) => void;
  export let onSubmit: (bar: 1 | 2, value: string) => void;
  export let onComplete: (
    bar: 1 | 2,
    value: string,
    selectionStart: number
  ) => { value: string; cursor: number } | null;

  const HISTORY_LIMIT = 50;

  let inputOne = '';
  let inputTwo = '';
  let input1El: HTMLInputElement | null = null;
  let input2El: HTMLInputElement | null = null;

  onMount(() => {
    input1El?.focus();
  });

  interface HistoryBrowseState {
    cursor: number | null;
    editIndex: number | null;
  }

  let history: string[] = [];
  let historyState: Record<1 | 2, HistoryBrowseState> = {
    1: { cursor: null, editIndex: null },
    2: { cursor: null, editIndex: null },
  };

  function getInput(bar: 1 | 2): HTMLInputElement | null {
    return bar === 1 ? input1El : input2El;
  }

  function getValue(bar: 1 | 2): string {
    return bar === 1 ? inputOne : inputTwo;
  }

  function setValue(bar: 1 | 2, value: string): void {
    if (bar === 1) {
      inputOne = value;
    } else {
      inputTwo = value;
    }
  }

  function getEntry(bar: 1 | 2): HistoryBrowseState {
    return historyState[bar];
  }

  function setEntry(bar: 1 | 2, next: HistoryBrowseState): void {
    historyState = {
      ...historyState,
      [bar]: next,
    };
  }

  function resetEntry(bar: 1 | 2): void {
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

    historyState = {
      1: {
        cursor: shift(historyState[1].cursor),
        editIndex: shift(historyState[1].editIndex),
      },
      2: {
        cursor: shift(historyState[2].cursor),
        editIndex: shift(historyState[2].editIndex),
      },
    };
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

  function setCursorValue(bar: 1 | 2, cursor: number): void {
    const nextValue = history[cursor] ?? '';
    setValue(bar, nextValue);

    requestAnimationFrame(() => {
      getInput(bar)?.setSelectionRange(nextValue.length, nextValue.length);
    });
  }

  function startBrowseFromCurrentValue(bar: 1 | 2): boolean {
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

  function moveHistory(bar: 1 | 2, direction: -1 | 1): boolean {
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

  function handleKeydown(event: KeyboardEvent, bar: 1 | 2): void {
    const input = getInput(bar);
    const currentValue = getValue(bar);
    const selectionStart = input?.selectionStart ?? currentValue.length;

    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit(bar, currentValue);

      if (currentValue.trim() && history[history.length - 1] !== currentValue) {
        appendHistory(currentValue);
      }

      setValue(bar, '');
      resetEntry(bar);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHistory(bar, -1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHistory(bar, 1);
      return;
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
      return;
    }
  }

  function handleInput(bar: 1 | 2, event: Event): void {
    const target = event.currentTarget as HTMLInputElement | null;
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
</script>

<div id="input-area">
  <div id="input-area-inner">
    <div class:focused={activeBar === 1} class="input-bar" id="bar1">
      <span class="input-indicator">F1</span>
      <input
        bind:this={input1El}
        class="mud-input"
        id="input1"
        type="text"
        bind:value={inputOne}
        autocomplete="off"
        spellcheck="false"
        on:focus={() => onFocusBar(1)}
        on:input={(event) => handleInput(1, event)}
        on:keydown={(event) => handleKeydown(event, 1)}
      />
      <StatusDot status={connectionStatus} />
    </div>
    <div class:focused={activeBar === 2} class="input-bar" id="bar2">
      <span class="input-indicator">F2</span>
      <input
        bind:this={input2El}
        class="mud-input"
        id="input2"
        type="text"
        bind:value={inputTwo}
        autocomplete="off"
        spellcheck="false"
        on:focus={() => onFocusBar(2)}
        on:input={(event) => handleInput(2, event)}
        on:keydown={(event) => handleKeydown(event, 2)}
      />
    </div>
  </div>
</div>
