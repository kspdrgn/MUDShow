import { invoke, isTauriAvailable } from './tauri';

export interface WindowAttentionService {
  isAppFocused(): boolean;
  requestAttention(enabled: boolean): void;
}

function createWindowAttentionService(): WindowAttentionService {
  let appWindowFocused = true;

  if (typeof window !== 'undefined') {
    appWindowFocused = !document.hidden;
    window.addEventListener('focus', () => {
      appWindowFocused = true;
    });
    window.addEventListener('blur', () => {
      appWindowFocused = false;
    });
  }

  function isAppFocused(): boolean {
    return typeof document !== 'undefined' && !document.hidden && appWindowFocused;
  }

  function requestAttention(enabled: boolean): void {
    if (!isTauriAvailable()) {
      return;
    }

    void invoke('window_request_attention', { enabled }).catch((error) => {
      console.error('failed to update window attention:', error);
    });
  }

  return {
    isAppFocused,
    requestAttention,
  };
}

export const windowAttention = createWindowAttentionService();
