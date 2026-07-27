export const HISTORY_OVERSCAN_PX = 900;
export const LIVE_OVERSCAN_PX = 500;

export function getTranscriptViewportMetrics(
  element: HTMLElement | null,
  fallbackScrollTop: number,
  fallbackClientHeight: number,
): { scrollTop: number; clientHeight: number } {
  if (!element) {
    return {
      scrollTop: fallbackScrollTop,
      clientHeight: fallbackClientHeight,
    };
  }

  return {
    scrollTop: element.scrollTop,
    clientHeight: element.clientHeight,
  };
}

export function getTranscriptWheelDelta(event: WheelEvent, target: HTMLElement): number {
  const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? event.deltaY * target.clientHeight
      : event.deltaY;

  return Number.isFinite(delta) ? delta : 0;
}
