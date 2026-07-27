import { isTauriAvailable, invoke } from '../../tauri';
import { shouldStartTitlebarDrag } from './topbar-state';

export async function minimizeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  await invoke('window_minimize');
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  await invoke('window_toggle_maximize');
}

export async function closeWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  await invoke('window_close');
}

export async function openInspector(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  try {
    await invoke('window_open_devtools');
  } catch (error) {
    console.error('failed to open the web inspector', error);
  }
}

export function startTitlebarDrag(event: MouseEvent): void {
  if (event.button !== 0 || !shouldStartTitlebarDrag(event.target)) {
    return;
  }

  event.preventDefault();
  void invoke('window_start_dragging').catch((error) => {
    console.error('failed to start window drag', error);
  });
}
