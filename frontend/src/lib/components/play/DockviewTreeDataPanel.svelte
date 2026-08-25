<script lang="ts">
  import type { Readable } from 'svelte/store';
  import TreeDataWindow from '../tree-data/TreeDataWindow.svelte';
  import type { TreeDataWindowCommand } from '../tree-data/tree-data-controller';
  import type { TreeDataWindowModel, TreeDataWindowViewState } from '../tree-data/tree-data-view';
  import DockviewPanelShell from './DockviewPanelShell.svelte';
  import type { DockviewPanelPlacement } from './dockview-panel-types';

  export let model: Readable<TreeDataWindowModel>;
  export let viewState: Readable<TreeDataWindowViewState>;
  export let panelPlacement: Readable<DockviewPanelPlacement>;
  export let onCommand: (command: TreeDataWindowCommand) => void = () => {};
  export let onPromoteToFloating: () => void = () => {};
  export let onDockToEdge: () => void = () => {};
  export let onPopOutNative: () => void = () => {};
  export let onPopInNative: () => void = () => {};
  export let onClose: () => void = () => {};
</script>

<DockviewPanelShell
  {panelPlacement}
  {onPromoteToFloating}
  {onDockToEdge}
  {onPopOutNative}
  {onPopInNative}
  {onClose}
>
  <TreeDataWindow model={$model} viewState={$viewState} {onCommand} transportSession={null} />
</DockviewPanelShell>
