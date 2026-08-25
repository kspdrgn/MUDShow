<script lang="ts">
  import type { Readable } from 'svelte/store';
  import DebugConsoleWindow from '../debug-console/DebugConsoleWindow.svelte';
  import type { DebugConsoleWindowCommand, DebugConsoleWindowSnapshot } from '../debug-console/debug-console-transport';
  import DockviewPanelShell from './DockviewPanelShell.svelte';
  import type { DockviewPanelPlacement } from './dockview-panel-types';

  export let model: Readable<DebugConsoleWindowSnapshot['model']>;
  export let panelPlacement: Readable<DockviewPanelPlacement>;
  export let onCommand: (command: DebugConsoleWindowCommand) => void = () => {};
  export let onPromoteToFloating: () => void = () => {};
  export let onDockToEdge: () => void = () => {};
  export let onPopOutNative: () => void = () => {};
  export let onPopInNative: () => void = () => {};
</script>

<DockviewPanelShell
  {panelPlacement}
  {onPromoteToFloating}
  {onDockToEdge}
  {onPopOutNative}
  {onPopInNative}
>
  <DebugConsoleWindow model={$model} {onCommand} transportSession={null} />
</DockviewPanelShell>
