<script lang="ts">
  export let chunks: string[] = [];
  export let width = '82ch';
  export let onScroll: () => void;
</script>

<div id="output-area" style={`--play-width: ${width};`} on:scroll={onScroll}>
  {#each chunks as chunk}
    <div class="output-chunk">{@html chunk}</div>
  {/each}
</div>
