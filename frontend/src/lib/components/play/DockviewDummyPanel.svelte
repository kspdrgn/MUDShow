<script lang="ts">
  import type { Readable } from 'svelte/store';
  import DockviewPanelShell from './DockviewPanelShell.svelte';
  import type { DockviewPanelPlacement } from './dockview-panel-types';

  export let title = '';
  export let eyebrow = '';
  export let description = '';
  export let tone: 'workspace' | 'accent' | 'muted' | 'warning' = 'muted';
  export let panelPlacement: Readable<DockviewPanelPlacement> | null = null;
  export let onPromoteToFloating: () => void = () => {};
  export let onDockToEdge: () => void = () => {};
  export let onPopOutNative: () => void = () => {};
  export let onPopInNative: () => void = () => {};
  export let onClose: (() => void) | null = null;
</script>

<DockviewPanelShell
  {panelPlacement}
  {onPromoteToFloating}
  {onDockToEdge}
  {onPopOutNative}
  {onPopInNative}
  {onClose}
>
  <div class={`play-dockview-placeholder play-dockview-placeholder--${tone}`}>
    <div class="play-dockview-placeholder__eyebrow">{eyebrow}</div>
    <div class="play-dockview-placeholder__title">{title}</div>
    <div class="play-dockview-placeholder__description">{description}</div>
  </div>
</DockviewPanelShell>
