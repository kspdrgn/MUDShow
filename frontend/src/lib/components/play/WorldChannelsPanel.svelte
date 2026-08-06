<script lang="ts">
  import { onMount } from 'svelte';
  import { type ChannelTabVM } from './channel';

  export let tabs: ChannelTabVM[] = [];
  export let onResizeStart: (height: number) => void = () => {};
  export let onResizeEnd: () => void = () => {};

  const MIN_PANEL_HEIGHT = 80;
  const DEFAULT_PANEL_HEIGHT = 280;
  const PANEL_HEIGHT_RATIO = 0.35;
  const MAX_PANEL_HEIGHT_RATIO = 0.7;

  let panelHeight = DEFAULT_PANEL_HEIGHT;
  let resizing = false;
  let panelElement: HTMLElement | null = null;
  let pendingPanelHeight = DEFAULT_PANEL_HEIGHT;
  let resizeFrame: number | null = null;
  let dragState:
    | {
        pointerId: number;
        startY: number;
        startHeight: number;
      }
    | null = null;

  $: activeTab = tabs.find((tab) => tab.open) ?? null;
  $: open = activeTab !== null;

  function getMaxPanelHeight(): number {
    if (typeof window === 'undefined') {
      return DEFAULT_PANEL_HEIGHT;
    }

    return Math.max(
      MIN_PANEL_HEIGHT,
      Math.floor(window.innerHeight * MAX_PANEL_HEIGHT_RATIO),
    );
  }

  function clampPanelHeight(value: number): number {
    return Math.max(MIN_PANEL_HEIGHT, Math.min(getMaxPanelHeight(), Math.round(value)));
  }

  function syncPanelHeight(): void {
    const preferredHeight = Math.floor(
      typeof window === 'undefined' ? DEFAULT_PANEL_HEIGHT : window.innerHeight * PANEL_HEIGHT_RATIO,
    );
    panelHeight = clampPanelHeight(panelHeight || preferredHeight);
  }

  function startResize(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary || !panelElement || !open) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: panelElement.getBoundingClientRect().height,
    };
    pendingPanelHeight = panelHeight;
    resizing = true;

    onResizeStart(dragState.startHeight);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  function endResize(): void {
    dragState = null;
    resizing = false;
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = null;
    }
    panelHeight = pendingPanelHeight;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    onResizeEnd();
  }

  function flushResizeFrame(): void {
    resizeFrame = null;
    panelHeight = pendingPanelHeight;
  }

  function scheduleResizeFrame(): void {
    if (resizeFrame !== null) {
      return;
    }

    resizeFrame = requestAnimationFrame(flushResizeFrame);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    pendingPanelHeight = clampPanelHeight(dragState.startHeight + (event.clientY - dragState.startY));
    scheduleResizeFrame();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (dragState && event.pointerId !== dragState.pointerId) {
      return;
    }

    endResize();
  }

  onMount(() => {
    syncPanelHeight();

    const handleResize = () => {
      panelHeight = clampPanelHeight(panelHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      endResize();
    };
  });
</script>

<section
  bind:this={panelElement}
  class="world-channels-panel"
  class:open={open}
  class:resizing={resizing}
  aria-hidden={!open}
  aria-label="World channels"
  style:height={`${open ? panelHeight : 0}px`}
  style:opacity={open ? 1 : 0}
  style:transform={`translateY(${open ? 0 : -10}px)`}
>
  <div class="world-channels-panel-shell">
    <div class="world-channels-panel-body">
      {#each tabs as tab (tab.id)}
        {#if tab.panelComponent}
          {@const Panel = tab.panelComponent}
          <svelte:component this={Panel} open={tab.open} {...(tab.panelProps ?? {})} />
        {/if}
      {/each}
    </div>
  </div>

  <button
    type="button"
    class="world-channels-resize-handle"
    aria-label="Resize channels panel"
    title="Resize channels panel"
    on:pointerdown={startResize}
  ></button>
</section>
