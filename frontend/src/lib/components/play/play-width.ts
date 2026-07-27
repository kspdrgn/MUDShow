export function normalizeCharacterWidth(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.max(1, Math.round(value));
}

export function measureTextWidth(root: HTMLElement | null, text: string): number {
  if (!root) {
    return 0;
  }

  const probe = document.createElement('span');
  probe.textContent = text;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'pre';
  probe.style.fontFamily = 'var(--world-output-font-family, var(--font-mono))';
  probe.style.fontWeight = 'var(--world-output-font-weight, 400)';
  probe.style.fontStyle = 'var(--world-output-font-style, normal)';
  probe.style.fontStretch = 'var(--world-output-font-stretch, normal)';
  probe.style.fontSize = 'var(--world-output-font-size, 13px)';
  probe.style.fontVariantLigatures = 'none';
  probe.style.fontFeatureSettings = '"liga" 0, "clig" 0, "calt" 0';

  root.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();

  return width;
}

export function measureCharacterWidth(root: HTMLElement | null, widthInCharacters: number): string {
  const sampleSize = 80;
  const narrowWidth = measureTextWidth(root, 'i'.repeat(sampleSize));
  const wideWidth = measureTextWidth(root, 'W'.repeat(sampleSize));
  const monoTolerance = 0.02 * sampleSize;
  const isMonospace = narrowWidth > 0 && wideWidth > 0 && Math.abs(narrowWidth - wideWidth) <= monoTolerance;
  const measuredWidth = isMonospace
    ? measureTextWidth(root, '0'.repeat(widthInCharacters))
    : (measureTextWidth(root, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.repeat(2)) / 126) * widthInCharacters;

  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
    return `${widthInCharacters}ch`;
  }

  return `${measuredWidth}px`;
}
