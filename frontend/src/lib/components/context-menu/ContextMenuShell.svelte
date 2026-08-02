<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { clampMenuPosition } from './context-menu';

  export let open = false;
  export let position = { x: 0, y: 0 };
  export let ariaLabel = 'context menu';
  export let source = 'context-menu';
  export let className = '';
  export let side: 'left' | 'right' | null = null;
  export let onDismiss: () => void;

  let menuElement: HTMLDivElement | null = null;
  let renderedPosition = position;
  let repositionToken = 0;

  function updateRenderedPosition(): void {
    if (!open || !menuElement) {
      return;
    }

    const rect = menuElement.getBoundingClientRect();
    renderedPosition = clampMenuPosition(
      position,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
  }

  function dismissMenu(): void {
    onDismiss();
  }

  onMount(() => {
    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { source?: string }) : null;
      if (!open || detail?.source === source) {
        return;
      }

      dismissMenu();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        dismissMenu();
        return;
      }

      if (menuElement?.contains(event.target)) {
        return;
      }

      dismissMenu();
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        dismissMenu();
        return;
      }

      if (menuElement?.contains(event.target)) {
        return;
      }

      dismissMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        dismissMenu();
      }
    };

    const handleResize = () => {
      if (!open) {
        return;
      }

      updateRenderedPosition();
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
    };
  });

  $: if (open) {
    renderedPosition = position;
    const token = ++repositionToken;

    void tick().then(() => {
      if (!open || token !== repositionToken) {
        return;
      }

      updateRenderedPosition();
    });
  } else {
    repositionToken += 1;
    renderedPosition = position;
  }
</script>

{#if open}
  <div
    bind:this={menuElement}
    class={`titlebar-dropdown ${className}`}
    role="menu"
    tabindex="-1"
    aria-label={ariaLabel}
    data-side={side ?? undefined}
    style={`position: fixed; right: auto; left: ${renderedPosition.x}px; top: ${renderedPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        dismissMenu();
      }
    }}
  >
    <slot />
  </div>
{/if}
