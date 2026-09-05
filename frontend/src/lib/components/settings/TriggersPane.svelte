<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { CharacterRecord, HighlightDraft, HighlightRule, Rule, RuleDraft, Trigger, TriggerOwner, WorldRecord } from '../../types';
  import { APP_TRIGGER_OWNER } from '../../triggers';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import RuleEditorPanel from './RuleEditorPanel.svelte';
  import { createDefaultRuleDraft, createRuleDraft as createRuleEditorDraft } from './rule-editor';
  import { createDefaultHighlightDraft, createHighlightDraft as createHighlightEditorDraft } from './highlight-editor';
  import { copySelectedTriggersAsJson, pasteTriggersFromClipboard } from './trigger-pane-clipboard';
  import {
    confirmDiscardDirtyEditor as confirmTriggerEditorDiscard,
    getClearPasteOwner,
    getPreferredNewOwner,
    getSelectionFromFlatItem,
    getSelectionRangeKeys,
    toggleSelectionKeySet,
  } from './trigger-selection';
  import {
    createPointerDragState,
    getDropIndicatorIndexFromPoint,
    getDropPlanForIndicator,
    type PointerDragState,
  } from './triggers-drag';
  import {
    getClampedContextMenuPosition,
    isTriggerSelectionValid,
    resolvePendingNewSelection,
  } from './trigger-pane-state';
  import {
    buildFlatTreeItems,
    getCharacterSelectionKey,
    getNodeClasses,
    getNodeIcon,
    getNodeSelection,
    getSelectionKey,
    type SelectableTreeSelection,
    type FlatTreeItem,
    type TreeSelection,
  } from './triggers-tree';

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let triggers: Trigger[] = [];
  export let contextWorldId: string | null = null;
  export let contextCharacterId: string | null = null;
  export let onHighlightSave: (id: string | null, owner: TriggerOwner, draft: HighlightDraft) => void;
  export let onHighlightDelete: (id: string) => void;
  export let onRuleSave: (id: string | null, owner: TriggerOwner, draft: RuleDraft) => void;
  export let onRuleDelete: (id: string) => void;
  export let onTriggerMove: (id: string, owner: TriggerOwner, beforeTriggerId: string | null) => void;

  let selectedItem: TreeSelection | null = null;
  let pendingNewSelection: { type: Trigger['type']; owner: TriggerOwner } | null = null;
  let treeRefreshToken = 0;
  let selectedKeys = new Set<string>();
  let selectionAnchorKey: string | null = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuElement: HTMLDivElement | null = null;
  let copiedStatus = '';
  let pendingDraftOwner: TriggerOwner = APP_TRIGGER_OWNER;
  let editorDirty = false;
  let pointerDragState: PointerDragState | null = null;
  let dropIndicatorIndex: number | null = null;
  let suppressNextClick = false;
  let highlights: HighlightRule[] = [];
  let rules: Rule[] = [];

  $: highlights = triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
  $: rules = triggers.filter((trigger): trigger is Rule => trigger.type === 'rule');
  $: visibleCharacters = characters;
  $: flatTreeItems = buildFlatTreeItems(triggers, worlds, visibleCharacters);
  $: selectedTriggerCount = getSelectedTriggerItems().length;

  const NEW_HIGHLIGHT_DRAFT: HighlightDraft = createDefaultHighlightDraft();
  const NEW_RULE_DRAFT: RuleDraft = createDefaultRuleDraft();

  function findFlatTreeItem(key: string): FlatTreeItem | null {
    return flatTreeItems.find((item) => item.key === key) ?? null;
  }

  function isSelected(item: Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>): boolean {
    return selectedKeys.has(getSelectionKey(item));
  }

  function setSingleSelection(selection: SelectableTreeSelection): void {
    const key = getSelectionKey(selection);
    selectedItem = selection;
    selectedKeys = new Set([key]);
    selectionAnchorKey = key;
    copiedStatus = '';
  }

  function selectHighlight(id: string, event: MouseEvent): void {
    void selectTreeItem(event, { kind: 'highlight', id });
  }

  function selectRule(id: string, event: MouseEvent): void {
    void selectTreeItem(event, { kind: 'rule', id });
  }

  function selectWorld(worldId: string, event: MouseEvent): void {
    void selectTreeItem(event, { kind: 'world', worldId });
  }

  function selectCharacter(characterId: string, event: MouseEvent): void {
    void selectTreeItem(event, { kind: 'character', characterId });
  }

  async function selectTreeItem(event: MouseEvent, selection: SelectableTreeSelection): Promise<void> {
    const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
    editorDirty = dirtyCheck.dirty;
    if (!dirtyCheck.accepted) {
      return;
    }

    const key = getSelectionKey(selection);

    if (event.shiftKey && selectionAnchorKey) {
      const rangeKeys = getSelectionRangeKeys(flatTreeItems, selectionAnchorKey, key);
      if (rangeKeys) {
        selectedKeys = new Set(rangeKeys);
        selectedItem = selectedKeys.size === 1 ? selection : null;
        copiedStatus = '';
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      selectedKeys = toggleSelectionKeySet(selectedKeys, key);
      selectedItem = selectedKeys.size === 1 ? getSelectionFromFlatItem(findFlatTreeItem([...selectedKeys][0])) : null;
      selectionAnchorKey = key;
      copiedStatus = '';
      return;
    }

    setSingleSelection(selection);
  }

  function refreshTree(): void {
    treeRefreshToken += 1;
  }

  function getOwnerForSelection(selection: TreeSelection | null): TriggerOwner | null {
    if (!selection) {
      return null;
    }

    if (selection.kind === 'app') {
      return APP_TRIGGER_OWNER;
    }

    if (selection.kind === 'world') {
      return { kind: 'world', worldId: selection.worldId };
    }

    if (selection.kind === 'character') {
      return { kind: 'character', characterId: selection.characterId };
    }

    if (selection.kind === 'highlight' || selection.kind === 'rule') {
      return triggers.find((trigger) => trigger.id === selection.id)?.owner ?? null;
    }

    return null;
  }

  async function addHighlight(): Promise<void> {
    const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
    editorDirty = dirtyCheck.dirty;
    if (!dirtyCheck.accepted) {
      return;
    }

    const owner = getPreferredNewOwner({
      selectedKeys,
      items: flatTreeItems,
      contextWorldId,
      contextCharacterId,
      worlds,
      characters: visibleCharacters,
    });
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-highlight' };
    pendingNewSelection = null;
    pendingDraftOwner = owner;
  }

  async function addRule(): Promise<void> {
    const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
    editorDirty = dirtyCheck.dirty;
    if (!dirtyCheck.accepted) {
      return;
    }

    const owner = getPreferredNewOwner({
      selectedKeys,
      items: flatTreeItems,
      contextWorldId,
      contextCharacterId,
      worlds,
      characters: visibleCharacters,
    });
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-rule' };
    pendingNewSelection = null;
    pendingDraftOwner = owner;
  }

  function findTrigger(id: string | null): Trigger | null {
    return id ? triggers.find((trigger) => trigger.id === id) ?? null : null;
  }

  function saveHighlight(id: string | null, owner: TriggerOwner, draft: HighlightDraft): void {
    if (id === null) {
      pendingNewSelection = { type: 'highlight', owner };
    }

    onHighlightSave(id, owner, draft);
    editorDirty = false;
    refreshTree();
  }

  function saveRule(id: string | null, owner: TriggerOwner, draft: RuleDraft): void {
    if (id === null) {
      pendingNewSelection = { type: 'rule', owner };
    }

    onRuleSave(id, owner, draft);
    editorDirty = false;
    refreshTree();
  }

  function createRuleDraft(rule: Rule | null | undefined): RuleDraft {
    return createRuleEditorDraft(rule);
  }

  type SelectedTriggerItem = Extract<FlatTreeItem, { kind: 'highlight' } | { kind: 'rule' }>;

  function getSelectedTriggerItems(): SelectedTriggerItem[] {
    return flatTreeItems.filter(
      (item): item is SelectedTriggerItem => selectedKeys.has(item.key) && (item.kind === 'highlight' || item.kind === 'rule'),
    );
  }

  function handleTriggerKeydown(event: KeyboardEvent, id: string, type: Trigger['type']): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setSingleSelection({ kind: type, id });
  }

  function handleNodeClick(event: MouseEvent, item: FlatTreeItem): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }

    void selectTreeItem(event, getNodeSelection(item));
  }

  function handleNodeKeydown(event: KeyboardEvent, item: FlatTreeItem): void {
    if (item.kind === 'highlight' || item.kind === 'rule') {
      handleTriggerKeydown(event, item.trigger.id, item.kind);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSingleSelection(getNodeSelection(item));
    }
  }

  function handleNodePointerDown(event: PointerEvent, item: FlatTreeItem): void {
    const dragState = createPointerDragState(item, event);
    if (!dragState) {
      return;
    }

    pointerDragState = dragState;
  }

  function handlePointerMove(event: PointerEvent): void {
    const dragState = pointerDragState;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.active && distance < 4) {
      return;
    }

    pointerDragState = { ...dragState, active: true };
    event.preventDefault();
    dropIndicatorIndex = getDropIndicatorIndexFromPoint(event.clientY);
  }

  async function handlePointerUp(event: PointerEvent): Promise<void> {
    const dragState = pointerDragState;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    pointerDragState = null;
    const indicatorIndex = dropIndicatorIndex;
    dropIndicatorIndex = null;

    if (!dragState.active || indicatorIndex === null) {
      return;
    }

    suppressNextClick = true;
    event.preventDefault();

    const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
    editorDirty = dirtyCheck.dirty;
    if (!dirtyCheck.accepted) {
      return;
    }

    const moved = triggers.find((trigger) => trigger.id === dragState.triggerId);
    const dropPlan = moved ? getDropPlanForIndicator(moved, dragState.sourceNodeKey, indicatorIndex, flatTreeItems) : null;
    if (!moved || !dropPlan) {
      return;
    }

    onTriggerMove(dragState.triggerId, dropPlan.owner, dropPlan.beforeTriggerId);
    if (moved?.type === 'rule') {
      setSingleSelection({ kind: 'rule', id: dragState.triggerId });
    } else if (moved?.type === 'highlight') {
      setSingleSelection({ kind: 'highlight', id: dragState.triggerId });
    }
  }

  function closeContextMenu(): void {
    contextMenuOpen = false;
  }

  async function openContextMenu(event: MouseEvent, selection: SelectableTreeSelection): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const key = getSelectionKey(selection);
    if (!selectedKeys.has(key)) {
      const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
      editorDirty = dirtyCheck.dirty;
      if (!dirtyCheck.accepted) {
        return;
      }
      setSingleSelection(selection);
    }

    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'triggers-tree' } }));

    await tick();

    if (!contextMenuElement) {
      return;
    }

    contextMenuPosition = getClampedContextMenuPosition(
      event.clientX,
      event.clientY,
      contextMenuElement,
      { width: window.innerWidth, height: window.innerHeight },
    );
  }

  onMount(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!contextMenuOpen) {
        return;
      }

      if (event.target instanceof Node && contextMenuElement?.contains(event.target)) {
        return;
      }

      closeContextMenu();
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (!contextMenuOpen) {
        return;
      }

      if (event.target instanceof Node && contextMenuElement?.contains(event.target)) {
        return;
      }

      closeContextMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { source?: string }) : null;
      if (detail?.source !== 'triggers-tree') {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
    };
  });

  $: {
    const resolvedSelection = resolvePendingNewSelection(triggers, pendingNewSelection);
    if (resolvedSelection) {
      setSingleSelection(resolvedSelection);
      pendingNewSelection = null;
    } else if (!isTriggerSelectionValid(selectedItem, triggers, worlds, visibleCharacters)) {
      selectedItem = null;
      selectedKeys = new Set();
    }
  }
