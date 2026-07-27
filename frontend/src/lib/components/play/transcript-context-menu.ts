export function getTranscriptContextMenuPosition(
  shellRect: DOMRect | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (!shellRect) {
    return {
      x: clientX,
      y: clientY,
    };
  }

  return {
    x: Math.max(8, Math.min(clientX - shellRect.left, shellRect.width - 8)),
    y: Math.max(8, Math.min(clientY - shellRect.top, shellRect.height - 8)),
  };
}
