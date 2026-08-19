import { writable } from 'svelte/store';

const debugConsoleCache = writable(0);

export function bumpDebugConsoleCache(): void {
  debugConsoleCache.update((version) => version + 1);
}

export { debugConsoleCache };
