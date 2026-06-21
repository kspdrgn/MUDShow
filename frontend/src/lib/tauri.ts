type TauriGlobal = Window & {
  __TAURI_INTERNALS__?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

function getTauriGlobal() {
  if (typeof window === 'undefined') {
    throw new Error('Tauri APIs are only available in the desktop webview.');
  }

  const tauriWindow = window as TauriGlobal;
  const api = tauriWindow.__TAURI_INTERNALS__;
  if (!api) {
    throw new Error('Tauri APIs are not available on this page.');
  }

  return api;
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return getTauriGlobal().invoke<T>(command, args);
}
