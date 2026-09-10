import { createWorldPluginRegistry } from './world-plugin-registry.js';
import { createFuzzballPlugin } from './fuzzball/plugin.js';
import { createTapsPlugin } from './taps/plugin.js';
import type { WorldSessionContainerRegistry } from './world-session-container.js';
import { createInProcessWorldPluginProvider } from './world-plugin.js';

export function createWorldPluginRegistryForSession(
  worldSessionContainers: WorldSessionContainerRegistry,
) {
  const registry = createWorldPluginRegistry();
  registry.registerProvider(createInProcessWorldPluginProvider(() => createFuzzballPlugin(worldSessionContainers)));
  registry.registerProvider(createInProcessWorldPluginProvider(createTapsPlugin));
  return registry;
}
