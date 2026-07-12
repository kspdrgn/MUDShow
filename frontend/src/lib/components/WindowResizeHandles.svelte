<script lang="ts">
  import { invoke, isTauriAvailable } from '../tauri';
  import { isLinuxDesktop } from '../platform';

  type ResizeDirection =
    | 'east'
    | 'north'
    | 'northeast'
    | 'northwest'
    | 'south'
    | 'southeast'
    | 'southwest'
    | 'west';

  type ResizeHandle = {
    direction: ResizeDirection;
    className: string;
    title: string;
  };

  const RESIZE_HANDLES: ResizeHandle[] = [
    { direction: 'northwest', className: 'resize-handle northwest', title: 'resize window from the top left corner' },
    { direction: 'north', className: 'resize-handle north', title: 'resize window from the top edge' },
    { direction: 'northeast', className: 'resize-handle northeast', title: 'resize window from the top right corner' },
    { direction: 'west', className: 'resize-handle west', title: 'resize window from the left edge' },
    { direction: 'east', className: 'resize-handle east', title: 'resize window from the right edge' },
    { direction: 'southwest', className: 'resize-handle southwest', title: 'resize window from the bottom left corner' },
    { direction: 'south', className: 'resize-handle south', title: 'resize window from the bottom edge' },
    { direction: 'southeast', className: 'resize-handle southeast', title: 'resize window from the bottom right corner' },
  ];

  const enabled = isTauriAvailable() && isLinuxDesktop();

  async function startResize(event: PointerEvent, direction: ResizeDirection): Promise<void> {
    if (!enabled || event.button !== 0 || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      await invoke('window_start_resize_dragging', { direction });
    } catch (error) {
      console.error('failed to start window resize drag', error);
    }
  }
</script>

{#if enabled}
  <div class="window-resize-overlay" aria-hidden="true">
    {#each RESIZE_HANDLES as handle}
      <button
        type="button"
        class={handle.className}
        title={handle.title}
        tabindex="-1"
        aria-label={handle.title}
        on:pointerdown={(event) => startResize(event, handle.direction)}
      ></button>
    {/each}
  </div>
{/if}

<style>
  .window-resize-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    pointer-events: none;
  }

  .resize-handle {
    position: absolute;
    display: block;
    border: 0;
    background: transparent;
    pointer-events: auto;
    opacity: 0;
    -webkit-app-region: no-drag;
    outline: none;
    appearance: none;
    transition:
      opacity 0.12s ease,
      background-color 0.12s ease;
  }

  .resize-handle:hover,
  .resize-handle:active {
    opacity: 1;
    background: rgba(74, 158, 255, 0.08);
  }

  .north,
  .south {
    left: 14px;
    right: 14px;
    height: 12px;
  }

  .west,
  .east {
    top: 14px;
    bottom: 14px;
    width: 12px;
  }

  .north {
    top: 0;
    cursor: n-resize;
  }

  .south {
    bottom: 0;
    cursor: s-resize;
  }

  .west {
    left: 0;
    cursor: w-resize;
  }

  .east {
    right: 0;
    cursor: e-resize;
  }

  .northwest,
  .northeast,
  .southwest,
  .southeast {
    width: 18px;
    height: 18px;
  }

  .northwest {
    top: 0;
    left: 0;
    cursor: nw-resize;
  }

  .northeast {
    top: 0;
    right: 0;
    cursor: ne-resize;
  }

  .southwest {
    bottom: 0;
    left: 0;
    cursor: sw-resize;
  }

  .southeast {
    right: 0;
    bottom: 0;
    cursor: se-resize;
  }
</style>
