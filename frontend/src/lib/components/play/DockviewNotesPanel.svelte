<script lang="ts">
  import type { Readable } from 'svelte/store';
  import NotesWindow from '../notes/NotesWindow.svelte';
  import type { NotesWindowCommand, NotesWindowSnapshot } from '../notes/notes-transport';
  import DockviewPanelShell from './DockviewPanelShell.svelte';
  import type { DockviewPanelPlacement } from './dockview-panel-types';

  export let model: Readable<NotesWindowSnapshot['model']>;
  export let panelPlacement: Readable<DockviewPanelPlacement>;
  export let onCommand: (command: NotesWindowCommand) => void = () => {};
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
  <NotesWindow model={$model} {onCommand} transportSession={null} />
</DockviewPanelShell>
