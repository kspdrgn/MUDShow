<script lang="ts">
  import type { WindowRecord } from './window-host';

  export let windowRecord: WindowRecord;
  export let onPopIn: (id: string) => void;
</script>

<div class="popped-out-window-view">
  <button
    type="button"
    class="popped-out-window-pop-in"
    aria-label={`pop in ${windowRecord.title}`}
    title={`pop in ${windowRecord.title}`}
    on:click={() => onPopIn(windowRecord.id)}
  >
    ↙
  </button>

  <div class="popped-out-window-content">
    <slot />
  </div>
</div>

<style>
  .popped-out-window-view {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--surface);
    color: var(--text);
  }

  .popped-out-window-pop-in {
    position: fixed;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 5;
    min-width: 2rem;
    padding: 0.2rem 0.55rem;
    line-height: 1;
  }

  .popped-out-window-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 1rem 1.1rem 1.1rem;
  }
</style>
