<script lang="ts">
  import { copyTextToClipboard, focusElement } from '../session-dom';

  export let activeBar: 1 | 2 = 1;
  export let chunks: string[] = [];
  export let width = 'none';
  export let onScroll: () => void;

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';

    if (!text.trim()) {
      return;
    }

    try {
      await copyTextToClipboard(text);
    } finally {
      focusElement(activeBar === 1 ? 'input1' : 'input2');
    }
  }
</script>

<div id="output-area" style={`--play-width: ${width};`} on:scroll={onScroll} on:mouseup={handleMouseUp}>
  {#each chunks as chunk}
    <div class="output-chunk">{@html chunk}</div>
  {/each}
</div>
