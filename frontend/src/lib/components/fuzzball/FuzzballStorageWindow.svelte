<script lang="ts">
  import { onMount } from 'svelte';
  import TreeDataWindow from '../tree-data/TreeDataWindow.svelte';
  import { fuzzballStorageCache } from '../../fuzzball/storage-cache';
  import { buildFuzzballStorageViewerModel, type FuzzballStorageViewerState } from '../../fuzzball/storage-viewer';
  import type { TreeDataWindowModel } from '../tree-data/tree-data-view';

  export let state: FuzzballStorageViewerState;
  export let selectedNodeId: string | null = '/';
  export let onSelectNode: (nodeId: string) => void = () => {};
  export let onToggleNode: (nodeId: string) => void = () => {};
  export let onExpandAll: () => void = () => {};
  export let onCollapseAll: () => void = () => {};

  const sessionCache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  let cacheRevision = 0;
  let model: TreeDataWindowModel = buildFuzzballStorageViewerModel(state);
  let unsubscribeCache: (() => void) | null = null;

  $: {
    cacheRevision;
    model = buildFuzzballStorageViewerModel(state);
  }

  onMount(() => {
    unsubscribeCache = sessionCache.subscribe(() => {
      cacheRevision += 1;
    });

    return () => {
      unsubscribeCache?.();
      unsubscribeCache = null;
    };
  });
</script>

<TreeDataWindow
  {model}
  {selectedNodeId}
  {onSelectNode}
  {onToggleNode}
  {onExpandAll}
  {onCollapseAll}
/>
