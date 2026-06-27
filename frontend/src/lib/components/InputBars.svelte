<script lang="ts">
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
  let history: string[] = [];
  let historyState: Record<
    1 | 2,
    {
      draft: string;
      cursor: number | null;
    }
  > = {
    1: { draft: '', cursor: null },
    2: { draft: '', cursor: null },
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

  function getHistoryEntry(bar: 1 | 2): { draft: string; cursor: number | null } {
    return historyState[bar];
  }

  function setHistoryEntry(bar: 1 | 2, next: { draft: string; cursor: number | null }): void {
    historyState = {
      ...historyState,
      [bar]: next,
    };
  }

  function resetHistory(bar: 1 | 2): void {
    setHistoryEntry(bar, { draft: '', cursor: null });
  }

  function rememberDraft(bar: 1 | 2, value: string): void {
    setHistoryEntry(bar, { draft: value, cursor: null });
  }

  function pushHistory(value: string): void {
    const next = [...history, value];
    history = next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
  }

  function showHistoryValue(bar: 1 | 2, index: number): void {
    const nextValue = history[index] ?? '';
    setValue(bar, nextValue);

    requestAnimationFrame(() => {
      getInput(bar)?.setSelectionRange(nextValue.length, nextValue.length);
    });
  }

  function moveHistory(bar: 1 | 2, direction: -1 | 1): boolean {
    const entry = getHistoryEntry(bar);
    const currentValue = getValue(bar);

    if (direction === -1) {
      if (history.length === 0) {
        return false;
      }

      if (entry.cursor === null) {
        setHistoryEntry(bar, {
          draft: currentValue,
          cursor: history.length - 1,
        });
        showHistoryValue(bar, history.length - 1);
        return true;
      }

      if (entry.cursor > 0) {
        const nextCursor = entry.cursor - 1;
        setHistoryEntry(bar, {
          ...entry,
          cursor: nextCursor,
        });
        showHistoryValue(bar, nextCursor);
        return true;
      }

      return true;
    }

    if (entry.cursor === null) {
      return false;
    }

    if (entry.cursor < history.length - 1) {
      const nextCursor = entry.cursor + 1;
      setHistoryEntry(bar, {
        ...entry,
        cursor: nextCursor,
      });
      showHistoryValue(bar, nextCursor);
      return true;
    }

    const draftValue = entry.draft;
    setValue(bar, draftValue);
    setHistoryEntry(bar, { draft: draftValue, cursor: null });

    requestAnimationFrame(() => {
      getInput(bar)?.setSelectionRange(draftValue.length, draftValue.length);
    });

    return true;
  }

  function handleKeydown(event: KeyboardEvent, bar: 1 | 2): void {
    const input = getInput(bar);
    const currentValue = getValue(bar);
    const selectionStart = input?.selectionStart ?? currentValue.length;

    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit(bar, currentValue);
      if (currentValue.trim()) {
        pushHistory(currentValue);
      }
      setValue(bar, '');
      resetHistory(bar);
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
      setHistoryEntry(bar, { draft: result.value, cursor: null });

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

    rememberDraft(bar, target.value);
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
