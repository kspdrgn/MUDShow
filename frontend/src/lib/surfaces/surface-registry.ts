import type {
  WorldSurfaceCapabilities,
  WorldSurfaceDescriptor,
  WorldSurfacePlacement,
} from '../world-surface-protocol.js';

export interface SurfaceInstanceRecord {
  instanceId: string;
  descriptor: WorldSurfaceDescriptor;
  placement: WorldSurfacePlacement;
  previousDockedEdge?: 'top' | 'right' | 'bottom' | 'left';
  active: boolean;
}

export interface SurfaceRegistrySnapshot {
  registrations: readonly WorldSurfaceDescriptor[];
  instances: readonly SurfaceInstanceRecord[];
}

export type SurfaceRegistryListener = (snapshot: SurfaceRegistrySnapshot) => void;

const DEFAULT_CAPABILITIES: WorldSurfaceCapabilities = {
  canClose: true,
  canDock: true,
  canFloat: true,
  canPopOut: false,
  canPopIn: false,
  allowsMultipleInstances: false,
};

const DEFAULT_PLACEMENT: WorldSurfacePlacement = { host: 'dockview', mode: 'edge', edge: 'top' };

function clonePlacement(placement: WorldSurfacePlacement): WorldSurfacePlacement {
  return { ...placement };
}

export class SurfaceRegistry {
  private readonly registrations = new Map<string, WorldSurfaceDescriptor>();
  private readonly instances = new Map<string, SurfaceInstanceRecord>();
  private readonly listeners = new Set<SurfaceRegistryListener>();

  register(descriptor: WorldSurfaceDescriptor): () => void {
    if (this.registrations.has(descriptor.surfaceId)) {
      throw new Error(`surface registration already exists: ${descriptor.surfaceId}`);
    }
    this.registrations.set(descriptor.surfaceId, {
      ...descriptor,
      capabilities: { ...DEFAULT_CAPABILITIES, ...descriptor.capabilities },
    });
    this.emit();
    return () => this.unregister(descriptor.surfaceId);
  }

  unregister(surfaceId: string): void {
    if (!this.registrations.delete(surfaceId)) {
      return;
    }
    for (const [instanceId, instance] of this.instances) {
      if (instance.descriptor.surfaceId === surfaceId) {
        this.instances.delete(instanceId);
      }
    }
    this.emit();
  }

  open(instanceId: string, surfaceId: string, placement: WorldSurfacePlacement = DEFAULT_PLACEMENT): SurfaceInstanceRecord {
    const descriptor = this.registrations.get(surfaceId);
    if (!descriptor) {
      throw new Error(`surface is not registered: ${surfaceId}`);
    }
    if (this.instances.has(instanceId)) {
      throw new Error(`surface instance already exists: ${instanceId}`);
    }
    if (!descriptor.capabilities.allowsMultipleInstances && [...this.instances.values()].some((item) => item.descriptor.surfaceId === surfaceId)) {
      throw new Error(`surface does not allow multiple instances: ${surfaceId}`);
    }

    const instance: SurfaceInstanceRecord = {
      instanceId,
      descriptor,
      placement: clonePlacement(placement),
      previousDockedEdge: placement.host === 'dockview' && placement.mode === 'edge' ? placement.edge : undefined,
      active: true,
    };
    this.instances.set(instanceId, instance);
    this.emit();
    return instance;
  }

  updatePlacement(instanceId: string, placement: WorldSurfacePlacement): SurfaceInstanceRecord | null {
    const current = this.instances.get(instanceId);
    if (!current) {
      return null;
    }
    const next: SurfaceInstanceRecord = { ...current, placement: clonePlacement(placement) };
    if (placement.host === 'dockview' && placement.mode === 'edge') {
      next.previousDockedEdge = placement.edge;
    }
    this.instances.set(instanceId, next);
    this.emit();
    return next;
  }

  restoreDocked(instanceId: string, mode: 'grid' | 'edge' = 'edge'): SurfaceInstanceRecord | null {
    const current = this.instances.get(instanceId);
    if (!current) {
      return null;
    }

    const placement: WorldSurfacePlacement = mode === 'edge'
      ? { host: 'dockview', mode, edge: current.previousDockedEdge ?? 'top' }
      : { host: 'dockview', mode };
    return this.updatePlacement(instanceId, placement);
  }

  close(instanceId: string): boolean {
    const removed = this.instances.delete(instanceId);
    if (removed) {
      this.emit();
    }
    return removed;
  }

  get(instanceId: string): SurfaceInstanceRecord | null {
    return this.instances.get(instanceId) ?? null;
  }

  getSnapshot(): SurfaceRegistrySnapshot {
    return {
      registrations: [...this.registrations.values()],
      instances: [...this.instances.values()],
    };
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
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
