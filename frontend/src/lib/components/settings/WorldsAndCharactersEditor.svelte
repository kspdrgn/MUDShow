<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { CharacterRecord, WorldRecord } from '../../types';

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onOpenWorld: (index: number | null) => void;
  export let onEditWorld: (index: number) => void;
  export let onDeleteWorld: (index: number) => void;
  export let onOpenCharacter: (worldId: string, index: number | null) => void;
  export let onEditCharacter: (index: number) => void;
  export let onDeleteCharacter: (index: number) => void;
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenSettings: () => void;

  type DeleteTarget =
    | { kind: 'world'; index: number; worldName: string }
    | { kind: 'character'; index: number; characterName: string };
  type MenuTarget =
    | { kind: 'world'; index: number; world: WorldRecord }
    | { kind: 'character'; index: number; character: CharacterRecord };

  let pendingDelete: DeleteTarget | null = null;
  let menuTarget: MenuTarget | null = null;
  let menuElement: HTMLDivElement | null = null;
  let menuPosition = { x: 0, y: 0 };
  let renderedMenuPosition = menuPosition;
  let repositionToken = 0;

  function openContextMenu(target: MenuTarget, position: { x: number; y: number }): void {
    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'characters-editor' } }));
    menuTarget = target;
    menuPosition = position;
    renderedMenuPosition = position;
  }

  function openContextMenuFromButton(event: MouseEvent, target: MenuTarget): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(target, {
      x: rect.right - 180,
      y: rect.bottom + 6,
    });
  }

  function openContextMenuFromRow(event: MouseEvent, target: MenuTarget): void {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu(target, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function closeContextMenu(): void {
    menuTarget = null;
  }

  function handleMenuAction(action: () => void): void {
    action();
    closeContextMenu();
  }

  function requestDeleteWorld(index: number): void {
    const world = worlds[index];
    if (!world) {
      return;
    }

    pendingDelete = {
      kind: 'world',
      index,
      worldName: world.name,
    };
  }

  function requestDeleteCharacter(index: number): void {
    const character = characters[index];
    if (!character) {
      return;
    }

    pendingDelete = {
      kind: 'character',
      index,
      characterName: character.name,
    };
  }

  function closeDeleteConfirm(): void {
    pendingDelete = null;
  }

  function confirmDelete(): void {
    if (!pendingDelete) {
      return;
    }

    const target = pendingDelete;
    pendingDelete = null;

    if (target.kind === 'world') {
      onDeleteWorld(target.index);
    } else {
      onDeleteCharacter(target.index);
    }
  }

  function handleDeleteOverlayKeyDown(event: KeyboardEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeDeleteConfirm();
    }
  }

  onMount(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!menuTarget) {
        return;
      }

      if (event.target instanceof Node && menuElement?.contains(event.target)) {
        return;
      }

      closeContextMenu();
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (!menuTarget) {
        return;
      }

      if (event.target instanceof Node && menuElement?.contains(event.target)) {
        return;
      }

      closeContextMenu();
    };

    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { source?: string } : null;
      if (!menuTarget || detail?.source === 'characters-editor') {
        return;
      }

      closeContextMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuTarget) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
      window.removeEventListener('keydown', handleEscape);
    };
  });

  $: if (menuTarget) {
    renderedMenuPosition = menuPosition;
    const token = ++repositionToken;

    void tick().then(() => {
      if (!menuTarget || token !== repositionToken || !menuElement) {
        return;
      }

      const margin = 8;
      const rect = menuElement.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - margin;
      const maxY = window.innerHeight - rect.height - margin;

      renderedMenuPosition = {
        x: Math.max(margin, Math.min(menuPosition.x, maxX)),
        y: Math.max(margin, Math.min(menuPosition.y, maxY)),
      };
    });
  } else {
    repositionToken += 1;
  }
</script>

