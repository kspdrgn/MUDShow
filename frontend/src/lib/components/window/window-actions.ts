import { getCurrentWebviewWindow, isTauriAvailable, invoke } from '../../tauri';
import { shouldStartTitlebarDrag } from './topbar-state';

function logWindowAction(action: string, details?: Record<string, unknown>): void {
  if (details) {
    console.log(`[window-action] ${action}`, details);
    return;
  }

  console.log(`[window-action] ${action}`);
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  logWindowAction('minimize requested');
  await invoke('window_minimize');
  logWindowAction('minimize completed');
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  logWindowAction('toggle maximize requested');
  await invoke('window_toggle_maximize');
  logWindowAction('toggle maximize completed');
}

export async function closeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  logWindowAction('close requested');
  const currentWindow = getCurrentWebviewWindow();

  try {
    if (currentWindow) {
      logWindowAction('close via current webview requested');
      await currentWindow.close();
      logWindowAction('close via current webview completed');
    } else {
      logWindowAction('close via command requested');
      await invoke('window_close');
      logWindowAction('close via command completed');
    }
  } catch (error) {
    console.error('failed to close window directly, falling back to command', error);
    logWindowAction('close fallback via command requested');
    await invoke('window_close');
    logWindowAction('close fallback via command completed');
  }
  logWindowAction('close completed');
}

export async function openInspector(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  try {
    logWindowAction('open inspector requested');
    await invoke('window_open_devtools');
    logWindowAction('open inspector completed');
  } catch (error) {
    console.error('failed to open the web inspector', error);
  }
}

export async function openPlainNativeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  try {
    logWindowAction('open plain native window requested');
    await invoke('window_open_plain_native_window');
    logWindowAction('open plain native window completed');
  } catch (error) {
    console.error('failed to open the plain native window', error);
  }
}

export async function openPlainWebviewWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  try {
    logWindowAction('open plain webview window requested');
    await invoke('window_open_plain_webview_window');
    logWindowAction('open plain webview window completed');
  } catch (error) {
    console.error('failed to open the plain webview window', error);
  }
}

export function startTitlebarDrag(event: MouseEvent): void {
  if (event.button !== 0 || !shouldStartTitlebarDrag(event.target)) {
    return;
  }

  event.preventDefault();
  logWindowAction('start drag requested');
  void invoke('window_start_dragging').catch((error) => {
    console.error('failed to start window drag', error);
  });
}
