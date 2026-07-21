<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
  import type { CharacterRecord, HighlightDraft, HighlightRule, Rule, RuleDraft, Trigger, TriggerOwner, WorldRecord } from '../../types';
  import { APP_TRIGGER_OWNER, canCharacterOwnTriggers, getOwnerTriggers, triggerOwnerEquals } from '../../triggers';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import RuleEditorPanel from './RuleEditorPanel.svelte';

  type TreeSelection =
    | { kind: 'app' }
    | { kind: 'highlight'; id: string }
    | { kind: 'new-highlight' }
    | { kind: 'rule'; id: string }
    | { kind: 'new-rule' }
    | { kind: 'world'; worldId: string }
    | { kind: 'character'; characterId: string };

  type FlatTreeItem =
    | { kind: 'app'; key: string; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true }
    | { kind: 'highlight'; key: string; trigger: HighlightRule; owner: TriggerOwner; label: string; depth: number; draggable: true; droppable: true }
    | { kind: 'rule'; key: string; trigger: Rule; owner: TriggerOwner; label: string; depth: number; draggable: true; droppable: true }
    | { kind: 'world'; key: string; world: WorldRecord; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true }
    | { kind: 'character'; key: string; character: CharacterRecord; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true };

  type PointerDragState = {
    pointerId: number;
    sourceNodeKey: string;
    triggerId: string;
    startX: number;
    startY: number;
    active: boolean;
  };

  type ValidPastedTrigger =
    | { kind: 'highlight'; draft: HighlightDraft }
    | { kind: 'rule'; draft: RuleDraft };

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
  $: visibleCharacters = characters.filter(canCharacterOwnTriggers);
  $: flatTreeItems = buildFlatTreeItems(triggers, worlds, visibleCharacters, treeRefreshToken);
  $: selectedTriggerCount = getSelectedTriggerItems().length;

  function buildFlatTreeItems(
    nextTriggers: Trigger[],
    nextWorlds: WorldRecord[],
    nextCharacters: CharacterRecord[],
    _refreshToken = 0,
  ): FlatTreeItem[] {
    const nextItems: FlatTreeItem[] = [{
      kind: 'app',
      key: 'app',
      owner: APP_TRIGGER_OWNER,
      label: 'app',
      depth: 0,
      draggable: false,
      droppable: true,
    }];
    nextItems.push(...getFlatTriggerItemsForOwner(nextTriggers, APP_TRIGGER_OWNER, 1));

    for (const world of nextWorlds) {
      const worldOwner: TriggerOwner = { kind: 'world', worldId: world.id };
      nextItems.push({
        kind: 'world',
        key: getSelectionKey({ kind: 'world', worldId: world.id }),
        world,
        owner: worldOwner,
        label: world.name,
        depth: 1,
        draggable: false,
        droppable: true,
      });
      nextItems.push(...getFlatTriggerItemsForOwner(nextTriggers, worldOwner, 2));

      for (const character of nextCharacters.filter((entry) => entry.worldId === world.id)) {
        const characterOwner: TriggerOwner = { kind: 'character', characterId: character.id };
        nextItems.push({
          kind: 'character',
          key: getCharacterSelectionKey(character.id),
          character,
          owner: characterOwner,
          label: character.name,
          depth: 2,
          draggable: false,
          droppable: true,
        });
        nextItems.push(...getFlatTriggerItemsForOwner(nextTriggers, characterOwner, 3));
      }
    }

    return nextItems;
  }

  function getFlatTriggerItemsForOwner(nextTriggers: Trigger[], owner: TriggerOwner, depth: number): FlatTreeItem[] {
    return [
      ...getOwnerTriggers(nextTriggers, owner).filter((trigger): trigger is HighlightRule => trigger.type === 'highlight'),
      ...getOwnerTriggers(nextTriggers, owner).filter((trigger): trigger is Rule => trigger.type === 'rule'),
    ].map((trigger) => {
      if (trigger.type === 'highlight') {
        return {
          kind: 'highlight',
          key: getTriggerSelectionKey(trigger.id),
          trigger,
          owner,
          label: trigger.pattern || 'highlight',
          depth,
          draggable: true,
          droppable: true,
        };
      }

      return {
        kind: 'rule',
        key: getTriggerSelectionKey(trigger.id),
        trigger,
        owner,
        label: trigger.label || trigger.pattern || 'rule',
        depth,
        draggable: true,
        droppable: true,
      };
    });
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
    stopOtherRules: false,
    stopHighlights: false,
    sampleText: 'sample text to test the rule',
  };

  function getCharacterSelectionKey(characterId: string): string {
    return `character-${characterId}`;
  }

  function getTriggerSelectionKey(id: string): string {
    return `trigger-${id}`;
  }

  function getSelectionKey(item: Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>): string {
    if (item.kind === 'app') {
      return 'app';
    }

    if (item.kind === 'highlight') {
      return getTriggerSelectionKey(item.id);
    }

    if (item.kind === 'rule') {
      return getTriggerSelectionKey(item.id);
    }

    if (item.kind === 'world') {
      return `world-${item.worldId}`;
    }

    return getCharacterSelectionKey(item.characterId);
  }

  function findFlatTreeItem(key: string): FlatTreeItem | null {
    return flatTreeItems.find((item) => item.key === key) ?? null;
  }

  function isSelected(item: Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>): boolean {
    return selectedKeys.has(getSelectionKey(item));
  }

  function setSingleSelection(selection: TreeSelection): void {
    const key = getSelectionKey(selection);
    selectedItem = selection;
    selectedKeys = new Set([key]);
    selectionAnchorKey = key;
    copiedStatus = '';
  }

  function selectHighlight(id: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'highlight', id });
  }

  function selectRule(id: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'rule', id });
  }

  function selectWorld(worldId: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'world', worldId });
  }

  function selectCharacter(characterId: string, event: MouseEvent): void {
    selectTreeItem(event, { kind: 'character', characterId });
  }

  function selectTreeItem(event: MouseEvent, selection: TreeSelection): void {
    if (!confirmDiscardDirtyEditor()) {
      return;
    }

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
      return { kind: 'highlight', id: item.trigger.id };
    }

    if (item.kind === 'rule') {
      return { kind: 'rule', id: item.trigger.id };
    }

    if (item.kind === 'world') {
      return { kind: 'world', worldId: item.world.id };
    }

    return { kind: 'character', characterId: item.character.id };
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

  function getPreferredNewOwner(): TriggerOwner {
    const selectedOwner = getClearPasteOwner();
    if (selectedOwner) {
      return selectedOwner;
    }

    const contextCharacter = contextCharacterId
      ? visibleCharacters.find((character) => character.id === contextCharacterId) ?? null
      : null;
    if (contextCharacter) {
      return { kind: 'character', characterId: contextCharacter.id };
    }

    if (contextWorldId && worlds.some((world) => world.id === contextWorldId)) {
      return { kind: 'world', worldId: contextWorldId };
    }

    return APP_TRIGGER_OWNER;
  }

  function addHighlight(): void {
    if (!confirmDiscardDirtyEditor()) {
      return;
    }

    const owner = getPreferredNewOwner();
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-highlight' };
    pendingNewSelection = null;
    pendingDraftOwner = owner;
  }

  function addRule(): void {
    if (!confirmDiscardDirtyEditor()) {
      return;
    }

    const owner = getPreferredNewOwner();
    selectedKeys = new Set();
    selectionAnchorKey = null;
    selectedItem = { kind: 'new-rule' };
    pendingNewSelection = null;
    pendingDraftOwner = owner;
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
      stopOtherRules: rule.stopOtherRules,
      stopHighlights: rule.stopHighlights,
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
      (value.stopOtherRules !== undefined && typeof value.stopOtherRules !== 'boolean') ||
      (value.stopHighlights !== undefined && typeof value.stopHighlights !== 'boolean') ||
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
      stopOtherRules: value.stopOtherRules === true,
      stopHighlights: value.stopHighlights === true,
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

  function getOwnerFromFlatItem(item: FlatTreeItem | null): TriggerOwner | null {
    if (!item) {
      return null;
    }

    if (item.kind === 'app') {
      return APP_TRIGGER_OWNER;
    }

    if (item.kind === 'world') {
      return { kind: 'world', worldId: item.world.id };
    }

    if (item.kind === 'character') {
      return { kind: 'character', characterId: item.character.id };
    }

    return item.owner;
  }

  function getClearPasteOwner(): TriggerOwner | null {
    if (selectedKeys.size === 0) {
      return APP_TRIGGER_OWNER;
    }

    let owner: TriggerOwner | null = null;
    for (const key of selectedKeys) {
      const itemOwner = getOwnerFromFlatItem(findFlatTreeItem(key));
      if (!itemOwner) {
        continue;
      }

      if (!owner) {
        owner = itemOwner;
        continue;
      }

      if (!triggerOwnerEquals(owner, itemOwner)) {
        return null;
      }
    }

    return owner;
  }

  function handleTriggerKeydown(event: KeyboardEvent, id: string, type: Trigger['type']): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setSingleSelection({ kind: type, id });
  }

  function getNodeSelection(item: FlatTreeItem): Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }> {
    if (item.kind === 'app') {
      return { kind: 'app' };
    }

    if (item.kind === 'world') {
      return { kind: 'world', worldId: item.world.id };
    }

    if (item.kind === 'character') {
      return { kind: 'character', characterId: item.character.id };
    }

    if (item.kind === 'highlight') {
      return { kind: 'highlight', id: item.trigger.id };
    }

    return { kind: 'rule', id: item.trigger.id };
  }

  function getNodeIcon(item: FlatTreeItem): string {
    if (item.kind === 'app') {
      return 'a';
    }

    if (item.kind === 'world') {
      return '▸';
    }

    if (item.kind === 'character') {
      return '•';
    }

    return item.kind === 'highlight' ? 'w' : 'r';
  }

  function getNodeClasses(item: FlatTreeItem): string {
    const classes = ['triggers-tree-item'];
    if (item.draggable) {
      classes.push('triggers-tree-item--draggable');
    }
    if (item.kind === 'app') {
      classes.push('triggers-tree-item--app');
    } else if (item.kind === 'world') {
      classes.push('triggers-tree-item--world');
    } else if (item.kind === 'character') {
      classes.push('triggers-tree-item--character');
    }

    return classes.join(' ');
  }

  function handleNodeClick(event: MouseEvent, item: FlatTreeItem): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }

    selectTreeItem(event, getNodeSelection(item));
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
    if (!item.draggable || (item.kind !== 'highlight' && item.kind !== 'rule') || event.button !== 0) {
      return;
    }

    pointerDragState = {
      pointerId: event.pointerId,
      sourceNodeKey: item.key,
      triggerId: item.trigger.id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function getDropIndicatorIndexFromPoint(_x: number, y: number): number {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-trigger-tree-node-key]'));
    if (rows.length === 0) {
      return 0;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        return index;
      }
    }

    return rows.length;
  }

  function getFirstTriggerIdForOwnerAndType(
    items: FlatTreeItem[],
    owner: TriggerOwner,
    type: Trigger['type'],
  ): string | null {
    const first = items.find(
      (item) =>
        (item.kind === 'highlight' || item.kind === 'rule') &&
        item.trigger.type === type &&
        triggerOwnerEquals(item.owner, owner),
    );

    return first && (first.kind === 'highlight' || first.kind === 'rule') ? first.trigger.id : null;
  }

  function getFirstFollowingTriggerIdForOwnerAndType(
    items: FlatTreeItem[],
    startIndex: number,
    owner: TriggerOwner,
    type: Trigger['type'],
  ): string | null {
    const following = items.slice(Math.max(0, startIndex)).find(
      (item) =>
        (item.kind === 'highlight' || item.kind === 'rule') &&
        item.trigger.type === type &&
        triggerOwnerEquals(item.owner, owner),
    );

    return following && (following.kind === 'highlight' || following.kind === 'rule') ? following.trigger.id : null;
  }

  function getDropPlanForIndicator(
    source: Trigger,
    sourceNodeKey: string,
    indicatorIndex: number,
  ): { owner: TriggerOwner; beforeTriggerId: string | null } | null {
    const sourceIndex = flatTreeItems.findIndex((item) => item.key === sourceNodeKey);
    const itemsWithoutSource = flatTreeItems.filter((item) => item.key !== sourceNodeKey);
    const insertionIndex = sourceIndex >= 0 && sourceIndex < indicatorIndex
      ? indicatorIndex - 1
      : indicatorIndex;
    const beforeItem = itemsWithoutSource[insertionIndex] ?? null;
    const previousItem = insertionIndex > 0 ? itemsWithoutSource[insertionIndex - 1] ?? null : null;
    const beforeItemIsSameTypeTrigger =
      beforeItem !== null &&
      (beforeItem.kind === 'highlight' || beforeItem.kind === 'rule') &&
      beforeItem.trigger.type === source.type;
    const ownerSource = beforeItemIsSameTypeTrigger
      ? beforeItem
      : previousItem ?? beforeItem;
    const owner = ownerSource ? getOwnerFromFlatItem(ownerSource) : APP_TRIGGER_OWNER;

    if (!owner) {
      return null;
    }

    if (
      beforeItemIsSameTypeTrigger &&
      triggerOwnerEquals(beforeItem.owner, owner)
    ) {
      return { owner, beforeTriggerId: beforeItem.trigger.id };
    }

    const firstFollowingSameTypeTriggerId = getFirstFollowingTriggerIdForOwnerAndType(
      itemsWithoutSource,
      insertionIndex,
      owner,
      source.type,
    );
    if (firstFollowingSameTypeTriggerId) {
      return { owner, beforeTriggerId: firstFollowingSameTypeTriggerId };
    }

    if (
      beforeItem &&
      ownerSource === beforeItem &&
      (beforeItem.kind === 'app' || beforeItem.kind === 'world' || beforeItem.kind === 'character')
    ) {
      return {
        owner,
        beforeTriggerId: getFirstTriggerIdForOwnerAndType(itemsWithoutSource, owner, source.type),
      };
    }

    return { owner, beforeTriggerId: null };
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
    dropIndicatorIndex = getDropIndicatorIndexFromPoint(event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent): void {
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

    if (!confirmDiscardDirtyEditor()) {
      return;
    }

    const moved = triggers.find((trigger) => trigger.id === dragState.triggerId);
    const dropPlan = moved ? getDropPlanForIndicator(moved, dragState.sourceNodeKey, indicatorIndex) : null;
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

  function buildCopyPayload(): Array<Record<string, unknown>> {
    return getSelectedTriggerItems().flatMap((item) => {
      if (item.kind === 'highlight') {
        const highlight = item.trigger;

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
        const rule = item.trigger;

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
                stopOtherRules: rule.stopOtherRules,
                stopHighlights: rule.stopHighlights,
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
      const owner = getClearPasteOwner();
      if (!owner) {
        copiedStatus = 'paste needs one target owner';
        contextMenuOpen = false;
        return;
      }

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
          onHighlightSave(null, owner, trigger.draft);
          addedHighlights += 1;
        } else {
          onRuleSave(null, owner, trigger.draft);
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

  function confirmDiscardDirtyEditor(): boolean {
    if (!editorDirty) {
      return true;
    }

    const confirmed = window.confirm('Discard unsaved trigger changes?');
    if (confirmed) {
      editorDirty = false;
    }
    return confirmed;
  }

  async function openContextMenu(event: MouseEvent, selection: TreeSelection): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const key = getSelectionKey(selection);
    if (!selectedKeys.has(key)) {
      if (!confirmDiscardDirtyEditor()) {
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
    if (pendingNewSelection) {
      const candidates = triggers.filter(
        (trigger) => trigger.type === pendingNewSelection?.type && triggerOwnerEquals(trigger.owner, pendingNewSelection.owner),
      );
      const created = candidates[candidates.length - 1] ?? null;
      if (created?.type === 'highlight') {
        setSingleSelection({ kind: 'highlight', id: created.id });
        pendingNewSelection = null;
      } else if (created?.type === 'rule') {
        setSingleSelection({ kind: 'rule', id: created.id });
        pendingNewSelection = null;
      }
    } else if (selectedItem?.kind === 'highlight' && !triggers.some((trigger) => trigger.id === selectedItem.id)) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (selectedItem?.kind === 'rule' && !triggers.some((trigger) => trigger.id === selectedItem.id)) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (selectedItem?.kind === 'world' && !worlds.some((world) => world.id === selectedItem.worldId)) {
      selectedItem = null;
      selectedKeys = new Set();
    } else if (
      selectedItem?.kind === 'character' &&
      !visibleCharacters.some((character) => character.id === selectedItem.characterId)
    ) {
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
      {@const selectedHighlight = findTrigger(selectedItem.id) as HighlightRule | null}
      <HighlightsPanel
        open={true}
        title={selectedHighlight?.pattern || 'highlight'}
        draft={createHighlightDraft(selectedHighlight)}
        scope="triggers"
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveHighlight(selectedItem.id, selectedHighlight?.owner ?? APP_TRIGGER_OWNER, draft)}
        onDelete={() => {
          if (confirmDiscardDirtyEditor()) {
            onHighlightDelete(selectedItem.id);
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
        draft={DEFAULT_HIGHLIGHT_DRAFT}
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
      {@const selectedRule = findTrigger(selectedItem.id) as Rule | null}
      <RuleEditorPanel
        title={selectedRule?.label || selectedRule?.pattern || 'rule'}
        draft={createRuleDraft(selectedRule)}
        onCancel={() => {
          editorDirty = false;
          selectedItem = null;
        }}
        onSave={(draft) => saveRule(selectedItem.id, selectedRule?.owner ?? APP_TRIGGER_OWNER, draft)}
        onDelete={() => {
          if (confirmDiscardDirtyEditor()) {
            onRuleDelete(selectedItem.id);
          }
        }}
        onDirtyChange={(dirty) => {
          editorDirty = dirty;
        }}
      />
    {:else if selectedItem?.kind === 'new-rule'}
      <RuleEditorPanel
        title="new rule"
        draft={DEFAULT_RULE_DRAFT}
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
          <p>
            Highlights style words and phrases with simple controls.
          </p>
          <p>
            Rules offer full regular expression matching for advanced style and trigger behavior.
          </p>
          <p>
            App triggers apply everywhere. World triggers apply to every character in that world. Character triggers apply only to that character.
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
    color: var(--text-main);
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
