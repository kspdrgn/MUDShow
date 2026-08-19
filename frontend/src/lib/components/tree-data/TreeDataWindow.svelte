<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    flattenVisibleTreeDataNodes,
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
      <span class="tree-data-window-summary-label">selected:</span>
      <span class="tree-data-window-summary-value">{selectedRow.node.title}</span>
      {#if selectedRow.node.subtitle}
        <span class="tree-data-window-summary-detail">{selectedRow.node.subtitle}</span>
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
        class:selected={viewState.selectedNodeId === row.node.id}
        style={`--tree-depth: ${row.depth};`}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={isBranch ? (row.expanded ? 'true' : 'false') : undefined}
        aria-selected={viewState.selectedNodeId === row.node.id ? 'true' : 'false'}
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
          class:selected={viewState.selectedNodeId === row.node.id}
          on:click={() => selectNode(row.node.id)}
        >
          <span class="tree-data-node-title">{row.node.title}</span>
          {#if row.node.subtitle}
            <span class="tree-data-node-subtitle">{row.node.subtitle}</span>
          {/if}
        </button>

        {#if row.node.badge}
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
    gap: 0.8rem;
    width: 100%;
    min-width: 0;
    max-width: none;
    box-sizing: border-box;
    padding: 1rem;
    color: var(--text-color, #e7eef9);
    background:
      radial-gradient(circle at top right, rgba(107, 126, 255, 0.18), transparent 32%),
      linear-gradient(180deg, rgba(16, 20, 28, 0.98), rgba(10, 13, 19, 0.98));
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
    color: rgba(200, 214, 245, 0.65);
  }

  .tree-data-window h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 650;
  }

  .tree-data-window-description {
    margin: 0;
    max-width: 34rem;
    color: rgba(231, 238, 249, 0.72);
  }

  .tree-data-window-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .tree-data-window-action {
    border: 1px solid rgba(145, 164, 205, 0.24);
    border-radius: 0.7rem;
    padding: 0.45rem 0.7rem;
    background: rgba(14, 18, 26, 0.72);
    color: inherit;
    cursor: pointer;
    text-transform: lowercase;
  }

  .tree-data-window-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    border-radius: 0.75rem;
    border: 1px solid rgba(145, 164, 205, 0.16);
    padding: 0.6rem 0.75rem;
    background: rgba(8, 11, 16, 0.7);
    color: rgba(231, 238, 249, 0.88);
  }

  .tree-data-window-summary-label {
    color: rgba(200, 214, 245, 0.68);
  }

  .tree-data-window-summary-detail {
    color: rgba(200, 214, 245, 0.74);
  }

  .tree-data-window-tree {
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    width: 100%;
    min-width: 0;
    padding: 0.2rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(145, 164, 205, 0.14);
    background: rgba(5, 7, 10, 0.42);
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
    background: rgba(255, 255, 255, 0.04);
  }

  .tree-data-row.branch .tree-data-node-title {
    font-weight: 650;
  }

  .tree-data-row.selected {
    background: rgba(107, 126, 255, 0.16);
  }

  .tree-data-row.loading {
    background: rgba(255, 255, 255, 0.02);
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
    color: rgba(200, 214, 245, 0.88);
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

  .tree-data-node-title {
    font-size: 0.96rem;
    font-weight: 600;
    color: rgba(240, 245, 255, 0.96);
  }

  .tree-data-node-subtitle {
    font-size: 0.8rem;
    color: rgba(200, 214, 245, 0.68);
  }

  .tree-data-node-badge {
    justify-self: end;
    padding: 0.18rem 0.45rem;
    border-radius: 999px;
    border: 1px solid rgba(145, 164, 205, 0.18);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(200, 214, 245, 0.74);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .tree-data-node.selected .tree-data-node-title {
    color: #ffffff;
  }
</style>