</script>

<div class="triggers-pane">
  <aside class:dragging={pointerDragState?.active} class="triggers-tree" aria-label="triggers tree">
    <div class="triggers-tree-scroll">
      <ul class="triggers-tree-list">
        {#each flatTreeItems as item, index (item.key)}
          <li class="triggers-tree-row">
            {#if pointerDragState?.active && dropIndicatorIndex === index}
              <div class="triggers-tree-drop-indicator"></div>
            {/if}
            <div
              role="button"
              tabindex="0"
              data-trigger-tree-node-key={item.key}
              class={getNodeClasses(item)}
              class:active={selectedKeys.has(item.key)}
              class:drag-source={pointerDragState?.sourceNodeKey === item.key}
              style={`--tree-depth: ${item.depth};`}
              on:click={(event) => handleNodeClick(event, item)}
              on:keydown={(event) => handleNodeKeydown(event, item)}
              on:contextmenu={(event) => openContextMenu(event, getNodeSelection(item))}
              on:pointerdown={(event) => handleNodePointerDown(event, item)}
            >
              <span class="triggers-tree-icon" class:triggers-tree-icon--owner={item.kind === 'app' || item.kind === 'world' || item.kind === 'character'}>
                {getNodeIcon(item)}
              </span>
              <span>{item.label}</span>
            </div>
          </li>
        {/each}
        {#if pointerDragState?.active && dropIndicatorIndex === flatTreeItems.length}
          <li class="triggers-tree-row triggers-tree-row--drop-end">
            <div class="triggers-tree-drop-indicator"></div>
          </li>
        {/if}
      </ul>
    </div>
    <div class="triggers-tree-actions">
      <button type="button" class="btn triggers-tree-action primary" on:click={addHighlight}>Add highlight</button>
      <button type="button" class="btn triggers-tree-action primary" on:click={addRule}>Add rule</button>
    </div>
  </aside>

  {#if contextMenuOpen}
    <div
      bind:this={contextMenuElement}
      class="triggers-context-menu"
      role="menu"
      tabindex="-1"
      aria-label="triggers context menu"
      style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}
      on:click|stopPropagation
      on:keydown={(event) => {
        if (event.key === 'Escape') {
          closeContextMenu();
        }
      }}
      on:contextmenu|preventDefault
    >
      <button
        type="button"
        class="triggers-context-menu-item"
        role="menuitem"
        on:click={() => {
          void copySelectedTriggersAsJson(getSelectedTriggerItems().map((item) => item.trigger)).then((status) => {
            copiedStatus = status;
            contextMenuOpen = false;
          });
        }}
      >
        copy as JSON
      </button>
      <button
        type="button"
        class="triggers-context-menu-item"
        role="menuitem"
        on:click={() => {
          void pasteTriggersFromClipboard({
            getOwner: () => getClearPasteOwner(selectedKeys, flatTreeItems),
            onHighlightSave,
            onRuleSave,
          }).then((status) => {
            copiedStatus = status;
            refreshTree();
            contextMenuOpen = false;
          });
        }}
      >
        paste JSON
      </button>
    </div>
  {/if}

  <section class="triggers-editor">
    {#if selectedKeys.size > 1}
      <div class="triggers-empty-state">
        <div class="triggers-empty-title">{selectedKeys.size} selected</div>
        <p>
          {selectedTriggerCount === 0
            ? 'No selected triggers can be copied. Valid trigger JSON can still be pasted from the context menu.'
            : `${selectedTriggerCount} selected ${selectedTriggerCount === 1 ? 'trigger' : 'triggers'} can be copied as JSON from the context menu. Valid trigger JSON can also be pasted there.`}
        </p>
        {#if copiedStatus}
          <p>{copiedStatus}</p>
        {/if}
      </div>
    {:else if selectedItem?.kind === 'highlight'}
      {@const selectedHighlightId = selectedItem.id}
      {@const selectedHighlight = findTrigger(selectedHighlightId) as HighlightRule | null}
      <HighlightsPanel
        open={true}
        title={selectedHighlight?.pattern || 'highlight'}
          draft={createHighlightEditorDraft(selectedHighlight)}
        scope="triggers"
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveHighlight(selectedHighlightId, selectedHighlight?.owner ?? APP_TRIGGER_OWNER, draft)}
        onDelete={async () => {
          const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
          editorDirty = dirtyCheck.dirty;
          if (dirtyCheck.accepted) {
            onHighlightDelete(selectedHighlightId);
          }
        }}
        onDirtyChange={(dirty) => {
          editorDirty = dirty;
        }}
      />
    {:else if selectedItem?.kind === 'new-highlight'}
      <HighlightsPanel
        open={true}
        title="new highlight"
        draft={NEW_HIGHLIGHT_DRAFT}
        scope="triggers"
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveHighlight(null, pendingDraftOwner, draft)}
        onDirtyChange={(dirty) => {
          editorDirty = dirty;
        }}
      />
    {:else if selectedItem?.kind === 'rule'}
      {@const selectedRuleId = selectedItem.id}
      {@const selectedRule = findTrigger(selectedRuleId) as Rule | null}
      <RuleEditorPanel
        title={selectedRule?.label || selectedRule?.pattern || 'rule'}
        draft={createRuleDraft(selectedRule)}
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveRule(selectedRuleId, selectedRule?.owner ?? APP_TRIGGER_OWNER, draft)}
        onDelete={async () => {
          const dirtyCheck = await confirmTriggerEditorDiscard(editorDirty);
          editorDirty = dirtyCheck.dirty;
          if (dirtyCheck.accepted) {
            onRuleDelete(selectedRuleId);
          }
        }}
        onDirtyChange={(dirty) => {
          editorDirty = dirty;
        }}
      />
    {:else if selectedItem?.kind === 'new-rule'}
      <RuleEditorPanel
        title="new rule"
        draft={NEW_RULE_DRAFT}
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveRule(null, pendingDraftOwner, draft)}
        onDirtyChange={(dirty) => {
          editorDirty = dirty;
        }}
      />
    {:else}
      <div class="triggers-empty-state">
        {#if selectedKeys.size === 1}
          <div class="triggers-empty-title">
            {selectedItem?.kind === 'app'
              ? 'app selected'
              : selectedItem?.kind === 'world'
                ? 'world selected'
                : selectedItem?.kind === 'character'
                  ? 'character selected'
                  : 'nothing selected'}
          </div>
          <p>Use the context menu to copy selected highlights or rules as JSON, or paste valid trigger JSON.</p>
          {#if copiedStatus}
            <p>{copiedStatus}</p>
          {/if}
        {:else}
          <div class="triggers-empty-title">nothing selected</div>
          <b>Highlights</b>
          <p>
            <span>w</span>
            - Highlights style words and phrases with simple controls.
          </p>
          <b>Rules</b>
          <p>
            <span>r</span>
            - Rules offer full regular expression matching for advanced style and trigger behavior.
          </p>
          <b>Levels</b>
          <ul>
            <li>App triggers apply everywhere.</li>
            <li>World triggers apply to every character in that world, and connections not using a saved character.</li>
            <li>Character triggers apply only to that character.</li>
          </ul>
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .triggers-pane {
    display: grid;
    grid-template-columns: minmax(240px, 25%) minmax(0, 1fr);
    gap: 0.9rem;
    min-height: 100%;
    height: 100%;
    overflow: hidden;
  }

  .triggers-tree,
  .triggers-editor {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    padding: 0.85rem;
    min-height: 0;
    height: 100%;
  }

  .triggers-tree {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    overflow: hidden;
  }

  .triggers-tree-title {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 0.7rem;
  }

  .triggers-tree-item--app {
    justify-content: flex-start;
    min-height: 1.9rem;
  }

  .triggers-tree-scroll {
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .triggers-tree-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.35rem;
  }

  .triggers-tree-row {
    min-width: 0;
  }

  .triggers-tree-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 1.8rem;
    padding: 0.2rem 0.35rem 0.2rem calc(0.35rem + var(--tree-depth, 0) * 1.35rem);
    border: 1px solid transparent;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
    font-size: 0.9rem;
    text-align: left;
    user-select: none;
    touch-action: none;
  }

  .triggers-tree-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .triggers-tree-item--draggable {
    cursor: grab;
  }

  .triggers-tree.dragging,
  .triggers-tree.dragging .triggers-tree-item,
  .triggers-tree-item--draggable:active {
    cursor: grabbing;
  }

  .triggers-tree-item.active {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.07);
  }

  .triggers-tree-item.drag-source {
    opacity: 0.55;
  }

  .triggers-tree-drop-indicator {
    position: relative;
    height: 0;
    margin: -0.18rem 0 0.18rem;
    pointer-events: none;
  }

  .triggers-tree-drop-indicator::before {
    content: '';
    position: absolute;
    left: 0.3rem;
    right: 0.3rem;
    top: -1px;
    height: 2px;
    border-radius: 999px;
    background: #f1c40f;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28), 0 0 0.75rem rgba(241, 196, 15, 0.45);
  }

  .triggers-tree-drop-indicator::after {
    content: '';
    position: absolute;
    left: 0.18rem;
    top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #f1c40f;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28);
  }

  .triggers-tree-item--world {
    font-weight: 600;
  }

  .triggers-tree-item--character {
    font-size: 0.88rem;
  }

  .triggers-tree-icon {
    display: inline-flex;
    width: 1.25rem;
    justify-content: center;
    font-weight: 700;
    color: var(--accent);
    flex: 0 0 auto;
  }

  .triggers-tree-icon--owner {
    color: var(--text-dim);
  }

  .triggers-tree-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .triggers-tree-action {
    min-width: 0;
    padding-inline: 0.6rem;
    white-space: nowrap;
    min-height: 2rem;
  }

  .triggers-editor {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow-y: auto;
  }

  .triggers-context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 9rem;
    padding: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(16, 18, 24, 0.98);
    box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.35);
  }

  .triggers-context-menu-item {
    width: 100%;
    min-height: 1.85rem;
    padding: 0.25rem 0.55rem;
    border: 0;
    background: transparent;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
    font-family: var(--font-ui);
    font-size: 0.82rem;
    text-align: left;
  }

  .triggers-context-menu-item:hover:not(:disabled),
  .triggers-context-menu-item:focus-visible:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  .triggers-context-menu-item:disabled {
    color: var(--text-dim);
    cursor: default;
  }

  .triggers-empty-state {
    min-height: 16rem;
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 0.7rem;
    padding: 1.25rem;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 45%),
      rgba(255, 255, 255, 0.015);
    color: var(--text-dim);
  }

  .triggers-empty-title {
    font-family: var(--font-ui);
    font-size: 0.76rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--dv-activegroup-visiblepanel-tab-color, var(--text-bright));
  }

  .triggers-empty-state p {
    margin: 0;
    max-width: 42ch;
  }
</style>
