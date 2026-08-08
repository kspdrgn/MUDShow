<script lang="ts">
  import { onMount } from 'svelte';
  import WindowShell from './WindowShell.svelte';
  import type { WindowPoint, WindowRecord, WindowViewport } from './window-host';

  export let open = false;
  export let windows: WindowRecord[] = [];
  export let appBounds: WindowViewport | null = null;
  export let onClose: (id: string) => void;
  export let onPopOut: (id: string) => void = () => {};
  export let onMove: (id: string, position: WindowPoint) => void = () => {};
  export let onActivate: (id: string) => void = () => {};

  function closeTopmostWindow(): void {
    const topmost = windows[windows.length - 1];
    if (topmost?.canEscapeDismiss) {
      onClose(topmost.id);
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    const topmost = windows[windows.length - 1];
    if (topmost?.isModal && topmost.canBackdropDismiss) {
      onClose(topmost.id);
    }
  }

  function handleBackdropKeyDown(event: KeyboardEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBackdropClick(event as unknown as MouseEvent);
    }
  }

  onMount(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!open || event.key !== 'Escape') {
        return;
      }

      closeTopmostWindow();
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  });
</script>

{#if open && windows.length > 0}
  <div class="window-host-root" aria-live="polite">
    {#if windows.some((window) => window.isModal)}
      <div
        class="window-host-backdrop"
        role="button"
        tabindex="0"
        aria-label="close window backdrop"
        on:click={handleBackdropClick}
        on:keydown={handleBackdropKeyDown}
      ></div>
    {/if}

    <div class="window-host-stack">
      {#each windows as windowRecord, index (windowRecord.id)}
        <WindowShell
          windowRecord={windowRecord}
          {appBounds}
          zIndex={200 + index}
          onClose={onClose}
          onPopOut={onPopOut}
          onMove={onMove}
          onActivate={onActivate}
        >
          <slot windowRecord={windowRecord} />
        </WindowShell>
      {/each}
    </div>
  </div>
{/if}