<div id="screen-list">
  <h1>worlds and characters</h1>

  {#if worlds.length === 0}
    <div id="empty-state">no worlds yet - add one below</div>
  {/if}

  <div id="char-list">
    {#each worlds as world, worldIndex}
      {@const worldCharacters = characters.filter((character) => character.worldId === world.id)}
      <div
        class="char-row"
        role="group"
        aria-label={`${world.name} row`}
        on:contextmenu={(event) => openContextMenuFromRow(event, { kind: 'world', index: worldIndex, world })}
      >
        <div>
          <div class="char-name">{world.name}</div>
          <div class="char-host">{world.host}:{world.port}</div>
        </div>
        <div class="char-actions">
          <button
            class="btn primary"
            on:click|stopPropagation={() => onConnectWorld(world.id)}
          >
            connect
          </button>
          <button
            class="btn char-menu-button"
            aria-label={`open actions for ${world.name}`}
            title="More actions"
            on:click={(event) => openContextMenuFromButton(event, { kind: 'world', index: worldIndex, world })}
          >
            ...
          </button>
        </div>
      </div>

      {#if worldCharacters.length === 0}
        <div class="char-row empty-character-row" style="margin-left: 1rem;">
          <div class="empty-character-actions">
            <button class="btn primary" on:click|stopPropagation={() => onOpenCharacter(world.id, null)}>
              + add a character
            </button>
          </div>
        </div>
      {/if}

      {#each worldCharacters as character}
        {@const characterIndex = characters.indexOf(character)}
        <div
          class="char-row"
          role="group"
          aria-label={`${character.name} row`}
          style="margin-left: 1rem;"
          on:contextmenu={(event) => openContextMenuFromRow(event, { kind: 'character', index: characterIndex, character })}
        >
          <div>
            <div class="char-name">{character.name}</div>
            <div class="char-host">
              {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
            </div>
          </div>
          <div class="char-actions">
            <button class="btn primary" on:click|stopPropagation={() => onConnectCharacter(characterIndex)}>connect</button>
            <button
              class="btn char-menu-button"
              aria-label={`open actions for ${character.name}`}
              title="More actions"
              on:click={(event) => openContextMenuFromButton(event, { kind: 'character', index: characterIndex, character })}
            >
              ...
            </button>
          </div>
        </div>
      {/each}
    {/each}
  </div>

  <div id="list-footer">
    <button class="btn primary" on:click={() => onOpenWorld(null)}>+ add world</button>
    <button type="button" class="btn" on:click={onOpenSettings}>
      ⚙ open app settings
    </button>
  </div>
</div>

{#if menuTarget}
  <div
    bind:this={menuElement}
    class="titlebar-dropdown titlebar-context-menu characters-context-menu"
    role="menu"
    tabindex="-1"
    aria-label={`${menuTarget.kind === 'world' ? menuTarget.world.name : menuTarget.character.name} actions`}
    style={`left: ${renderedMenuPosition.x}px; top: ${renderedMenuPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    }}
  >
    {#if menuTarget.kind === 'world'}
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onConnectWorld(menuTarget.world.id))}
      >
        connect
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onEditWorld(menuTarget.index))}
      >
        edit world
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onOpenCharacter(menuTarget.world.id, null))}
      >
        new character
      </button>
      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item danger"
        role="menuitem"
        on:click={() => handleMenuAction(() => requestDeleteWorld(menuTarget.index))}
      >
        delete world
      </button>
    {:else}
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onConnectCharacter(menuTarget.index))}
      >
        connect
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onEditCharacter(menuTarget.index))}
      >
        edit character
      </button>
      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item danger"
        role="menuitem"
        on:click={() => handleMenuAction(() => requestDeleteCharacter(menuTarget.index))}
      >
        delete character
      </button>
    {/if}
  </div>
{/if}

{#if pendingDelete}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close delete confirmation"
    on:pointerdown|self={closeDeleteConfirm}
    on:keydown={handleDeleteOverlayKeyDown}
  >
    <div id="modal">
      <h2>
        {#if pendingDelete.kind === 'world'}
          delete {pendingDelete.worldName}?
        {:else}
          confirm delete
        {/if}
      </h2>
      {#if pendingDelete.kind === 'world'}
        {@const world = worlds[pendingDelete.index] ?? null}
        {#if world}
          <p class="settings-note">
            {world.host}:{world.port}
          </p>
        {/if}
        <p class="settings-note">Deleting a world will remove all saved characters!</p>
        <p class="settings-note">
          Deleting a character will remove all saved notes, highlights, and stored history.
        </p>
      {:else}
        <p class="settings-note">
          Deleting a character will remove all saved notes, highlights, and stored history.
        </p>
      {/if}
      <div class="modal-actions">
        <button class="btn" type="button" on:click={closeDeleteConfirm}>cancel</button>
        <button class="btn danger" type="button" on:click={confirmDelete}>delete</button>
      </div>
    </div>
  </div>
{/if}
