import { createWorldPluginRegistry } from './world-plugin-registry.js';
import { createFuzzballPlugin } from './fuzzball/plugin.js';
import { createTapsPlugin } from './taps/plugin.js';
import type { WorldSessionContainerRegistry } from './world-session-container.js';

export function createWorldPluginRegistryForSession(
  worldSessionContainers: WorldSessionContainerRegistry,
) {
  const registry = createWorldPluginRegistry();
  registry.register(createFuzzballPlugin(worldSessionContainers));
  registry.register(createTapsPlugin());
  return registry;
}
