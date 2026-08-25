<script lang="ts">
  import { onMount } from 'svelte';
  import type { Readable } from 'svelte/store';
  import type { DockviewPanelPlacement } from './dockview-panel-types';

  export let panelPlacement: Readable<DockviewPanelPlacement> | null = null;
  export let onPromoteToFloating: () => void = () => {};
  export let onDockToEdge: () => void = () => {};
  export let onPopOutNative: () => void = () => {};
  export let onPopInNative: () => void = () => {};
  export let onClose: (() => void) | null = null;

  let placement: DockviewPanelPlacement = 'grid';
  let removePlacementListener: (() => void) | null = null;

  onMount(() => {
    removePlacementListener = panelPlacement?.subscribe((nextPlacement) => {
      placement = nextPlacement;
    }) ?? null;

    return () => {
      removePlacementListener?.();
      removePlacementListener = null;
    };
  });
</script>

<div class="play-dockview-panel-shell" data-placement={placement}>
  <div class="play-dockview-panel-shell__actions">
    {#if placement === 'floating'}
      <button
        type="button"
        class="play-dockview-panel-shell__action"
        title="Return this surface to its previous docked edge"
        aria-label="Return this surface to its previous docked edge"
        on:mousedown|stopPropagation
        on:click={onDockToEdge}
      >
        ⇥
      </button>
    {:else if placement !== 'popout'}
      <button
        type="button"
        class="play-dockview-panel-shell__action"
        title="Promote this surface into a floating panel"
        aria-label="Promote this surface into a floating panel"
        on:mousedown|stopPropagation
        on:click={onPromoteToFloating}
      >
        ↧
      </button>
    {/if}

    {#if placement === 'popout'}
      <button
        type="button"
        class="play-dockview-panel-shell__action"
        title="Return this surface to an in-app floating panel"
        aria-label="Return this surface to an in-app floating panel"
        on:mousedown|stopPropagation
        on:click={onPopInNative}
      >
        ⤴
      </button>
    {:else if placement === 'floating'}
      <button
        type="button"
        class="play-dockview-panel-shell__action"
        title="Pop out this surface into a native window"
        aria-label="Pop out this surface into a native window"
        on:mousedown|stopPropagation
        on:click={onPopOutNative}
      >
        ⤵
      </button>
    {/if}

    {#if onClose}
      <button
        type="button"
        class="play-dockview-panel-shell__action"
        title="Close this surface"
        aria-label="Close this surface"
        on:mousedown|stopPropagation
        on:click={onClose}
      >
        ×
      </button>
    {/if}
  </div>

  <div class="play-dockview-panel-shell__content">
    <slot />
  </div>
</div>
