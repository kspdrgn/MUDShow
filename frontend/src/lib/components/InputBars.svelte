<script lang="ts">
  import StatusDot from './StatusDot.svelte';

  export let activeBar: 1 | 2 = 1;
  export let inputOne = '';
  export let inputTwo = '';
  export let connectionStatus: 'idle' | 'connected' | 'error' = 'idle';
  export let onFocusBar: (bar: 1 | 2) => void;
  export let onInputKeydown: (event: KeyboardEvent, bar: 1 | 2) => void | Promise<void>;

  let input1El: HTMLInputElement | null = null;
  let input2El: HTMLInputElement | null = null;

  export function focus(bar: 1 | 2): void {
    const input = bar === 1 ? input1El : input2El;
    input?.focus();
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
        on:keydown={(event) => onInputKeydown(event, 1)}
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
        on:keydown={(event) => onInputKeydown(event, 2)}
      />
    </div>
  </div>
</div>
