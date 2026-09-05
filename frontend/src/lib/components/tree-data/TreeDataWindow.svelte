<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    flattenVisibleTreeDataNodes,
    type TreeDataNode,
    type TreeDataWindowModel,
    type TreeDataWindowViewState,
  } from './tree-data-view';
  import type { TreeDataWindowCommand } from './tree-data-controller';
  import type { TreeDataWindowSnapshot, TreeDataWindowTransportSession } from './tree-data-transport';

  export let model: TreeDataWindowModel;
  export let viewState: TreeDataWindowViewState;
  export let onCommand: (command: TreeDataWindowCommand) => void = () => {};
  export let transportSession: TreeDataWindowTransportSession | null = null;

  let transportSnapshot: TreeDataWindowSnapshot | null = null;
  let transportViewState: TreeDataWindowViewState | null = null;
  let activeViewState: TreeDataWindowViewState = viewState;
  let activeModel: TreeDataWindowModel = model;
  let unlistenSnapshot: (() => void) | null = null;

  function logTreeWindow(message: string, details: Record<string, unknown>): void {
    console.debug(`[tree-window] ${message}`, details);
  }

  function syncTransportSession(session: TreeDataWindowTransportSession | null): void {
    if (unlistenSnapshot) {
      unlistenSnapshot();
      unlistenSnapshot = null;
    }

    transportSnapshot = session?.getSnapshot()?.payload ?? null;
    transportViewState = transportSnapshot?.viewState ?? null;
    logTreeWindow('sync transport session', {
      hasSession: session !== null,
      revision: session?.getRevision() ?? null,
      hasSnapshot: transportSnapshot !== null,
      selectedNodeId: transportViewState?.selectedNodeId ?? null,
      expandedNodeCount: transportViewState?.expandedNodeIds.length ?? 0,
    });

    if (!session) {
      return;
    }

    unlistenSnapshot = session.onSnapshot((envelope) => {
      transportSnapshot = envelope.payload;
      transportViewState = envelope.payload.viewState;
      logTreeWindow('snapshot received', {
        revision: envelope.revision,
        selectedNodeId: envelope.payload.viewState.selectedNodeId,
        expandedNodeCount: envelope.payload.viewState.expandedNodeIds.length,
      });
    });
  }

  $: syncTransportSession(transportSession);
  onDestroy(() => syncTransportSession(null));

  $: activeModel = transportSnapshot?.model ?? model;
  $: activeViewState = transportViewState ?? viewState;
  $: visibleRows = flattenVisibleTreeDataNodes(activeModel.root, new Set(activeViewState.expandedNodeIds));
  $: selectedRow = visibleRows.find((row) => row.node.id === activeViewState.selectedNodeId) ?? null;

  function selectNode(nodeId: string): void {
    const command = { type: 'nodeSelected', nodeId } as const;

    if (transportSession) {
      logTreeWindow('send command', {
        command,
        revision: transportSession.getRevision(),
      });
      transportSession.sendCommand(command, { expectedRevision: transportSession.getRevision() });
      return;
    }

    logTreeWindow('fallback command', { command });
    onCommand(command);
  }

  function toggleNode(nodeId: string): void {
    const command = { type: 'nodeExpansionToggled', nodeId } as const;

    if (transportSession) {
      logTreeWindow('send command', {
        command,
        revision: transportSession.getRevision(),
      });
      transportSession.sendCommand(command, { expectedRevision: transportSession.getRevision() });
      return;
    }

    logTreeWindow('fallback command', { command });
    onCommand(command);
  }

  function expandAll(): void {
    const command = { type: 'expandAllRequested' } as const;

    if (transportSession) {
      logTreeWindow('send command', {
        command,
        revision: transportSession.getRevision(),
      });
      transportSession.sendCommand(command, { expectedRevision: transportSession.getRevision() });
      return;
    }

    logTreeWindow('fallback command', { command });
    onCommand(command);
  }

  function collapseAll(): void {
    const command = { type: 'collapseAllRequested' } as const;

    if (transportSession) {
      logTreeWindow('send command', {
        command,
        revision: transportSession.getRevision(),
      });
      transportSession.sendCommand(command, { expectedRevision: transportSession.getRevision() });
      return;
    }

    logTreeWindow('fallback command', { command });
    onCommand(command);
  }

  function formatSelectedNodePreview(node: TreeDataNode): string {
    const type = node.badge ?? 'str';
    const path = type === 'dir' && !node.id.endsWith('/') ? `${node.id}/` : node.id;

    return type === 'dir'
      ? path
      : `${path}:${node.subtitle ?? 'no value'}`;
  }
</script>

