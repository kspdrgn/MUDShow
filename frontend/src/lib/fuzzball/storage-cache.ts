export type FuzzBallPropertyNodeType = 'dir' | 'str' | 'int';

export interface FuzzBallPropertyNodeInput {
  path: string;
  type: FuzzBallPropertyNodeType;
  value?: string | null;
  hasChildren?: boolean;
}

export interface FuzzBallStorageLookupState {
  worldId: string;
  characterId: string;
}

export interface FuzzBallPropertyNodeSnapshot {
  path: string;
  name: string;
  label: string;
  type: FuzzBallPropertyNodeType;
  value: string | null;
  isValueLoaded: boolean;
  hasChildren: boolean;
  areChildrenLoaded: boolean;
  updatedAt: number;
}

interface InternalPropertyNode {
  path: string;
  name: string;
  type: FuzzBallPropertyNodeType;
  value: string | null;
  isValueLoaded: boolean;
  hasChildren: boolean;
  updatedAt: number;
}

function normalizePropertyPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsedSlashes = withLeadingSlash.replace(/\/{2,}/g, '/');

  if (collapsedSlashes === '/') {
    return '/';
  }

  return collapsedSlashes.replace(/\/+$/g, '');
}

function getNodeName(path: string, isDirectory = false): string {
  if (path === '/') {
    return '/';
  }

  const lastSlash = path.lastIndexOf('/');
  const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  return isDirectory ? `${name}/` : name;
}

function getParentPath(path: string): string | null {
  if (path === '/') {
    return null;
  }

  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '/';
  }

  return path.slice(0, lastSlash);
}

function formatNodeLabel(node: Pick<FuzzBallPropertyNodeSnapshot, 'name' | 'type' | 'value'>): string {
  const renderedValue = node.value ?? 'no value';
  return `${node.name} · ${node.type} · ${renderedValue}`;
}

