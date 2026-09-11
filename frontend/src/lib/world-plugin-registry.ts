import type {
  WorldPlugin,
  WorldPluginActivationContext,
  WorldPluginSessionContext,
  WorldPluginSessionContribution,
  WorldPluginServiceBag,
  WorldPluginSurfaceContribution,
  WorldPluginServiceKey,
  WorldPluginProvider,
} from './world-plugin.js';
import type { WorldSessionAction } from './world-session-action.js';
import type { ConnectionSnapshot } from './connection.js';

export interface WorldPluginErrorContext {
  pluginId: string;
  hook: 'incomingLine' | 'rawMessage' | 'attached' | 'connected' | 'disconnected' | 'dispose';
  error: unknown;
}

export interface WorldPluginRegistryOptions {
  onError?: (context: WorldPluginErrorContext) => void;
}

export interface WorldPluginSession {
  readonly plugins: readonly WorldPlugin[];
  readonly contributions: readonly WorldPluginSessionContribution[];
  getActions(): WorldSessionAction[];
  getSurfaces(): WorldPluginSurfaceContribution[];
  subscribe(listener: () => void): () => void;
  handleIncomingLine(line: string): void;
  handleRawMessage(text: string): void;
  handleAttached(snapshot: ConnectionSnapshot): void;
  handleConnected(): void;
  handleDisconnected(): void;
  dispose(): Promise<void>;
}

export interface WorldPluginRegistry {
  register(plugin: WorldPlugin): () => void;
  registerProvider(provider: WorldPluginProvider): () => void;
  unregister(pluginId: string): void;
  get(pluginId: string): WorldPlugin | null;
  list(): readonly WorldPlugin[];
  resolveActive(context: WorldPluginActivationContext): readonly WorldPlugin[];
  createSession(context: WorldPluginSessionContext): WorldPluginSession;
}

function defaultErrorHandler(context: WorldPluginErrorContext): void {
  console.error(`world plugin ${context.pluginId} failed during ${context.hook}`, context.error);
}

function createPluginSession(
  plugins: readonly WorldPlugin[],
  contributions: readonly WorldPluginSessionContribution[],
  onError: (context: WorldPluginErrorContext) => void,
): WorldPluginSession {
  let disposed = false;
  const listeners = new Set<() => void>();
  const contributionUnsubscribers = contributions
    .map((contribution) => contribution.subscribe?.(() => {
      listeners.forEach((listener) => listener());
    }) ?? null)
    .filter((unsubscribe): unsubscribe is () => void => unsubscribe !== null);

  function dispatch(
    hook: WorldPluginErrorContext['hook'],
    invoke: (contribution: WorldPluginSessionContribution) => void,
  ): void {
    if (disposed) {
      return;
    }

    contributions.forEach((contribution, index) => {
      try {
        invoke(contribution);
      } catch (error) {
        onError({
          pluginId: plugins[index]?.id ?? 'unknown',
          hook,
          error,
        });
      }
    });
  }

  return {
    plugins,
    contributions,
    getActions() {
      return contributions.flatMap((contribution) => [
        ...(contribution.actions ?? []),
        ...(contribution.getActions?.() ?? []),
      ]);
    },
    getSurfaces() {
      return contributions.flatMap((contribution) => contribution.surfaces ?? []);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    handleIncomingLine(line: string) {
      dispatch('incomingLine', (contribution) => contribution.onIncomingLine?.(line));
    },
    handleRawMessage(text: string) {
      dispatch('rawMessage', (contribution) => contribution.onRawMessage?.(text));
    },
    handleAttached(snapshot: ConnectionSnapshot) {
      dispatch('attached', (contribution) => contribution.onAttached?.(snapshot));
    },
    handleConnected() {
      dispatch('connected', (contribution) => contribution.onConnected?.());
    },
    handleDisconnected() {
      dispatch('disconnected', (contribution) => contribution.onDisconnected?.());
    },
    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }

      disposed = true;
      listeners.clear();
      contributionUnsubscribers.forEach((unsubscribe) => unsubscribe());
      for (let index = contributions.length - 1; index >= 0; index -= 1) {
        const contribution = contributions[index];
        try {
          await contribution.dispose?.();
        } catch (error) {
          onError({
            pluginId: plugins[index]?.id ?? 'unknown',
            hook: 'dispose',
            error,
          });
        }
      }
    },
  };
}

export function createWorldPluginRegistry({
  onError = defaultErrorHandler,
}: WorldPluginRegistryOptions = {}): WorldPluginRegistry {
  const plugins = new Map<string, WorldPlugin>();

  function getPlugin(pluginId: string): WorldPlugin {
    const plugin = plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`world plugin is not registered: ${pluginId}`);
    }

    return plugin;
  }

  function resolveActive(context: WorldPluginActivationContext): readonly WorldPlugin[] {
    const resolved: WorldPlugin[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(plugin: WorldPlugin): void {
      if (visited.has(plugin.id)) {
        return;
      }

      if (visiting.has(plugin.id)) {
        throw new Error(`world plugin dependency cycle includes: ${plugin.id}`);
      }

      visiting.add(plugin.id);
      for (const dependencyId of plugin.dependencies ?? []) {
        const dependency = getPlugin(dependencyId);
        if (!dependency.canActivate(context)) {
          throw new Error(`world plugin dependency is inactive: ${plugin.id} requires ${dependencyId}`);
        }
        visit(dependency);
      }
      visiting.delete(plugin.id);
      visited.add(plugin.id);
      resolved.push(plugin);
    }

    for (const plugin of plugins.values()) {
      if (plugin.canActivate(context)) {
        visit(plugin);
      }
    }

    return resolved;
  }

  function unregister(pluginId: string): void {
    plugins.delete(pluginId);
  }

  return {
    register(plugin: WorldPlugin): () => void {
      if (!plugin.id.trim()) {
        throw new Error('world plugin id cannot be empty');
      }
      if (plugins.has(plugin.id)) {
        throw new Error(`world plugin is already registered: ${plugin.id}`);
      }

      plugins.set(plugin.id, plugin);
      return () => unregister(plugin.id);
    },
    registerProvider(provider: WorldPluginProvider): () => void {
      return this.register(provider.createPlugin());
    },
    unregister,
    get(pluginId: string): WorldPlugin | null {
      return plugins.get(pluginId) ?? null;
    },
    list(): readonly WorldPlugin[] {
      return [...plugins.values()];
    },
    resolveActive,
    createSession(context: WorldPluginSessionContext): WorldPluginSession {
      const activePlugins = resolveActive(context);
      const services = context.services ?? createWorldPluginServiceBag();
      const sessionContext = { ...context, services };
      const contributions: WorldPluginSessionContribution[] = [];

      try {
        for (const plugin of activePlugins) {
          contributions.push(plugin.createSessionContribution(sessionContext));
        }
      } catch (error) {
        for (let index = contributions.length - 1; index >= 0; index -= 1) {
          try {
            void contributions[index].dispose?.();
          } catch {
            // Preserve the original contribution-creation error.
          }
        }
        throw error;
      }

      return createPluginSession(activePlugins, contributions, onError);
    },
  };
}

export function createWorldPluginServiceBag(): WorldPluginServiceBag {
  const services = new Map<string, unknown>();

  return {
    get<T>(key: WorldPluginServiceKey<T>): T | null {
      return (services.get(key.id) as T | undefined) ?? null;
    },
    set<T>(key: WorldPluginServiceKey<T>, service: T): void {
      services.set(key.id, service);
    },
  };
}
