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

  let inputOne = '';
  let inputTwo = '';
  let input1El: HTMLInputElement | null = null;
  let input2El: HTMLInputElement | null = null;

  function handleKeydown(event: KeyboardEvent, bar: 1 | 2): void {
    const input = bar === 1 ? input1El : input2El;
    const currentValue = bar === 1 ? inputOne : inputTwo;
    const selectionStart = input?.selectionStart ?? currentValue.length;

    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit(bar, currentValue);
      if (bar === 1) {
        inputOne = '';
      } else {
        inputTwo = '';
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const result = onComplete(bar, currentValue, selectionStart);

      if (!result) {
        return;
      }

      if (bar === 1) {
        inputOne = result.value;
      } else {
        inputTwo = result.value;
      }

      requestAnimationFrame(() => {
        input?.setSelectionRange(result.cursor, result.cursor);
      });
      return;
    }
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
        on:keydown={(event) => handleKeydown(event, 2)}
      />
    </div>
  </div>
</div>