function compareStorageNodeNames(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function toSnapshot(node: InternalPropertyNode, areChildrenLoaded: boolean): FuzzBallPropertyNodeSnapshot {
  return {
    path: node.path,
    name: node.name,
    label: formatNodeLabel(node),
    type: node.type,
    value: node.value,
    isValueLoaded: node.isValueLoaded,
    hasChildren: node.hasChildren || areChildrenLoaded,
    areChildrenLoaded,
    updatedAt: node.updatedAt,
  };
}

export class FuzzBallPropertyTreeCache {
  private readonly nodes = new Map<string, InternalPropertyNode>();
  private readonly loadedChildren = new Set<string>();
  private readonly pendingChildrenLoads: string[] = [];
  private readonly pendingChildrenLoadSet = new Set<string>();
  private readonly listeners = new Set<() => void>();
  onChange: (() => void) | null = null;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  hasData(): boolean {
    return this.nodes.size > 0;
  }

  clear(): void {
    this.nodes.clear();
    this.loadedChildren.clear();
    this.pendingChildrenLoads.length = 0;
    this.pendingChildrenLoadSet.clear();
    this.notify();
  }

  beginChildrenLoad(path: string): boolean {
    const normalizedPath = normalizePropertyPath(path);
    if (this.hasLoadedChildren(normalizedPath) || this.pendingChildrenLoadSet.has(normalizedPath)) {
      return false;
    }

    this.pendingChildrenLoads.push(normalizedPath);
    this.pendingChildrenLoadSet.add(normalizedPath);
    return true;
  }

  completeNextChildrenLoad(): string | null {
    const path = this.pendingChildrenLoads.shift();
    if (!path) {
      return null;
    }

    this.pendingChildrenLoadSet.delete(path);
    this.loadedChildren.add(path);
    this.notify();
    return path;
  }

  markChildrenLoaded(path: string): void {
    const normalizedPath = normalizePropertyPath(path);
    this.pendingChildrenLoadSet.delete(normalizedPath);
    this.loadedChildren.add(normalizedPath);
    const pendingIndex = this.pendingChildrenLoads.indexOf(normalizedPath);
    if (pendingIndex >= 0) {
      this.pendingChildrenLoads.splice(pendingIndex, 1);
    }
    this.notify();
  }

  upsertNode(input: FuzzBallPropertyNodeInput): FuzzBallPropertyNodeSnapshot {
    const normalizedPath = normalizePropertyPath(input.path);
    const now = Date.now();
    this.ensureAncestors(normalizedPath, now);

    const areChildrenLoaded = this.hasLoadedChildren(normalizedPath);
    const listedAsDirectory = input.path.trim().length > 1 && /\/+$/u.test(input.path.trim());
    const hasChildren = (input.hasChildren ?? false) || listedAsDirectory || areChildrenLoaded;
    const existingNode = this.nodes.get(normalizedPath);
    const isKnownDirectory = input.type === 'dir'
      || input.hasChildren === true
      || listedAsDirectory
      || existingNode?.type === 'dir'
      || existingNode?.name.endsWith('/') === true;
    const nextNode: InternalPropertyNode = {
      path: normalizedPath,
      name: normalizedPath === '/' ? '/' : getNodeName(normalizedPath, isKnownDirectory),
      type: input.type,
      value: input.type === 'dir' ? null : (input.value ?? null),
      isValueLoaded: true,
      hasChildren,
      updatedAt: now,
    };

    this.nodes.set(normalizedPath, nextNode);
    this.notify();
    return this.getSnapshot(normalizedPath) ?? toSnapshot(nextNode, this.hasLoadedChildren(normalizedPath));
  }

  getSnapshot(path: string): FuzzBallPropertyNodeSnapshot | null {
    const normalizedPath = normalizePropertyPath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node) {
      if (normalizedPath === '/' && this.nodes.size > 0) {
        return {
          path: '/',
          name: '/',
          label: formatNodeLabel({ name: '/', type: 'dir', value: null }),
          type: 'dir',
          value: null,
          isValueLoaded: false,
          hasChildren: true,
          areChildrenLoaded: true,
          updatedAt: 0,
        };
      }

      return null;
    }

    return toSnapshot(node, this.hasLoadedChildren(normalizedPath));
  }

  getChildren(path: string): FuzzBallPropertyNodeSnapshot[] {
    const normalizedPath = normalizePropertyPath(path);
    const children = [...this.nodes.values()]
      .filter((node) => getParentPath(node.path) === normalizedPath)
      .sort((left, right) => {
        const nameCompare = compareStorageNodeNames(left.name, right.name);
        return nameCompare !== 0 ? nameCompare : 0;
      });

    return children.map((child) => toSnapshot(child, this.hasLoadedChildren(child.path)));
  }

  getTree(): FuzzBallPropertyNodeSnapshot {
    const root = this.nodes.get('/');
    const areChildrenLoaded = this.hasLoadedChildren('/');

    if (!root) {
      return {
        path: '/',
        name: '/',
        label: formatNodeLabel({ name: '/', type: 'dir', value: null }),
        type: 'dir',
        value: null,
        isValueLoaded: false,
        hasChildren: areChildrenLoaded,
        areChildrenLoaded,
        updatedAt: 0,
      };
    }

    return toSnapshot(root, areChildrenLoaded);
  }

  getNodePaths(): string[] {
    return [...this.nodes.keys()].sort((left, right) => left.localeCompare(right));
  }

  private hasLoadedChildren(path: string): boolean {
    const normalizedPath = normalizePropertyPath(path);
    return this.loadedChildren.has(normalizedPath);
  }

  private ensureAncestors(path: string, updatedAt: number): void {
    let current = getParentPath(path);
    while (current) {
      const existing = this.nodes.get(current);
      if (existing) {
        existing.updatedAt = updatedAt;
      } else {
        this.nodes.set(current, {
          path: current,
          name: current === '/' ? '/' : getNodeName(current, true),
          type: 'dir',
          value: null,
          isValueLoaded: false,
          hasChildren: true,
          updatedAt,
        });
      }

      current = getParentPath(current);
    }
  }

  private notify(): void {
    this.onChange?.();

    for (const listener of this.listeners) {
      listener();
    }
  }
}

export class FuzzBallPropertyCacheStore {
  private readonly sessionCaches = new Map<string, FuzzBallPropertyTreeCache>();
  private readonly listeners = new Set<() => void>();

  getSessionCache(worldId: string, characterId = ''): FuzzBallPropertyTreeCache {
    const cacheKey = this.getCacheKey(worldId, characterId);
    let cache = this.sessionCaches.get(cacheKey);

    if (!cache) {
      cache = new FuzzBallPropertyTreeCache();
      cache.onChange = () => this.notify();
      this.sessionCaches.set(cacheKey, cache);
    }

    return cache;
  }

  clearSessionCache(worldId: string, characterId = ''): void {
    if (this.sessionCaches.delete(this.getCacheKey(worldId, characterId))) {
      this.notify();
    }
  }

  clearAll(): void {
    if (this.sessionCaches.size > 0) {
      this.sessionCaches.clear();
      this.notify();
    }
  }

  hasSessionCache(worldId: string, characterId = ''): boolean {
    return this.sessionCaches.has(this.getCacheKey(worldId, characterId));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private getCacheKey(worldId: string, characterId: string): string {
    return `${worldId}\u0000${characterId}`;
  }
}

export const fuzzballStorageCache = new FuzzBallPropertyCacheStore();

export function getFuzzballStorageNodeLoadPath(
  state: FuzzBallStorageLookupState,
  nodeId: string,
): string {
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  const node = cache.getSnapshot(nodeId);

  if (!node) {
    return nodeId;
  }

  if (node.hasChildren && !node.areChildrenLoaded) {
    return node.path === '/' ? '/' : `${node.path}/`;
  }

  return node.path;
}
