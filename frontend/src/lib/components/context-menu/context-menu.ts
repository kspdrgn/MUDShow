export type MenuPoint = { x: number; y: number };
export type MenuSize = { width: number; height: number };
export type MenuViewport = { width: number; height: number };

export function clampMenuPosition(
  position: MenuPoint,
  menuSize: MenuSize,
  viewport: MenuViewport,
  margin = 8,
): MenuPoint {
  const maxX = viewport.width - menuSize.width - margin;
  const maxY = viewport.height - menuSize.height - margin;

  return {
    x: Math.max(margin, Math.min(position.x, maxX)),
    y: Math.max(margin, Math.min(position.y, maxY)),
  };
}

export function positionSubmenu(
  anchorRect: DOMRect,
  menuSize: MenuSize,
  viewport: MenuViewport,
  margin = 8,
  gap = 8,
): { position: MenuPoint; side: 'left' | 'right' } {
  const preferRight = anchorRect.right + gap + menuSize.width <= viewport.width - margin;
  const rawX = preferRight
    ? anchorRect.right + gap
    : anchorRect.left - gap - menuSize.width;

  return {
    side: preferRight ? 'right' : 'left',
    position: clampMenuPosition(
      {
        x: rawX,
        y: anchorRect.top,
      },
      menuSize,
      viewport,
      margin,
    ),
  };
}

export function createDelayedCloseController(onClose: () => void, delayMs = 160): {
  scheduleClose: () => void;
  clear: () => void;
  dispose: () => void;
} {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  function clear(): void {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  }

  function scheduleClose(): void {
    clear();
    timeout = setTimeout(() => {
      timeout = null;
      onClose();
    }, delayMs);
  }

  return {
    scheduleClose,
    clear,
    dispose: clear,
  };
}
