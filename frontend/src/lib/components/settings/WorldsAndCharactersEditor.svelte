<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { appServices } from '../../app-services';
  import type { CharacterRecord, WorldRecord } from '../../types';
  import {
    buildWorldRows,
    clampMenuPosition,
    createCharacterDeleteTarget,
    createWorldDeleteTarget,
    type DeleteTarget,
    type MenuTarget,
    type WorldRowModel,
  } from './worlds-and-characters-editor';

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

  let pendingDelete: DeleteTarget | null = null;
  let menuTarget: MenuTarget | null = null;
  let menuElement: HTMLDivElement | null = null;
  let menuPosition = { x: 0, y: 0 };
  let renderedMenuPosition = menuPosition;
  let repositionToken = 0;
  let worldRows: WorldRowModel[] = [];

  $: worldRows = buildWorldRows(worlds, characters);

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

  async function requestDeleteWorld(index: number): Promise<void> {
    const target = createWorldDeleteTarget(index, worlds[index]);
    pendingDelete = target;
    const confirmed = await appServices.notice.confirm({
      surfaceId: 'delete-confirm',
      title: `delete ${target?.kind === 'world' ? target.worldName : 'world'}?`,
      message: 'Deleting a world will remove all saved characters!',
      confirmLabel: 'delete',
      cancelLabel: 'cancel',
    });
    pendingDelete = null;

    if (confirmed && target && target.kind === 'world') {
      onDeleteWorld(target.index);
    }
  }

  async function requestDeleteCharacter(index: number): Promise<void> {
    const target = createCharacterDeleteTarget(index, characters[index]);
    pendingDelete = target;
    const confirmed = await appServices.notice.confirm({
      surfaceId: 'delete-confirm',
      title: `delete ${target?.kind === 'character' ? target.characterName : 'character'}?`,
      message: 'Deleting a character will remove all saved notes, highlights, and stored history.',
      confirmLabel: 'delete',
      cancelLabel: 'cancel',
    });
    pendingDelete = null;

    if (confirmed && target && target.kind === 'character') {
      onDeleteCharacter(target.index);
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

      renderedMenuPosition = clampMenuPosition(
        menuPosition,
        menuElement,
        { width: window.innerWidth, height: window.innerHeight },
      );
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
    {#each worldRows as row (row.world.id)}
      {@const world = row.world}
      {@const worldCharacters = row.characters}
      <div
        class="char-row"
        role="group"
        aria-label={`${world.name} row`}
        on:contextmenu={(event) => openContextMenuFromRow(event, { kind: 'world', index: row.worldIndex, world })}
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
            on:click={(event) => openContextMenuFromButton(event, { kind: 'world', index: row.worldIndex, world })}
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

      {#each worldCharacters as rowCharacter (rowCharacter.character.id)}
        {@const character = rowCharacter.character}
        <div
          class="char-row"
          role="group"
          aria-label={`${character.name} row`}
          style="margin-left: 1rem;"
          on:contextmenu={(event) => openContextMenuFromRow(event, { kind: 'character', index: rowCharacter.characterIndex, character })}
        >
          <div>
            <div class="char-name">{character.name}</div>
            <div class="char-host">
              {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
            </div>
          </div>
          <div class="char-actions">
            <button class="btn primary" on:click|stopPropagation={() => onConnectCharacter(rowCharacter.characterIndex)}>connect</button>
            <button
              class="btn char-menu-button"
              aria-label={`open actions for ${character.name}`}
              title="More actions"
              on:click={(event) => openContextMenuFromButton(event, { kind: 'character', index: rowCharacter.characterIndex, character })}
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
      ⚙️ open app settings
    </button>
  </div>
</div>

{#if menuTarget}
  {@const target = menuTarget}
  <div
    bind:this={menuElement}
    class="titlebar-dropdown titlebar-context-menu characters-context-menu"
    role="menu"
    tabindex="-1"
    aria-label={`${target.kind === 'world' ? target.world.name : target.character.name} actions`}
    style={`left: ${renderedMenuPosition.x}px; top: ${renderedMenuPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    }}
  >
    {#if target.kind === 'world'}
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onConnectWorld(target.world.id))}
      >
        connect
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onEditWorld(target.index))}
      >
        edit world
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onOpenCharacter(target.world.id, null))}
      >
        new character
      </button>
      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item danger"
        role="menuitem"
        on:click={() => handleMenuAction(() => requestDeleteWorld(target.index))}
      >
        delete world
      </button>
    {:else}
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onConnectCharacter(target.index))}
      >
        connect
      </button>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleMenuAction(() => onEditCharacter(target.index))}
      >
        edit character
      </button>
      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item danger"
        role="menuitem"
        on:click={() => handleMenuAction(() => requestDeleteCharacter(target.index))}
      >
        delete character
      </button>
    {/if}
  </div>
{/if}
