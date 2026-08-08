<script lang="ts">
  import { clampWindowPosition, type WindowPoint, type WindowRecord, type WindowViewport } from './window-host';

  export let windowRecord: WindowRecord;
  export let appBounds: WindowViewport | null = null;
  export let zIndex = 200;
  export let onClose: (id: string) => void;
  export let onPopOut: (id: string) => void = () => {};
  export let onMove: (id: string, position: WindowPoint) => void = () => {};
  export let onActivate: (id: string) => void = () => {};

  let renderedPosition: WindowPoint = windowRecord.position;
  let dragState:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        captureElement: HTMLElement;
      }
    | null = null;

  $: viewport = appBounds ?? {
    width: typeof window !== 'undefined' ? window.innerWidth : windowRecord.size.width,
    height: typeof window !== 'undefined' ? window.innerHeight : windowRecord.size.height,
  };

  function clampPosition(position: WindowPoint): WindowPoint {
    if (windowRecord.placement === 'in-app' && !windowRecord.canMoveInApp) {
      return windowRecord.position;
    }

    return windowRecord.placement === 'in-app'
      ? clampWindowPosition(position, windowRecord.size, viewport)
      : position;
  }

  $: renderedPosition = clampPosition(windowRecord.position);

  function beginDrag(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    if (windowRecord.placement === 'in-app' && !windowRecord.canMoveInApp) {
      return;
    }

    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    onActivate(windowRecord.id);

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: renderedPosition.x,
      originY: renderedPosition.y,
      captureElement: event.currentTarget,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampPosition({
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    });

    renderedPosition = nextPosition;
    onMove(windowRecord.id, nextPosition);
  }

  function finishDrag(event: PointerEvent, commit = true): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.captureElement.hasPointerCapture(event.pointerId)) {
      dragState.captureElement.releasePointerCapture(event.pointerId);
    }

    if (!commit) {
      onMove(windowRecord.id, windowRecord.position);
      renderedPosition = clampPosition(windowRecord.position);
    }

    dragState = null;
  }
</script>

<div
  class="window-shell"
  class:movable={windowRecord.placement === 'window' || windowRecord.canMoveInApp}
  class:windowed={windowRecord.placement === 'window'}
  role="dialog"
  tabindex="-1"
  aria-modal={windowRecord.isModal ? 'true' : 'false'}
  aria-label={windowRecord.title}
  style={`left: ${renderedPosition.x}px; top: ${renderedPosition.y}px; width: ${windowRecord.size.width}px; min-height: ${windowRecord.size.height}px; z-index: ${zIndex};`}
  on:pointerdown={() => onActivate(windowRecord.id)}
  on:pointermove={moveDrag}
  on:pointerup={(event) => finishDrag(event)}
  on:pointercancel={(event) => finishDrag(event, false)}
>
  <div
    class="window-titlebar"
    class:locked={!windowRecord.canMoveInApp && windowRecord.placement === 'in-app'}
    role="group"
    aria-label={`${windowRecord.title} title bar`}
    on:pointerdown={beginDrag}
  >
    <div class="window-title">{windowRecord.title}</div>
    <div class="window-titlebar-actions">
      {#if windowRecord.canPopOut && windowRecord.placement === 'in-app'}
        <button
          type="button"
          class="window-pop-out"
          aria-label={`pop out ${windowRecord.title}`}
          title={`pop out ${windowRecord.title}`}
          on:pointerdown|stopPropagation
          on:click={() => onPopOut(windowRecord.id)}
        >
          ↗
        </button>
      {/if}
      <button
        type="button"
        class="window-close"
        aria-label={`close ${windowRecord.title}`}
        title={`close ${windowRecord.title}`}
        on:pointerdown|stopPropagation
        on:click={() => onClose(windowRecord.id)}
      >
        ×
      </button>
    </div>
  </div>

  <div class="window-body">
    <slot />
  </div>
</div>
