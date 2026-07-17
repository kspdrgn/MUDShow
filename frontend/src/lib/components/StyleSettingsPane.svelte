<script context="module" lang="ts">
  export type StyleScope =
    | { kind: 'app' }
    | { kind: 'world'; worldId: string }
    | { kind: 'character'; worldId: string; characterId: string };
</script>

<script lang="ts">
  export let scope: StyleScope;

  function getScopeTitle(value: StyleScope): string {
    switch (value.kind) {
      case 'app':
        return 'app default style';
      case 'world':
        return `world style: ${value.worldId}`;
      case 'character':
        return `character style: ${value.worldId} / ${value.characterId}`;
    }
  }

  function getScopeSummary(value: StyleScope): string {
    switch (value.kind) {
      case 'app':
        return 'controls the shared defaults used by every world and character.';
      case 'world':
        return 'controls the style shared by a single world and its characters.';
      case 'character':
        return 'controls the style override for one character in one world.';
    }
  }
</script>

<section class="style-settings" aria-label={getScopeTitle(scope)}>
  <header class="style-settings-header">
    <div>
      <h2>{getScopeTitle(scope)}</h2>
      <p>{getScopeSummary(scope)}</p>
    </div>
    <div class="style-scope-pill">{scope.kind}</div>
  </header>

  <div class="style-settings-grid">
    <section class="style-card">
      <h3>output</h3>
      <p class="style-card-note">shared output style controls will be added here.</p>
      <div class="style-skeleton-lines" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </section>

    <section class="style-card">
      <h3>input</h3>
      <p class="style-card-note">shared input style controls will be added here.</p>
      <div class="style-skeleton-lines" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </section>

    <section class="style-card style-preview-card">
      <h3>preview</h3>
      <p class="style-card-note">
        this area will preview the currently active style chain for the selected scope.
      </p>
      <div class="style-preview">
        <div class="style-preview-output">example output</div>
        <div class="style-preview-input">example input</div>
      </div>
    </section>
  </div>
</section>

<style>
  .style-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .style-settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .style-settings-header h2 {
    font-family: var(--font-ui);
    font-size: 0.78rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-bright);
  }

  .style-settings-header p {
    margin-top: 0.35rem;
    max-width: 42rem;
    color: var(--text-bright);
  }

  .style-scope-pill {
    flex: 0 0 auto;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .style-settings-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.85rem;
  }

  .style-card {
    border: 1px solid var(--border);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
      rgba(10, 10, 10, 0.88);
    padding: 1rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 11rem;
  }

  .style-preview-card {
    justify-content: space-between;
  }

  .style-card h3 {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .style-card-note {
    color: var(--text-dim);
    font-size: 0.84rem;
    line-height: 1.35;
  }

  .style-skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-top: auto;
  }

  .style-skeleton-lines span {
    height: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
  }

  .style-preview {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-top: auto;
  }

  .style-preview-output,
  .style-preview-input {
    min-height: 2.35rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-bright);
    font-size: 0.82rem;
    line-height: 1.3;
  }

  @media (max-width: 640px) {
    .style-settings-header {
      flex-direction: column;
    }

    .style-settings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
