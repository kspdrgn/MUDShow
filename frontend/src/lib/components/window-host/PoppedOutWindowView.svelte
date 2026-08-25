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
