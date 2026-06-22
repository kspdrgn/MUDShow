type TauriGlobal = Window & {
  __TAURI_INTERNALS__?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  __TAURI__?: {
    event?: {
      listen<T>(
        event: string,
        handler: (event: { event: string; id: number; payload: T }) => void,
      ): Promise<() => void>;
    };
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

export async function listen<T>(
  event: string,
  handler: (event: { event: string; id: number; payload: T }) => void,
): Promise<() => void> {
  if (typeof window === 'undefined') {
    throw new Error('Tauri APIs are only available in the desktop webview.');
  }

  const tauriWindow = window as TauriGlobal;
  const api = tauriWindow.__TAURI__?.event;
  if (!api) {
    throw new Error('Tauri event APIs are not available on this page.');
  }

  return api.listen<T>(event, handler);
}
