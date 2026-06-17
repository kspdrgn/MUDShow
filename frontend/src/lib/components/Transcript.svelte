<script lang="ts">
  export let chunks: string[] = [];
  export let width = '82ch';
  export let onScroll: () => void;
  let outputEl: HTMLDivElement | null = null;

  export function scrollToBottom(): void {
    if (!outputEl) {
      return;
    }

    outputEl.scrollTop = outputEl.scrollHeight;
  }

  export function getElement(): HTMLDivElement | null {
    return outputEl;
  }
</script>

<div id="output-area" bind:this={outputEl} style={`--play-width: ${width};`} on:scroll={onScroll}>
  {#each chunks as chunk}
    <div class="output-chunk">{@html chunk}</div>
  {/each}
</div>
