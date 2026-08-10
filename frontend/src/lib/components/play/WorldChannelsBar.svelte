<script lang="ts">
  import { onMount } from 'svelte';
  import ContextMenuShell from '../context-menu/ContextMenuShell.svelte';
  import type { ChannelBarControlVM, ChannelTabVM, ChannelTabId } from './channel';

  export let visible = false;
  export let tabs: ChannelTabVM[] = [];
  export let controls: ChannelBarControlVM[] = [];
  export let onHide: () => void;
  export let onToggleChannel: (tabId: ChannelTabId) => void;
  export let onMouseEnter: () => void = () => {};
  export let onMouseLeave: () => void = () => {};

  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuTab: ChannelTabVM | null = null;
  let barElement: HTMLDivElement | null = null;

  function closeContextMenu(): void {
    contextMenuOpen = false;
    contextMenuTab = null;
  }

  function openTabContextMenu(event: MouseEvent, tab: ChannelTabVM): void {
    event.preventDefault();
    event.stopPropagation();

    contextMenuTab = tab;
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'world-channels-bar' } }));
  }

  function closeSelectedTab(): void {
    const tab = contextMenuTab;
    closeContextMenu();
    tab?.onClose?.();
  }

  function suppressNativeContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  onMount(() => {
    const element = barElement;
    if (!element) {
      return;
    }

    element.addEventListener('contextmenu', suppressNativeContextMenu, true);
    return () => {
      element.removeEventListener('contextmenu', suppressNativeContextMenu, true);
    };
  });
</script>

<div
  bind:this={barElement}
  class="world-channels-bar"
  class:visible={visible}
  aria-hidden={!visible}
  on:mouseenter={onMouseEnter}
  on:mouseleave={onMouseLeave}
>
  <div class="world-channels-bar-tabs" role="tablist" aria-label="World channels">
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
      <div class="world-channel-tab">
        <button
          type="button"
          class="btn world-channel"
          class:active={tab.open}
          role="tab"
          aria-selected={tab.open}
          on:contextmenu={(event) => openTabContextMenu(event, tab)}
          on:click={() => onToggleChannel(tab.id)}
        >
          <span class="world-channel-label">{tab.label}</span>
        </button>
        {#if tab.onClose}
          <button
            type="button"
            class="btn world-channel-close"
            aria-label={`close ${tab.label} tab`}
            title={`Close ${tab.label} tab`}
            on:click|stopPropagation={() => tab.onClose?.()}
          >
            ×
          </button>
        {/if}
      </div>
    {/each}
  </div>
  <div class="world-channels-bar-host-controls" role="group" aria-label="World channel host controls">
    {#each controls as control (control.id)}
      <button
        type="button"
        class="btn world-channel world-channel-host-control"
        disabled={control.disabled}
        aria-label={control.title ?? control.label}
        title={control.title ?? control.label}
        on:click={control.onClick}
      >
        <span class="world-channel-label">{control.label}</span>
      </button>
    {/each}
  </div>
</div>

<ContextMenuShell
  open={contextMenuOpen}
  position={contextMenuPosition}
  ariaLabel="channel context menu"
  source="world-channels-bar"
  className="world-channel-context-menu"
  onDismiss={closeContextMenu}
>
  <button
    type="button"
    class="titlebar-menu-item titlebar-context-menu-item"
    role="menuitem"
    on:click={closeSelectedTab}
  >
    close
  </button>
</ContextMenuShell>
