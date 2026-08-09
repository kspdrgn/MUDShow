export type WindowHostKind = 'builtin' | 'plugin';
export type WindowHostPlacement = 'in-app' | 'window';

export interface WindowPoint {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowViewport {
  width: number;
  height: number;
}

export interface WindowRecord {
  id: string;
  kind: WindowHostKind;
  surfaceId: string;
  title: string;
  isModal: boolean;
  sizeToContent: boolean;
  placement: WindowHostPlacement;
  position: WindowPoint;
  size: WindowSize;
  canBackdropDismiss: boolean;
  canEscapeDismiss: boolean;
  canPopOut: boolean;
  canMoveInApp: boolean;
}

export const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 640,
  height: 420,
};

export function clampWindowPosition(
  position: WindowPoint,
  size: WindowSize,
  viewport: WindowViewport,
  margin = 24,
): WindowPoint {
  const maxX = viewport.width - size.width - margin;
  const maxY = viewport.height - size.height - margin;

  return {
    x: Math.max(margin, Math.min(position.x, maxX)),
    y: Math.max(margin, Math.min(position.y, maxY)),
  };
}

export function createWindowRecord(
  windowRecord: Partial<WindowRecord> & Pick<WindowRecord, 'id' | 'surfaceId' | 'title'>,
): WindowRecord {
  return {
    id: windowRecord.id,
    kind: windowRecord.kind ?? 'builtin',
    surfaceId: windowRecord.surfaceId,
    title: windowRecord.title,
    isModal: windowRecord.isModal ?? false,
    sizeToContent: windowRecord.sizeToContent ?? false,
    placement: windowRecord.placement ?? 'in-app',
    position: windowRecord.position ?? { x: 120, y: 120 },
    size: windowRecord.size ?? DEFAULT_WINDOW_SIZE,
    canBackdropDismiss: windowRecord.canBackdropDismiss ?? true,
    canEscapeDismiss: windowRecord.canEscapeDismiss ?? true,
    canPopOut: windowRecord.canPopOut ?? false,
    canMoveInApp: windowRecord.canMoveInApp ?? false,
  };
}
