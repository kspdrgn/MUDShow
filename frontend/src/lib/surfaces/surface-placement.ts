import type { SurfacePlacement, SurfacePoint, SurfaceSize } from './surface-registry.js';

export interface SavedSurfacePlacement {
  placement: SurfacePlacement;
  position?: SurfacePoint;
  size?: SurfaceSize;
}

const STORAGE_KEY = 'mudshow.surface-placement.v1';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePlacement(value: unknown): SurfacePlacement | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.host === 'native' && typeof candidate.windowId === 'string') {
    return { host: 'native', windowId: candidate.windowId };
  }
  if (candidate.host !== 'dockview' || !['grid', 'edge', 'floating'].includes(String(candidate.mode))) {
    return null;
  }
  const edge = candidate.edge;
  if (candidate.mode === 'edge' && !['top', 'right', 'bottom', 'left'].includes(String(edge))) return null;
  return {
    host: 'dockview',
    mode: candidate.mode as 'grid' | 'edge' | 'floating',
    ...(candidate.groupId ? { groupId: String(candidate.groupId) } : {}),
    ...(candidate.mode === 'edge' ? { edge: edge as 'top' | 'right' | 'bottom' | 'left' } : {}),
  };
}

function parseBounds(value: unknown): SurfacePoint | SurfaceSize | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.x) && !isFiniteNumber(candidate.width)) return undefined;
  return 'x' in candidate && 'y' in candidate && isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y)
    ? { x: candidate.x, y: candidate.y }
    : isFiniteNumber(candidate.width) && isFiniteNumber(candidate.height) && candidate.width > 0 && candidate.height > 0
      ? { width: candidate.width, height: candidate.height }
      : undefined;
}

function readAll(): Record<string, SavedSurfacePlacement> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
      if (!value || typeof value !== 'object') return [];
      const candidate = value as Record<string, unknown>;
      const placement = parsePlacement(candidate.placement);
      if (!placement) return [];
      return [[key, {
        placement,
        position: parseBounds(candidate.position) as SurfacePoint | undefined,
        size: parseBounds(candidate.size) as SurfaceSize | undefined,
      }]];
    }));
  } catch {
    return {};
  }
}

export function loadSurfacePlacement(instanceId: string): SavedSurfacePlacement | null {
  return readAll()[instanceId] ?? null;
}

export function saveSurfacePlacement(instanceId: string, value: SavedSurfacePlacement): void {
  if (typeof localStorage === 'undefined') return;
  const all = readAll();
  all[instanceId] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
