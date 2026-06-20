export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function focusElement(id: string): void {
  document.getElementById(id)?.focus();
}

export function scrollElementToBottom(id: string): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}

