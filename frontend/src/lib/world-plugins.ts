import { createFuzzballPlugin } from './fuzzball/plugin.js';
import { createWorldPluginRegistry } from './world-plugin-registry.js';
import { createTapsPlugin } from './taps/plugin.js';

export function createWorldPluginRegistryForSession() {
  const registry = createWorldPluginRegistry();
  registry.register(createFuzzballPlugin());
  registry.register(createTapsPlugin());
  return registry;
}
