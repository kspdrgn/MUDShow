<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
  import type { CharacterRecord, HighlightDraft, HighlightRule, Rule, RuleDraft, Trigger, WorldRecord } from '../../types';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import RuleEditorPanel from './RuleEditorPanel.svelte';

  type TreeSelection =
    | { kind: 'app' }
    | { kind: 'highlight'; index: number }
    | { kind: 'new-highlight' }
    | { kind: 'rule'; index: number }
    | { kind: 'new-rule' }
    | { kind: 'world'; worldId: string }
    | { kind: 'character'; characterId: string };

  type TreeItem =
    | { kind: 'highlight'; index: number; label: string }
    | { kind: 'rule'; index: number; label: string }
    | { kind: 'world'; world: WorldRecord; characters: CharacterRecord[] };

  type FlatTreeItem =
    | { kind: 'app'; key: string }
    | { kind: 'highlight'; key: string; index: number; label: string }
    | { kind: 'rule'; key: string; index: number; label: string }
    | { kind: 'world'; key: string; world: WorldRecord }
    | { kind: 'character'; key: string; character: CharacterRecord };

  type ValidPastedTrigger =
    | { kind: 'highlight'; draft: HighlightDraft }
    | { kind: 'rule'; draft: RuleDraft };

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let triggers: Trigger[] = [];
  export let contextWorldId: string | null = null;
  export let contextCharacterId: string | null = null;
  export let onHighlightSave: (index: number | null, draft: HighlightDraft) => void;
  export let onHighlightDelete: (index: number) => void;
  export let onRuleSave: (index: number | null, draft: RuleDraft) => void;
  export let onRuleDelete: (index: number) => void;

  let selectedItem: TreeSelection | null = null;
  let pendingSelection: TreeSelection | null = null;
  let treeRefreshToken = 0;
  let selectedWorld: WorldRecord | null = null;
  let selectedCharacter: CharacterRecord | null = null;
  let selectedKeys = new Set<string>();
  let selectionAnchorKey: string | null = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuElement: HTMLDivElement | null = null;
  let copiedStatus = '';
  let highlights: HighlightRule[] = [];
  let rules: Rule[] = [];

  $: selectedWorld = contextWorldId ? worlds.find((world) => world.id === contextWorldId) ?? null : null;
  $: selectedCharacter =
    contextCharacterId ? characters.find((character) => character.id === contextCharacterId) ?? null : null;
  $: highlights = triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
  $: rules = triggers.filter((trigger): trigger is Rule => trigger.type === 'rule');
  $: treeItems = buildTreeItems(highlights, rules, worlds, characters, treeRefreshToken);
  $: flatTreeItems = buildFlatTreeItems(treeItems);
  $: selectedTriggerCount = getSelectedTriggerItems().length;

  function buildTreeItems(
    nextHighlights: HighlightRule[],
    nextRules: Rule[],
    nextWorlds: WorldRecord[],
    nextCharacters: CharacterRecord[],
    _refreshToken = 0,
  ): TreeItem[] {
    const nextItems: TreeItem[] = [];

    for (const [index, highlight] of nextHighlights.entries()) {
      nextItems.push({
        kind: 'highlight',
        index,
        label: highlight.pattern || `highlight ${index + 1}`,
      });
    }

    for (const [index, rule] of nextRules.entries()) {
      nextItems.push({
        kind: 'rule',
        index,
        label: rule.label || rule.pattern || `rule ${index + 1}`,
      });
    }

    for (const world of nextWorlds) {
      nextItems.push({
        kind: 'world',
        world,
        characters: nextCharacters.filter((character) => character.worldId === world.id),
      });
    }

    return nextItems;
  }

  function buildFlatTreeItems(nextTreeItems: TreeItem[]): FlatTreeItem[] {
    const nextItems: FlatTreeItem[] = [{ kind: 'app', key: 'app' }];

    for (const item of nextTreeItems) {
      if (item.kind === 'highlight') {
        nextItems.push({
          ...item,
          key: getSelectionKey(item),
        });
      } else if (item.kind === 'rule') {
        nextItems.push({
          ...item,
          key: getSelectionKey(item),
        });
      } else {
        nextItems.push({
          kind: 'world',
          key: getSelectionKey(item),
          world: item.world,
        });

        for (const character of item.characters) {
          nextItems.push({
            kind: 'character',
            key: getCharacterSelectionKey(character.id),
            character,
          });
        }
      }
    }

    return nextItems;
  }

  const DEFAULT_HIGHLIGHT_DRAFT: HighlightDraft = {
    pattern: '',
    foregroundColor: '#ffffff',
    foregroundColorEnabled: true,
    backgroundColor: '#000000',
    backgroundColorEnabled: true,
    caseSensitive: false,
    wordBoundary: true,
  };

  const DEFAULT_RULE_DRAFT: RuleDraft = {
    label: '',
    pattern: '',
    foregroundColor: '#ffffff',
    foregroundColorEnabled: true,
    backgroundColor: '#000000',
    backgroundColorEnabled: true,
    opacity: 1,
    opacityEnabled: true,
    wholeLine: false,
    caseSensitive: false,
    sampleText: 'sample text to test the rule',
  };

  function getCharacterSelectionKey(characterId: string): string {
    return `character-${characterId}`;
  }

  function getSelectionKey(item: TreeItem | Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>): string {
    if (item.kind === 'app') {
      return 'app';
    }

    if (item.kind === 'highlight') {
      return `highlight-${item.index}`;
    }

    if (item.kind === 'rule') {
      return `rule-${item.index}`;
    }

    if (item.kind === 'world') {
      return 'world' in item ? `world-${item.world.id}` : `world-${item.worldId}`;
    }

    return getCharacterSelectionKey(item.characterId);
  }

  function findFlatTreeItem(key: string): FlatTreeItem | null {
    return flatTreeItems.find((item) => item.key === key) ?? null;
  }

  function isSelected(item: TreeItem | TreeSelection): boolean {
    return selectedKeys.has(getSelectionKey(item));
  }

  function setSingleSelection(selection: TreeSelection): void {
    const key = getSelectionKey(selection);
    selectedItem = selection;
    selectedKeys = new Set([key]);
    selectionAnchorKey = key;
    copiedStatus = '';
  }

  function selectHighlight(index: number, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'highlight', index });
  }

  function selectRule(index: number, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'rule', index });
  }

  function selectWorld(worldId: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'world', worldId });
  }

  function selectCharacter(characterId: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'character', characterId });
  }

  function selectTreeItem(event: MouseEvent, selection: TreeSelection): void {
    const key = getSelectionKey(selection);

    if (event.shiftKey && selectionAnchorKey) {
      const anchorIndex = flatTreeItems.findIndex((item) => item.key === selectionAnchorKey);
      const targetIndex = flatTreeItems.findIndex((item) => item.key === key);

      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        selectedKeys = new Set(flatTreeItems.slice(start, end + 1).map((item) => item.key));
        selectedItem = selectedKeys.size === 1 ? selection : null;
        copiedStatus = '';
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      const nextKeys = new Set(selectedKeys);

      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }

      selectedKeys = nextKeys;
      selectedItem = selectedKeys.size === 1 ? selectionFromFlatItem(findFlatTreeItem([...selectedKeys][0])) : null;
      selectionAnchorKey = key;
      copiedStatus = '';
      return;
    }

    setSingleSelection(selection);
  }

  function selectionFromFlatItem(item: FlatTreeItem | null): TreeSelection | null {
    if (!item) {
      return null;
    }

    if (item.kind === 'app') {
      return { kind: 'app' };
    }

    if (item.kind === 'highlight') {
      return { kind: 'highlight', index: item.index };
    }

    if (item.kind === 'rule') {
      return { kind: 'rule', index: item.index };
    }

    if (item.kind === 'world') {
      return { kind: 'world', worldId: item.world.id };
    }

    return { kind: 'character', characterId: item.character.id };
  }

  function refreshTree(): void {
    treeRefreshToken += 1;
  }

  function addHighlight(): void {
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-highlight' };
  }

  function addRule(): void {
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-rule' };
  }

  function createHighlightDraft(highlight: HighlightRule | null | undefined): HighlightDraft {
    if (!highlight) {
      return DEFAULT_HIGHLIGHT_DRAFT;
    }

    return {
      pattern: highlight.pattern,
      foregroundColor: highlight.foregroundColor ?? '#ffffff',
      foregroundColorEnabled: highlight.foregroundColor !== undefined,
      backgroundColor: highlight.backgroundColor ?? '#000000',
      backgroundColorEnabled: highlight.backgroundColor !== undefined,
      caseSensitive: highlight.caseSensitive,
      wordBoundary: highlight.wordBoundary,
    };
  }

  function saveHighlight(index: number | null, draft: HighlightDraft): void {
    if (index === null) {
      pendingSelection = { kind: 'highlight', index: highlights.length };
    }

    onHighlightSave(index, draft);
    refreshTree();
  }

  function saveRule(index: number | null, draft: RuleDraft): void {
    if (index === null) {
      pendingSelection = { kind: 'rule', index: rules.length };
    }

    onRuleSave(index, draft);
    refreshTree();
  }

  function createRuleDraft(rule: Rule | null | undefined): RuleDraft {
    if (!rule) {
      return DEFAULT_RULE_DRAFT;
    }

    return {
      label: rule.label,
      pattern: rule.pattern,
      foregroundColor: rule.foregroundColor ?? '#ffffff',
      foregroundColorEnabled: rule.foregroundColor !== undefined,
      backgroundColor: rule.backgroundColor ?? '#000000',
      backgroundColorEnabled: rule.backgroundColor !== undefined,
      opacity: rule.opacity ?? 1,
      opacityEnabled: rule.opacity !== undefined,
      wholeLine: rule.wholeLine,
      caseSensitive: rule.caseSensitive,
      sampleText: rule.sampleText,
    };
  }

  function getSelectedTriggerItems(): FlatTreeItem[] {
    return flatTreeItems.filter((item) => selectedKeys.has(item.key) && (item.kind === 'highlight' || item.kind === 'rule'));
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
  }

  function getOptionalColor(value: unknown): { value: string; enabled: boolean } | null {
    if (value === undefined) {
      return { value: '#000000', enabled: false };
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return { value: trimmed, enabled: true };
  }

  function normalizePastedHighlight(value: Record<string, unknown>): HighlightDraft | null {
    if (value.type !== 'highlight' || typeof value.pattern !== 'string') {
      return null;
    }

    if (typeof value.caseSensitive !== 'boolean' || typeof value.wordBoundary !== 'boolean') {
      return null;
    }

    const pattern = value.pattern.trim();
    if (!pattern) {
      return null;
    }

    const foregroundColor = getOptionalColor(value.foregroundColor);
    const backgroundColor = getOptionalColor(value.backgroundColor);
    if (!foregroundColor || !backgroundColor) {
      return null;
    }

    return {
      pattern,
      foregroundColor: foregroundColor.enabled ? foregroundColor.value : '#ffffff',
      foregroundColorEnabled: foregroundColor.enabled,
      backgroundColor: backgroundColor.enabled ? backgroundColor.value : '#000000',
      backgroundColorEnabled: backgroundColor.enabled,
      caseSensitive: value.caseSensitive,
      wordBoundary: value.wordBoundary,
    };
  }

  function normalizePastedRule(value: Record<string, unknown>): RuleDraft | null {
    if (value.type !== 'rule' || typeof value.pattern !== 'string') {
      return null;
    }

    if (
      !isOptionalString(value.label) ||
      typeof value.wholeLine !== 'boolean' ||
      typeof value.caseSensitive !== 'boolean' ||
      !isOptionalString(value.sampleText)
    ) {
      return null;
    }

    const pattern = value.pattern.trim();
    if (!pattern) {
      return null;
    }

    try {
      new RegExp(pattern, value.caseSensitive ? 'gdm' : 'gdim');
    } catch {
      return null;
    }

    const foregroundColor = getOptionalColor(value.foregroundColor);
    const backgroundColor = getOptionalColor(value.backgroundColor);
    if (!foregroundColor || !backgroundColor) {
      return null;
    }

    let opacity = 1;
    let opacityEnabled = false;
    if (value.opacity !== undefined) {
      if (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1) {
        return null;
      }

      opacity = value.opacity;
      opacityEnabled = true;
    }

    return {
      label: value.label?.trim() ?? '',
      pattern,
      foregroundColor: foregroundColor.enabled ? foregroundColor.value : '#ffffff',
      foregroundColorEnabled: foregroundColor.enabled,
      backgroundColor: backgroundColor.enabled ? backgroundColor.value : '#000000',
      backgroundColorEnabled: backgroundColor.enabled,
      opacity,
      opacityEnabled,
      wholeLine: value.wholeLine,
      caseSensitive: value.caseSensitive,
      sampleText: value.sampleText?.trim() || 'sample text to test the rule',
    };
  }

  function normalizePastedTrigger(value: unknown): ValidPastedTrigger | null {
    if (!isRecord(value)) {
      return null;
    }

    if (value.type === 'highlight') {
      const draft = normalizePastedHighlight(value);
      return draft ? { kind: 'highlight', draft } : null;
    }

    if (value.type === 'rule') {
      const draft = normalizePastedRule(value);
      return draft ? { kind: 'rule', draft } : null;
    }

    return null;
  }

  function normalizePastedTriggerPayload(raw: unknown): { triggers: ValidPastedTrigger[]; skipped: number } | null {
    const entries = Array.isArray(raw) ? raw : isRecord(raw) ? [raw] : null;
    if (!entries) {
      return null;
    }

    const triggers: ValidPastedTrigger[] = [];
    let skipped = 0;

    for (const entry of entries) {
      const normalized = normalizePastedTrigger(entry);
      if (normalized) {
        triggers.push(normalized);
      } else {
        skipped += 1;
      }
    }

    return { triggers, skipped };
  }

  function buildCopyPayload(): Array<Record<string, unknown>> {
    return getSelectedTriggerItems().flatMap((item) => {
      if (item.kind === 'highlight') {
        const highlight = highlights[item.index];

        return highlight
          ? [
              {
                type: 'highlight',
                pattern: highlight.pattern,
                foregroundColor: highlight.foregroundColor,
                backgroundColor: highlight.backgroundColor,
                caseSensitive: highlight.caseSensitive,
                wordBoundary: highlight.wordBoundary,
              },
            ]
          : [];
      }

      if (item.kind === 'rule') {
        const rule = rules[item.index];

        return rule
          ? [
              {
                type: 'rule',
                label: rule.label,
                pattern: rule.pattern,
                foregroundColor: rule.foregroundColor,
                backgroundColor: rule.backgroundColor,
                opacity: rule.opacity,
                wholeLine: rule.wholeLine,
                caseSensitive: rule.caseSensitive,
                sampleText: rule.sampleText,
              },
            ]
          : [];
      }

      return [];
    });
  }

  async function copySelectedAsJson(): Promise<void> {
    const payload = buildCopyPayload();
    const json = JSON.stringify(payload, null, 2);

    if (payload.length === 0) {
      copiedStatus = 'nothing to copy';
      contextMenuOpen = false;
      return;
    }

    try {
      await copyTextToClipboard(json);
      copiedStatus = payload.length === 1 ? 'copied 1 trigger' : `copied ${payload.length} triggers`;
      contextMenuOpen = false;
    } catch (error) {
      console.error('failed to copy triggers as JSON:', error);
      copiedStatus = 'copy failed';
      contextMenuOpen = false;
    }
  }

  async function pasteFromJson(): Promise<void> {
    try {
      const clipboardText = await readTextFromClipboard();
      const parsed = JSON.parse(clipboardText) as unknown;
      const normalized = normalizePastedTriggerPayload(parsed);

      if (!normalized) {
        copiedStatus = 'paste failed: expected trigger JSON';
        contextMenuOpen = false;
        return;
      }

      if (normalized.triggers.length === 0) {
        copiedStatus = normalized.skipped > 0 ? `paste skipped ${normalized.skipped} invalid` : 'paste found no triggers';
        contextMenuOpen = false;
        return;
      }

      let addedHighlights = 0;
      let addedRules = 0;

      for (const trigger of normalized.triggers) {
        if (trigger.kind === 'highlight') {
          onHighlightSave(null, trigger.draft);
          addedHighlights += 1;
        } else {
          onRuleSave(null, trigger.draft);
          addedRules += 1;
        }
      }

      refreshTree();
      const added = addedHighlights + addedRules;
      copiedStatus =
        normalized.skipped > 0
          ? `pasted ${added}; skipped ${normalized.skipped} invalid`
          : `pasted ${added} ${added === 1 ? 'trigger' : 'triggers'}`;
      contextMenuOpen = false;
    } catch (error) {
      console.error('failed to paste triggers from JSON:', error);
      copiedStatus = 'paste failed';
      contextMenuOpen = false;
    }
  }

  function closeContextMenu(): void {
    contextMenuOpen = false;
  }

  async function openContextMenu(event: MouseEvent, selection: TreeSelection): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const key = getSelectionKey(selection);
    if (!selectedKeys.has(key)) {
      setSingleSelection(selection);
    }

    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'triggers-tree' } }));

    await tick();

    if (!contextMenuElement) {
      return;
    }

    const margin = 8;
    const rect = contextMenuElement.getBoundingClientRect();
    contextMenuPosition = {
      x: Math.min(event.clientX, window.innerWidth - rect.width - margin),
      y: Math.min(event.clientY, window.innerHeight - rect.height - margin),
    };
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
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
    };
  });

  $: {
    if (pendingSelection?.kind === 'highlight' && highlights[pendingSelection.index] !== undefined) {
      setSingleSelection(pendingSelection);
      pendingSelection = null;
    } else if (pendingSelection?.kind === 'rule' && rules[pendingSelection.index] !== undefined) {
      setSingleSelection(pendingSelection);
      pendingSelection = null;
    } else if (selectedItem?.kind === 'highlight' && highlights[selectedItem.index] === undefined) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (selectedItem?.kind === 'rule' && rules[selectedItem.index] === undefined) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (selectedItem?.kind === 'world' && !worlds.some((world) => world.id === selectedItem.worldId)) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (
      selectedItem?.kind === 'character' &&
      !characters.some((character) => character.id === selectedItem.characterId)
    ) {
      selectedItem = null;
      selectedKeys = new Set();
    }
  }
