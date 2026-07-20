<script lang="ts">
  import type { CharacterRecord, HighlightDraft, HighlightRule, Rule, RuleDraft, WorldRecord } from '../../types';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import RuleEditorPanel from './RuleEditorPanel.svelte';

  type TreeSelection =
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

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let highlights: HighlightRule[] = [];
  export let rules: Rule[] = [];
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

  $: selectedWorld = contextWorldId ? worlds.find((world) => world.id === contextWorldId) ?? null : null;
  $: selectedCharacter =
    contextCharacterId ? characters.find((character) => character.id === contextCharacterId) ?? null : null;
  $: treeItems = buildTreeItems(highlights, rules, worlds, characters, treeRefreshToken);

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

  const DEFAULT_HIGHLIGHT_DRAFT: HighlightDraft = {
    pattern: '',
    foregroundColor: '#f1c40f',
    backgroundColor: '#000000',
    caseSensitive: false,
    wordBoundary: true,
  };

  const DEFAULT_RULE_DRAFT: RuleDraft = {
    label: '',
    pattern: '',
    foregroundColor: '#f1c40f',
    foregroundColorEnabled: true,
    backgroundColor: '#000000',
    backgroundColorEnabled: true,
    opacity: 1,
    opacityEnabled: true,
    wholeLine: false,
    caseSensitive: false,
    sampleText: 'sample text to test the rule',
  };

  function isSelected(item: TreeItem): boolean {
    if (!selectedItem) {
      return false;
    }

    if (item.kind !== selectedItem.kind) {
      return false;
    }

    if (
      (item.kind === 'highlight' && selectedItem.kind === 'highlight') ||
      (item.kind === 'rule' && selectedItem.kind === 'rule')
    ) {
      return item.index === selectedItem.index;
    }

    return item.kind === 'world' && selectedItem.kind === 'world' && item.world.id === selectedItem.worldId;
  }

  function selectHighlight(index: number): void {
    selectedItem = { kind: 'highlight', index };
  }

  function selectRule(index: number): void {
    selectedItem = { kind: 'rule', index };
  }

  function selectWorld(worldId: string): void {
    selectedItem = { kind: 'world', worldId };
  }

  function selectCharacter(characterId: string): void {
    selectedItem = { kind: 'character', characterId };
  }

  function refreshTree(): void {
    treeRefreshToken += 1;
  }

  function addHighlight(): void {
    selectedItem = { kind: 'new-highlight' };
  }

  function addRule(): void {
    selectedItem = { kind: 'new-rule' };
  }

  function createHighlightDraft(highlight: HighlightRule | null | undefined): HighlightDraft {
    if (!highlight) {
      return DEFAULT_HIGHLIGHT_DRAFT;
    }

    return {
      pattern: highlight.pattern,
      foregroundColor: highlight.foregroundColor,
      backgroundColor: highlight.backgroundColor,
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
      foregroundColor: rule.foregroundColor ?? '#f1c40f',
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

  $: {
    if (pendingSelection?.kind === 'highlight' && highlights[pendingSelection.index] !== undefined) {
      selectedItem = pendingSelection;
      pendingSelection = null;
    } else if (pendingSelection?.kind === 'rule' && rules[pendingSelection.index] !== undefined) {
      selectedItem = pendingSelection;
      pendingSelection = null;
    } else if (selectedItem?.kind === 'highlight' && highlights[selectedItem.index] === undefined) {
      selectedItem = null;
    } else if (selectedItem?.kind === 'rule' && rules[selectedItem.index] === undefined) {
      selectedItem = null;
    } else if (selectedItem?.kind === 'world' && !worlds.some((world) => world.id === selectedItem.worldId)) {
      selectedItem = null;
    } else if (
      selectedItem?.kind === 'character' &&
      !characters.some((character) => character.id === selectedItem.characterId)
    ) {
      selectedItem = null;
    }
  }
</script>

<div class="triggers-pane">
  <aside class="triggers-tree" aria-label="triggers tree">
    <div class="triggers-tree-title">app</div>
    <div class="triggers-tree-scroll">
      <ul class="triggers-tree-list">
        {#each treeItems as item (item.kind === 'world' ? item.world.id : `${item.kind}-${item.index}`)}
          {#if item.kind === 'highlight'}
            <li>
              <button
                type="button"
                class="triggers-tree-item"
                class:active={isSelected(item)}
                on:click={() => selectHighlight(item.index)}
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
                on:click={() => selectRule(item.index)}
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
                on:click={() => selectWorld(item.world.id)}
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
                      class:active={selectedItem?.kind === 'character' && selectedItem.characterId === character.id}
                      on:click={() => selectCharacter(character.id)}
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

  <section class="triggers-editor">
    {#if selectedItem?.kind === 'highlight'}
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
        <div class="triggers-empty-title">nothing selected</div>
        <p>
          Pick a highlight or rule from the tree to edit it here.
        </p>
        <p>
          Highlights style individual rules and phrases with simple controls.
        </p>
        <p>
          Rules offer full regular expression matching for advanced style and behavior.
        </p>
        <p>
          In the future, rules and highlights will be supported within worlds and characters but they are top level for now.
        </p>
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
