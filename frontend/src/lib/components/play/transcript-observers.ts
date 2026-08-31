export interface TranscriptObserverTargets {
  contentElement: HTMLElement | null;
  historyElement: HTMLElement | null;
  onResize: () => void;
}

export function setupTranscriptObservers(targets: TranscriptObserverTargets): () => void {
  let contentResizeObserver: ResizeObserver | null = null;
  let historyResizeObserver: ResizeObserver | null = null;

  if (targets.contentElement) {
    contentResizeObserver = new ResizeObserver(() => {
      targets.onResize();
    });
    contentResizeObserver.observe(targets.contentElement);
  }

  if (targets.historyElement) {
    historyResizeObserver = new ResizeObserver(() => {
      targets.onResize();
    });
    historyResizeObserver.observe(targets.historyElement);
  }

  return () => {
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;

    historyResizeObserver?.disconnect();
    historyResizeObserver = null;
  };
}
