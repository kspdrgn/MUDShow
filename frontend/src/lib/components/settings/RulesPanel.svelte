<script lang="ts">
  import type { Rule } from '../../types';
  import { getWorldRulesPanelId } from '../../world-dom';

  export let open = false;
  export let rules: Rule[] = [];
  export let scope = 'world';
  export let embedded = false;
  export let onOpenModal: (index: number | null) => void;
  export let onDelete: (index: number) => void;
  export let onClose: () => void;
</script>

<div class="rules-panel" id={getWorldRulesPanelId(scope)} class:open={open}>
  <div class="panel-header">
    <div class="panel-header-group">
      <div class="rules-label">rules</div>
      <button
        type="button"
        class="btn panel-tab"
        title="Create a new rule"
        on:click={() => onOpenModal(null)}
      >
        new rule
      </button>
    </div>
    {#if !embedded}
      <button
        type="button"
        class="btn panel-close"
        aria-label="Close rules panel"
        title="Close rules panel"
        on:click={onClose}
      >
        X
      </button>
    {/if}
  </div>
  <div class="rules-note">
    Raw regexp rules are for advanced matching. Open a rule to edit the pattern, test it, and save it.
  </div>
  <div class="rules-list">
    {#if rules.length === 0}
      <div class="rules-empty">no rules yet. create one with the button above.</div>
    {:else}
      {#each rules as rule, index}
        <div
          class="rule-row"
          role="button"
          tabindex="0"
          aria-label={`Edit rule ${index + 1}: ${rule.label || rule.pattern}`}
          on:click={() => onOpenModal(index)}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenModal(index);
            }
          }}
        >
          <div class="rule-row-label">{rule.label || 'untitled'}</div>
          <div class="rule-row-main">
            <div class="rule-pattern">{rule.pattern}</div>
            <div class="rule-meta">
              <span
                class="rule-color"
                style={`background:${rule.foregroundColor ?? 'transparent'};`}
              ></span>
              <span>{rule.caseSensitive ? 'case sensitive' : 'case insensitive'}</span>
            </div>
          </div>
          <div class="rule-row-actions">
            <button type="button" class="btn danger" on:click|stopPropagation={() => onDelete(index)}>del</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