</script>

<div class="triggers-pane">
  <aside class="triggers-tree" aria-label="triggers tree">
    <button
      type="button"
      class="triggers-tree-title triggers-tree-item triggers-tree-item--app"
      class:active={isSelected({ kind: 'app' })}
      on:click={(event) => selectTreeItem(event, { kind: 'app' })}
      on:contextmenu={(event) => openContextMenu(event, { kind: 'app' })}
    >
      app
    </button>
    <div class="triggers-tree-scroll">
      <ul class="triggers-tree-list">
        {#each treeItems as item (item.kind === 'world' ? item.world.id : `${item.kind}-${item.index}`)}
          {#if item.kind === 'highlight'}
            <li>
              <button
                type="button"
                class="triggers-tree-item"
                class:active={isSelected(item)}
                on:click={(event) => selectHighlight(item.index, event)}
                on:contextmenu={(event) => openContextMenu(event, { kind: 'highlight', index: item.index })}
              >
                <span class="triggers-tree-icon">w</span>
                <span>{item.label}</span>
              </button>
            </li>
          {:else if item.kind === 'rule'}
            <li>
              <button
                type="button"
                class="triggers-tree-item"
                class:active={isSelected(item)}
                on:click={(event) => selectRule(item.index, event)}
                on:contextmenu={(event) => openContextMenu(event, { kind: 'rule', index: item.index })}
              >
                <span class="triggers-tree-icon">r</span>
                <span>{item.label}</span>
              </button>
            </li>
          {:else}
            <li class="triggers-tree-world">
              <button
                type="button"
                class="triggers-tree-item triggers-tree-item--world"
                class:active={isSelected(item)}
                on:click={(event) => selectWorld(item.world.id, event)}
                on:contextmenu={(event) => openContextMenu(event, { kind: 'world', worldId: item.world.id })}
              >
                <span class="triggers-tree-icon triggers-tree-icon--world">▸</span>
                <span>{item.world.name}</span>
              </button>
              <ul class="triggers-tree-list triggers-tree-list--nested">
                {#each item.characters as character}
                  <li>
                    <button
                      type="button"
                      class="triggers-tree-item triggers-tree-item--character"
                      class:active={isSelected({ kind: 'character', characterId: character.id })}
                      on:click={(event) => selectCharacter(character.id, event)}
                      on:contextmenu={(event) => openContextMenu(event, { kind: 'character', characterId: character.id })}
                    >
                      <span class="triggers-tree-icon triggers-tree-icon--character">•</span>
                      <span>{character.name}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            </li>
          {/if}
        {/each}
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
        on:click={() => void copySelectedAsJson()}
      >
        copy as JSON
      </button>
      <button
        type="button"
        class="triggers-context-menu-item"
        role="menuitem"
        on:click={() => void pasteFromJson()}
      >
        paste from JSON
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
      <HighlightsPanel
        open={true}
        title={highlights[selectedItem.index]?.pattern || `highlight ${selectedItem.index + 1}`}
        draft={createHighlightDraft(highlights[selectedItem.index])}
        scope="triggers"
        onCancel={() => {
          selectedItem = null;
        }}
        onSave={(draft) => saveHighlight(selectedItem.index, draft)}
        onDelete={() => onHighlightDelete(selectedItem.index)}
      />
    {:else if selectedItem?.kind === 'new-highlight'}
      <HighlightsPanel
        open={true}
        title="new highlight"
        draft={DEFAULT_HIGHLIGHT_DRAFT}
        scope="triggers"
        onCancel={() => {
          selectedItem = null;
        }}
        onSave={(draft) => saveHighlight(null, draft)}
      />
    {:else if selectedItem?.kind === 'rule'}
      <RuleEditorPanel
        title={rules[selectedItem.index]?.label || rules[selectedItem.index]?.pattern || `rule ${selectedItem.index + 1}`}
        draft={createRuleDraft(rules[selectedItem.index])}
        onCancel={() => {
          selectedItem = null;
        }}
        onSave={(draft) => saveRule(selectedItem.index, draft)}
        onDelete={() => onRuleDelete(selectedItem.index)}
      />
    {:else if selectedItem?.kind === 'new-rule'}
      <RuleEditorPanel
        title="new rule"
        draft={DEFAULT_RULE_DRAFT}
        onCancel={() => {
          selectedItem = null;
        }}
        onSave={(draft) => saveRule(null, draft)}
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
          <p>
            Highlights style words and phrases with simple controls.
          </p>
          <p>
            Rules offer full regular expression matching for advanced style and trigger behavior.
          </p>
          <p>
            In the future, rules and highlights will be supported within worlds and characters but they are top level for now.
          </p>
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
    grid-template-rows: auto minmax(0, 1fr) auto;
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

  .triggers-tree-list--nested {
    margin-left: 1rem;
    padding-left: 0.7rem;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .triggers-tree-world {
    display: grid;
    gap: 0.35rem;
  }

  .triggers-tree-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 1.8rem;
    padding: 0.2rem 0.35rem;
    border: 1px solid transparent;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--text-main);
    font-size: 0.9rem;
    text-align: left;
  }

  .triggers-tree-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .triggers-tree-item.active {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.07);
  }

  .triggers-tree-item--world {
    font-weight: 600;
  }

  .triggers-tree-item--character {
    padding-left: 1.15rem;
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

  .triggers-tree-icon--world,
  .triggers-tree-icon--character {
    color: var(--text-dim);
  }

  .triggers-tree-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .triggers-tree-action {
    min-width: 0;
    padding-inline: 0.6rem;
    white-space: nowrap;
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
    color: var(--text-main);
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
    color: var(--text-main);
  }

  .triggers-empty-state p {
    margin: 0;
    max-width: 42ch;
  }
</style>
