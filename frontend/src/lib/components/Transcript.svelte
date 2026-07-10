<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { copyTextToClipboard, focusElement } from '../session-dom';
  import { getScopedInputBarInputId, type InputBarId } from '../input-bars';

  export let activeBar: InputBarId = 1;
  export let chunks: string[] = [];
  export let width = 'none';
  export let scope = 'world';
  export let onScroll: () => void;

  let outputArea: HTMLDivElement | null = null;

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';

    if (text.trim()) {
      try {
        await copyTextToClipboard(text);
      } finally {
        focusElement(getScopedInputBarInputId(scope, activeBar));
      }
      return;
    }

    focusElement(getScopedInputBarInputId(scope, activeBar));
  }

  onMount(() => {
    const node = outputArea;

    if (!node) {
      return undefined;
    }

    node.addEventListener('mouseup', handleMouseUp);

    return () => {
      node.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

<div
  bind:this={outputArea}
  class="output-area"
  id={`${scope}-output-area`}
  role="region"
  aria-label="Transcript output"
  style={`--play-width: ${width};`}
  on:scroll={onScroll}
>
  {#each chunks as chunk}
    <div class="output-chunk">{@html chunk}</div>
  {/each}
</div>
