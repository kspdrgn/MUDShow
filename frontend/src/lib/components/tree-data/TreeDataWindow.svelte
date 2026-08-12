<script lang="ts">
  import {
    flattenVisibleTreeDataNodes,
    type TreeDataWindowModel,
  } from './tree-data-view';

  export let model: TreeDataWindowModel;
  export let selectedNodeId: string | null = null;
  export let onSelectNode: (nodeId: string) => void = () => {};
  export let onToggleNode: (nodeId: string) => void = () => {};
  export let onExpandAll: () => void = () => {};
  export let onCollapseAll: () => void = () => {};

  $: visibleRows = flattenVisibleTreeDataNodes(model.root);
  $: selectedRow = visibleRows.find((row) => row.node.id === selectedNodeId) ?? null;
</script>

<section class="tree-data-window">
  <header class="tree-data-window-header">
    <div class="tree-data-window-copy">
      <p class="tree-data-window-kicker">built-in tree-data view</p>
      <h2>{model.title}</h2>
      {#if model.description}
        <p class="tree-data-window-description">{model.description}</p>
      {/if}
    </div>

    <div class="tree-data-window-actions">
      <button type="button" class="tree-data-window-action" on:click={onExpandAll}>expand all</button>
      <button type="button" class="tree-data-window-action" on:click={onCollapseAll}>collapse all</button>
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

  <div class="tree-data-window-tree" role="tree" aria-label={model.title}>
    {#each visibleRows as row (row.node.id)}
      {@const isBranch = row.node.kind === 'branch'}
      {@const isLoading = row.node.childrenState === 'loading'}
      <div
        class="tree-data-row"
        class:branch={isBranch}
        class:loading={isLoading}
        class:selected={selectedNodeId === row.node.id}
        style={`--tree-depth: ${row.depth};`}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={isBranch ? (row.node.expanded === true ? 'true' : 'false') : undefined}
        aria-selected={selectedNodeId === row.node.id ? 'true' : 'false'}
      >
        {#if isBranch}
          <button
            type="button"
            class="tree-data-toggle tree-data-toggle--branch"
            aria-label={`${row.node.expanded === true ? 'collapse' : 'expand'} ${row.node.title}`}
            aria-expanded={row.node.expanded === true ? 'true' : 'false'}
            aria-busy={isLoading ? 'true' : 'false'}
            disabled={isLoading}
            on:pointerdown|stopPropagation
            on:click|stopPropagation={() => onToggleNode(row.node.id)}
          >
            {#if isLoading}
              …
            {:else}
              {row.node.expanded === true ? '▼' : '▶'}
            {/if}
          </button>
        {:else}
          <span class="tree-data-toggle tree-data-toggle--spacer" aria-hidden="true"></span>
        {/if}

        <button
          type="button"
          class="tree-data-node"
          class:selected={selectedNodeId === row.node.id}
          on:click={() => onSelectNode(row.node.id)}
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
