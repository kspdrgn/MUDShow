import type {
  WorldPlugin,
  WorldPluginActivationContext,
  WorldPluginServiceBag,
  WorldPluginServiceKey,
  WorldPluginSessionContext,
  WorldPluginSessionContribution,
} from './world-plugin.js';
import type { WorldSessionAction } from './world-session-action.js';
import type { WorldSurfaceDescriptor } from './world-surface-protocol.js';

export interface WorldPluginSession {
  readonly plugins: readonly WorldPlugin[];
  readonly contributions: readonly WorldPluginSessionContribution[];
  getActions(): WorldSessionAction[];
  getSurfaces(): WorldSurfaceDescriptor[];
  subscribe(listener: () => void): () => void;
  handleIncomingLine(line: string): void;
  handleConnected(): void;
  handleDisconnected(): void;
  dispose(): Promise<void>;
}

export interface WorldPluginRegistry {
  register(plugin: WorldPlugin): () => void;
  get(pluginId: string): WorldPlugin | null;
  resolveActive(context: WorldPluginActivationContext): readonly WorldPlugin[];
  createSession(context: WorldPluginSessionContext): WorldPluginSession;
}

export function createWorldPluginServiceBag(): WorldPluginServiceBag {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: WorldPluginServiceKey<T>): T | null {
      return (values.get(key.id) as T | undefined) ?? null;
    },
    set<T>(key: WorldPluginServiceKey<T>, service: T): void {
      values.set(key.id, service);
    },
  };
}

export function createWorldPluginRegistry(onError: (pluginId: string, error: unknown) => void = () => {}): WorldPluginRegistry {
  const plugins = new Map<string, WorldPlugin>();

  function resolveActive(context: WorldPluginActivationContext): readonly WorldPlugin[] {
    const result: WorldPlugin[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(plugin: WorldPlugin): void {
      if (visited.has(plugin.id)) return;
      if (visiting.has(plugin.id)) throw new Error(`world plugin dependency cycle includes: ${plugin.id}`);
      visiting.add(plugin.id);
      for (const dependencyId of plugin.dependencies ?? []) {
        const dependency = plugins.get(dependencyId);
        if (!dependency) throw new Error(`world plugin dependency is not registered: ${dependencyId}`);
        if (!dependency.canActivate(context)) throw new Error(`world plugin dependency is inactive: ${plugin.id} requires ${dependencyId}`);
        visit(dependency);
      }
      visiting.delete(plugin.id);
      visited.add(plugin.id);
      result.push(plugin);
    }

    for (const plugin of plugins.values()) {
      if (plugin.canActivate(context)) visit(plugin);
    }
    return result;
  }

  return {
    register(plugin) {
      if (!plugin.id.trim() || plugins.has(plugin.id)) throw new Error(`invalid or duplicate world plugin: ${plugin.id}`);
      plugins.set(plugin.id, plugin);
      return () => plugins.delete(plugin.id);
    },
    get: (pluginId) => plugins.get(pluginId) ?? null,
    resolveActive,
    createSession(context) {
      const activePlugins = resolveActive(context);
      const contributions: WorldPluginSessionContribution[] = [];
      const services = context.services;
      try {
        for (const plugin of activePlugins) {
          contributions.push(plugin.createSessionContribution({ ...context, services }));
        }
      } catch (error) {
        for (const contribution of contributions.reverse()) void contribution.dispose?.();
        throw error;
      }

      let disposed = false;
      const listeners = new Set<() => void>();
      const unsubscribers = contributions.map((contribution) => contribution.subscribe?.(() => {
        for (const listener of [...listeners]) listener();
      })).filter((unsubscribe): unsubscribe is () => void => Boolean(unsubscribe));
      function dispatch(hook: 'onIncomingLine' | 'onConnected' | 'onDisconnected', value?: string): void {
        if (disposed) return;
        contributions.forEach((contribution, index) => {
          try {
            if (hook === 'onIncomingLine') contribution.onIncomingLine?.(value ?? '');
            else contribution[hook]?.();
          } catch (error) {
            onError(activePlugins[index]?.id ?? 'unknown', error);
          }
        });
      }
      return {
        plugins: activePlugins,
        contributions,
        getActions: () => contributions.flatMap((contribution) => [...(contribution.actions ?? []), ...(contribution.getActions?.() ?? [])]),
        getSurfaces: () => contributions.flatMap((contribution) => [...(contribution.surfaces ?? [])]),
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        handleIncomingLine: (line) => dispatch('onIncomingLine', line),
        handleConnected: () => dispatch('onConnected'),
        handleDisconnected: () => dispatch('onDisconnected'),
        async dispose() {
          if (disposed) return;
          disposed = true;
          listeners.clear();
          unsubscribers.forEach((unsubscribe) => unsubscribe());
          for (let index = contributions.length - 1; index >= 0; index -= 1) {
            try { await contributions[index].dispose?.(); } catch (error) { onError(activePlugins[index]?.id ?? 'unknown', error); }
          }
        },
      } satisfies WorldPluginSession;
    },
  };
}
