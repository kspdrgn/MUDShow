import { getTauriClipboardManager, isTauriAvailable } from './tauri';

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function focusElement(id: string, preventScroll = false): void {
  document.getElementById(id)?.focus({ preventScroll });
}

export async function copyTextToClipboard(text: string): Promise<void> {
  const clipboard = getTauriClipboardManager();
  if (clipboard) {
    await clipboard.writeText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some desktop webviews expose the Clipboard API but reject writes.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('clipboard copy was not accepted');
  }
}

export async function readTextFromClipboard(): Promise<string> {
  const clipboard = getTauriClipboardManager();
  if (clipboard) {
    return clipboard.readText();
  }

  if (isTauriAvailable()) {
    throw new Error('Tauri clipboard manager is not available');
  }

  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  throw new Error('clipboard read is not available');
}

export function scrollElementToBottom(id: string): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}

export function scrollElementToTop(id: string): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.scrollTop = 0;
}

export function scrollElementBy(id: string, delta: number): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.scrollTop += delta;
}
