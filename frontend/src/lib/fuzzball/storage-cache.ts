export type FuzzBallPropertyNodeType = 'dir' | 'str' | 'int';

export interface FuzzBallPropertyNodeInput {
  path: string;
  type: FuzzBallPropertyNodeType;
  value?: string | null;
}

export interface FuzzBallPropertyNodeSnapshot {
  path: string;
  name: string;
  label: string;
  type: FuzzBallPropertyNodeType;
  value: string | null;
  isValueLoaded: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  updatedAt: number;
}

interface InternalPropertyNode {
  path: string;
  name: string;
  type: FuzzBallPropertyNodeType;
  value: string | null;
  isValueLoaded: boolean;
  isExpanded: boolean;
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

function getNodeName(path: string): string {
  if (path === '/') {
    return '/';
  }

  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
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

function toSnapshot(node: InternalPropertyNode, hasChildren: boolean): FuzzBallPropertyNodeSnapshot {
  return {
    path: node.path,
    name: node.name,
    label: formatNodeLabel(node),
    type: node.type,
    value: node.value,
    isValueLoaded: node.isValueLoaded,
    isExpanded: node.isExpanded,
    hasChildren,
    updatedAt: node.updatedAt,
  };
}

export class FuzzBallPropertyTreeCache {
  private readonly nodes = new Map<string, InternalPropertyNode>();

  hasData(): boolean {
    return this.nodes.size > 0;
  }

  clear(): void {
    this.nodes.clear();
  }

  markExpanded(path: string): FuzzBallPropertyNodeSnapshot {
    const normalizedPath = normalizePropertyPath(path);
    const node = this.ensureNode(normalizedPath, true);
    node.isExpanded = true;
    node.updatedAt = Date.now();
    return this.getSnapshot(normalizedPath) ?? toSnapshot(node, this.hasChildren(normalizedPath));
  }

  upsertNode(input: FuzzBallPropertyNodeInput): FuzzBallPropertyNodeSnapshot {
    const normalizedPath = normalizePropertyPath(input.path);
    const now = Date.now();
    this.ensureAncestors(normalizedPath, now);

    const existing = this.nodes.get(normalizedPath);
    const nextNode: InternalPropertyNode = {
      path: normalizedPath,
      name: normalizedPath === '/' ? '/' : getNodeName(normalizedPath),
      type: input.type,
      value: input.type === 'dir' ? null : (input.value ?? null),
      isValueLoaded: true,
      isExpanded: existing?.isExpanded ?? false,
      updatedAt: now,
    };

    this.nodes.set(normalizedPath, nextNode);
    return this.getSnapshot(normalizedPath) ?? toSnapshot(nextNode, this.hasChildren(normalizedPath));
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
          isExpanded: true,
          hasChildren: true,
          updatedAt: 0,
        };
      }

      return null;
    }

    return toSnapshot(node, this.hasChildren(normalizedPath));
  }

  getChildren(path: string): FuzzBallPropertyNodeSnapshot[] {
    const normalizedPath = normalizePropertyPath(path);
    const children = [...this.nodes.values()]
      .filter((node) => getParentPath(node.path) === normalizedPath)
      .sort((left, right) => {
        const nameCompare = left.name.localeCompare(right.name);
        return nameCompare !== 0 ? nameCompare : left.path.localeCompare(right.path);
      });

    return children.map((child) => toSnapshot(child, this.hasChildren(child.path)));
  }

  getTree(): FuzzBallPropertyNodeSnapshot {
    const root = this.nodes.get('/');
    const hasChildren = this.hasChildren('/');

    if (!root) {
      return {
        path: '/',
        name: '/',
        label: formatNodeLabel({ name: '/', type: 'dir', value: null }),
        type: 'dir',
        value: null,
        isValueLoaded: false,
        isExpanded: hasChildren,
        hasChildren,
        updatedAt: 0,
      };
    }

    return toSnapshot(root, hasChildren);
  }

  getNodePaths(): string[] {
    return [...this.nodes.keys()].sort((left, right) => left.localeCompare(right));
  }

  private hasChildren(path: string): boolean {
    const normalizedPath = normalizePropertyPath(path);

    for (const node of this.nodes.values()) {
      if (node.path !== normalizedPath && getParentPath(node.path) === normalizedPath) {
        return true;
      }
    }

    return false;
  }

  private ensureNode(path: string, isSynthetic = false): InternalPropertyNode {
    const existing = this.nodes.get(path);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const node: InternalPropertyNode = {
      path,
      name: path === '/' ? '/' : getNodeName(path),
      type: 'dir',
      value: null,
      isValueLoaded: !isSynthetic,
      isExpanded: false,
      updatedAt: now,
    };

    this.nodes.set(path, node);
    return node;
  }

  private ensureAncestors(path: string, updatedAt: number): void {
    let current = getParentPath(path);
    while (current) {
      const existing = this.nodes.get(current);
      if (existing) {
        existing.isExpanded = true;
        existing.updatedAt = updatedAt;
      } else {
        this.nodes.set(current, {
          path: current,
          name: current === '/' ? '/' : getNodeName(current),
          type: 'dir',
          value: null,
          isValueLoaded: false,
          isExpanded: true,
          updatedAt,
        });
      }

      current = getParentPath(current);
    }
  }
}

export class FuzzBallPropertyCacheStore {
  private readonly sessionCaches = new Map<string, FuzzBallPropertyTreeCache>();

  getSessionCache(worldId: string, characterId = ''): FuzzBallPropertyTreeCache {
    const cacheKey = this.getCacheKey(worldId, characterId);
    let cache = this.sessionCaches.get(cacheKey);

    if (!cache) {
      cache = new FuzzBallPropertyTreeCache();
      this.sessionCaches.set(cacheKey, cache);
    }

    return cache;
  }

  clearSessionCache(worldId: string, characterId = ''): void {
    this.sessionCaches.delete(this.getCacheKey(worldId, characterId));
  }

  clearAll(): void {
    this.sessionCaches.clear();
  }

  hasSessionCache(worldId: string, characterId = ''): boolean {
    return this.sessionCaches.has(this.getCacheKey(worldId, characterId));
  }

  private getCacheKey(worldId: string, characterId: string): string {
    return `${worldId}\u0000${characterId}`;
  }
}

export const fuzzballStorageCache = new FuzzBallPropertyCacheStore();
