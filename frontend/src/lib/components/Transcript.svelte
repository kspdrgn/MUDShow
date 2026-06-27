<script lang="ts">
  import { copyTextToClipboard, focusElement } from '../session-dom';
  import { getInputBarInputId, type InputBarId } from '../input-bars';

  export let activeBar: InputBarId = 1;
  export let chunks: string[] = [];
  export let width = 'none';
  export let onScroll: () => void;

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';

    if (text.trim()) {
      try {
        await copyTextToClipboard(text);
      } finally {
        focusElement(getInputBarInputId(activeBar));
      }
      return;
    }

    focusElement(getInputBarInputId(activeBar));
  }
</script>

<div id="output-area" style={`--play-width: ${width};`} on:scroll={onScroll} on:mouseup={handleMouseUp}>
  {#each chunks as chunk}
    <div class="output-chunk">{@html chunk}</div>
  {/each}
</div>