<section class="tree-data-window">
  <header class="tree-data-window-header">
    <div class="tree-data-window-copy">
      <p class="tree-data-window-kicker">tree-data view</p>
      <h2>{activeModel.title}</h2>
      {#if activeModel.description}
        <p class="tree-data-window-description">{activeModel.description}</p>
      {/if}
    </div>

    <div class="tree-data-window-actions">
      <button type="button" class="tree-data-window-action" on:click={expandAll}>expand all</button>
      <button type="button" class="tree-data-window-action" on:click={collapseAll}>collapse all</button>
    </div>
  </header>

  <div class="tree-data-window-summary" aria-live="polite">
    {#if selectedRow}
      {#if activeModel.presentation === 'fuzzball-storage'}
        <span class="tree-data-window-summary-value">{formatSelectedNodePreview(selectedRow.node)}</span>
      {:else}
        <span class="tree-data-window-summary-label">selected:</span>
        <span class="tree-data-window-summary-value">{selectedRow.node.title}</span>
        {#if selectedRow.node.subtitle}
          <span class="tree-data-window-summary-detail">{selectedRow.node.subtitle}</span>
        {/if}
      {/if}
    {:else}
      <span class="tree-data-window-summary-detail">no row selected</span>
    {/if}
  </div>

  <div class="tree-data-window-tree" role="tree" aria-label={activeModel.title}>
    {#each visibleRows as row (row.node.id)}
      {@const isBranch = row.node.kind === 'branch'}
      {@const isLoading = row.node.childrenState === 'loading'}
      <div
        class="tree-data-row"
        class:branch={isBranch}
        class:loading={isLoading}
        class:selected={activeViewState.selectedNodeId === row.node.id}
        style={`--tree-depth: ${row.depth};`}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={isBranch ? (row.expanded ? 'true' : 'false') : undefined}
        aria-selected={activeViewState.selectedNodeId === row.node.id ? 'true' : 'false'}
      >
        {#if isBranch}
          <button
            type="button"
            class="tree-data-toggle tree-data-toggle--branch"
            aria-label={`${row.expanded ? 'collapse' : 'expand'} ${row.node.title}`}
            aria-expanded={row.expanded ? 'true' : 'false'}
            aria-busy={isLoading ? 'true' : 'false'}
            disabled={isLoading}
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => toggleNode(row.node.id)}
          >
            {#if isLoading}
              …
            {:else}
              {row.expanded ? '▼' : '▶'}
            {/if}
          </button>
        {:else}
          <span class="tree-data-toggle tree-data-toggle--spacer" aria-hidden="true"></span>
        {/if}

        <button
          type="button"
          class="tree-data-node"
          class:fuzzball={activeModel.presentation === 'fuzzball-storage'}
          class:selected={activeViewState.selectedNodeId === row.node.id}
          on:click={() => selectNode(row.node.id)}
        >
          <span class="tree-data-node-title">{row.node.title}</span>
          {#if activeModel.presentation === 'fuzzball-storage' && row.node.badge}
            <span class="tree-data-node-badge">{row.node.badge}</span>
          {/if}
          {#if row.node.subtitle}
            <span
              class="tree-data-node-subtitle"
              class:empty={row.node.valueState !== 'loaded' || row.node.subtitle === 'no value'}
            >{row.node.subtitle}</span>
          {/if}
        </button>

        {#if row.node.badge && activeModel.presentation !== 'fuzzball-storage'}
          <span class="tree-data-node-badge">{row.node.badge}</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .tree-data-window {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 0.8rem;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    max-width: none;
    box-sizing: border-box;
    padding: 1rem;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
    background: var(--dv-group-view-background-color, var(--bg));
  }

  .tree-data-window-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .tree-data-window-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .tree-data-window-kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.72rem;
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-window h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 650;
  }

  .tree-data-window-description {
    margin: 0;
    max-width: 34rem;
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-window-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .tree-data-window-action {
    border: 1px solid var(--dv-separator-border, var(--border));
    border-radius: 0.7rem;
    padding: 0.45rem 0.7rem;
    background: var(--dv-tabs-and-actions-container-background-color, var(--surface));
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
    cursor: pointer;
    text-transform: lowercase;
  }

  .tree-data-window-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    border-radius: 0.75rem;
    border: 1px solid var(--dv-separator-border, var(--border));
    padding: 0.6rem 0.75rem;
    background: var(--dv-tabs-and-actions-container-background-color, var(--surface));
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }

  .tree-data-window-summary-label {
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-window-summary-detail {
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-window-tree {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 0.24rem;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.2rem;
    border-radius: 0.9rem;
    border: 1px solid var(--dv-separator-border, var(--border));
    background: var(--dv-group-view-background-color, var(--bg));
  }

  .tree-data-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.35rem 0.3rem calc(0.35rem + var(--tree-depth) * 1.2rem);
    border-radius: 0.65rem;
  }

  .tree-data-row:hover {
    background: var(--dv-icon-hover-background-color, var(--ui-surface-hover));
  }

  .tree-data-row.branch .tree-data-node-title {
    font-weight: 650;
  }

  .tree-data-row.selected {
    background: var(--dv-activegroup-visiblepanel-tab-background-color, var(--accent-dim));
  }

  .tree-data-row.loading {
    background: var(--dv-tabs-and-actions-container-background-color, var(--surface));
  }

  .tree-data-toggle {
    width: 1.6rem;
    height: 1.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.92rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tree-data-toggle--branch {
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }

  .tree-data-toggle--branch:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  .tree-data-toggle--spacer {
    display: inline-block;
  }

  .tree-data-node {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.06rem;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 0.14rem 0;
    cursor: pointer;
    min-width: 0;
  }

  .tree-data-node.fuzzball {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: 0.45rem;
    row-gap: 0.06rem;
  }

  .tree-data-node.fuzzball .tree-data-node-title {
    grid-column: 1 / -1;
  }

  .tree-data-node.fuzzball .tree-data-node-badge {
    grid-column: 1;
    grid-row: 2;
    justify-self: start;
  }

  .tree-data-node.fuzzball .tree-data-node-subtitle {
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }

  .tree-data-node.fuzzball .tree-data-node-subtitle.empty {
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-node-title {
    font-size: 0.96rem;
    font-weight: 600;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }

  .tree-data-node-subtitle {
    font-size: 0.8rem;
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
  }

  .tree-data-node-badge {
    justify-self: end;
    padding: 0.18rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--dv-separator-border, var(--border));
    background: var(--dv-tabs-and-actions-container-background-color, var(--surface));
    color: var(--dv-activegroup-hiddenpanel-tab-color, var(--text-dim));
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .tree-data-node.selected .tree-data-node-title {
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }
</style>
