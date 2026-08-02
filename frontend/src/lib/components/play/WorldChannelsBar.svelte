<script lang="ts">
  import type { ChannelTabVM, ChannelTabId } from "./channel";

  export let visible = false;
  export let tabs: ChannelTabVM[] = [];
  export let onHide: () => void;
  export let onToggleChannel: (tabId: ChannelTabId) => void;
</script>

<div class="world-channels-bar" class:visible={visible} aria-hidden={!visible} role="tablist" aria-label="World channels">
  <button
    type="button"
    class="btn world-channel world-channel-hide"
    role="tab"
    aria-selected="false"
    on:click={onHide}
  >
    <span class="world-channel-label">hide</span>
  </button>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      class="btn world-channel"
      class:active={tab.open}
      role="tab"
      aria-selected={tab.open}
      on:click={() => onToggleChannel(tab.id)}
    >
      <span class="world-channel-label">{tab.label}</span>
    </button>
  {/each}
</div>
