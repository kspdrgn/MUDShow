import type { SurfaceId, SurfaceInstanceId } from './surface-transport.js';
import { loadSurfacePlacement, saveSurfacePlacement } from './surface-placement.js';

export type SurfaceKind = 'builtin' | 'plugin';
export type SurfaceDockviewMode = 'grid' | 'edge' | 'floating';
export type SurfaceEdge = 'top' | 'right' | 'bottom' | 'left';

export interface SurfacePoint {
  x: number;
  y: number;
}

export interface SurfaceSize {
  width: number;
  height: number;
}

export type SurfacePlacement =
  | {
      host: 'dockview';
      mode: SurfaceDockviewMode;
      groupId?: string;
      edge?: SurfaceEdge;
    }
  | {
      host: 'native';
      windowId: string;
    };

export interface SurfaceCapabilities {
  canClose: boolean;
  canDock: boolean;
  canFloat: boolean;
  canPopOut: boolean;
  canPopIn: boolean;
  isModal: boolean;
  allowsMultipleInstances: boolean;
}

export interface SurfaceRegistration {
  surfaceId: SurfaceId;
  kind: SurfaceKind;
  rendererId?: string;
  defaultTitle: string;
  capabilities: SurfaceCapabilities;
}

export interface SurfaceInstance {
  instanceId: SurfaceInstanceId;
  surfaceId: SurfaceId;
  title: string;
  placement: SurfacePlacement;
  previousDockedEdge?: SurfaceEdge;
  isActive: boolean;
  position?: SurfacePoint;
  size?: SurfaceSize;
}

export interface SurfaceRegistrySnapshot {
  registrations: readonly SurfaceRegistration[];
  instances: readonly SurfaceInstance[];
}

export type SurfaceRegistryListener = (snapshot: SurfaceRegistrySnapshot) => void;

export interface OpenSurfaceOptions {
  instanceId: SurfaceInstanceId;
  surfaceId: SurfaceId;
  title?: string;
  placement?: SurfacePlacement;
  position?: SurfacePoint;
  size?: SurfaceSize;
  /** Use the supplied placement when reconstructing a host after a reload. */
  preferProvidedPlacement?: boolean;
}

export interface UpdateSurfaceOptions {
  title?: string;
  placement?: SurfacePlacement;
  isActive?: boolean;
  position?: SurfacePoint;
  size?: SurfaceSize;
}

const DEFAULT_DOCKVIEW_PLACEMENT: SurfacePlacement = {
  host: 'dockview',
  mode: 'grid',
};

function cloneSnapshot(
  registrations: Map<SurfaceId, SurfaceRegistration>,
  instances: Map<SurfaceInstanceId, SurfaceInstance>,
): SurfaceRegistrySnapshot {
  return {
    registrations: [...registrations.values()],
    instances: [...instances.values()],
  };
}

export class SurfaceRegistry {
  private readonly registrations = new Map<SurfaceId, SurfaceRegistration>();
  private readonly instances = new Map<SurfaceInstanceId, SurfaceInstance>();
  private readonly listeners = new Set<SurfaceRegistryListener>();

  register(registration: SurfaceRegistration): () => void {
    if (this.registrations.has(registration.surfaceId)) {
      throw new Error(`surface registration already exists: ${registration.surfaceId}`);
    }

    this.registrations.set(registration.surfaceId, registration);
    this.emit();

    return () => this.unregister(registration.surfaceId);
  }

  unregister(surfaceId: SurfaceId): void {
    if (!this.registrations.delete(surfaceId)) {
      return;
    }

    for (const [instanceId, instance] of this.instances) {
      if (instance.surfaceId === surfaceId) {
        this.instances.delete(instanceId);
      }
    }

    this.emit();
  }

  open(options: OpenSurfaceOptions): SurfaceInstance {
    const registration = this.registrations.get(options.surfaceId);
    if (!registration) {
      throw new Error(`surface is not registered: ${options.surfaceId}`);
    }

    if (this.instances.has(options.instanceId)) {
      throw new Error(`surface instance already exists: ${options.instanceId}`);
    }

    if (!registration.capabilities.allowsMultipleInstances
      && [...this.instances.values()].some((instance) => instance.surfaceId === options.surfaceId)) {
      throw new Error(`surface does not allow multiple instances: ${options.surfaceId}`);
    }

    const saved = options.preferProvidedPlacement ? null : loadSurfacePlacement(options.instanceId);
    const placement = saved?.placement ?? options.placement ?? DEFAULT_DOCKVIEW_PLACEMENT;
    const instance: SurfaceInstance = {
      instanceId: options.instanceId,
      surfaceId: options.surfaceId,
      title: options.title ?? registration.defaultTitle,
      placement,
      previousDockedEdge: placement.host === 'dockview'
        && placement.mode === 'edge'
        ? placement.edge
        : undefined,
      isActive: false,
      position: saved?.position ?? options.position,
      size: saved?.size ?? options.size,
    };

    this.instances.set(instance.instanceId, instance);
    saveSurfacePlacement(instance.instanceId, {
      placement: instance.placement,
      position: instance.position,
      size: instance.size,
    });
    this.emit();
    return instance;
  }

  update(instanceId: SurfaceInstanceId, options: UpdateSurfaceOptions): SurfaceInstance | null {
    const current = this.instances.get(instanceId);
    if (!current) {
      return null;
    }

    const next: SurfaceInstance = {
      ...current,
      ...options,
    };

    if (options.placement?.host === 'dockview' && options.placement.mode === 'edge') {
      next.previousDockedEdge = options.placement.edge;
    }

    this.instances.set(instanceId, next);
    saveSurfacePlacement(instanceId, {
      placement: next.placement,
      position: next.position,
      size: next.size,
    });
    this.emit();
    return next;
  }

  close(instanceId: SurfaceInstanceId): boolean {
    const removed = this.instances.delete(instanceId);
    if (removed) {
      this.emit();
    }

    return removed;
  }

  getRegistration(surfaceId: SurfaceId): SurfaceRegistration | null {
    return this.registrations.get(surfaceId) ?? null;
  }

  getInstance(instanceId: SurfaceInstanceId): SurfaceInstance | null {
    return this.instances.get(instanceId) ?? null;
  }

  getSnapshot(): SurfaceRegistrySnapshot {
    return cloneSnapshot(this.registrations, this.instances);
  }

  subscribe(listener: SurfaceRegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.registrations.clear();
    this.instances.clear();
    this.listeners.clear();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function createSurfaceRegistry(): SurfaceRegistry {
  return new SurfaceRegistry();
}
