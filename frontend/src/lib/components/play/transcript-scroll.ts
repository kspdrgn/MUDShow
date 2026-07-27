import { scrollElementToBottom } from '../../session-dom';

export function getTranscriptScrollMetrics(
  element: HTMLElement | null,
): { scrollTop: number; scrollHeight: number; clientHeight: number; distanceFromBottom: number } | null {
  if (!element) {
    return null;
  }

  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    distanceFromBottom: element.scrollHeight - element.scrollTop - element.clientHeight,
  };
}

export function getTranscriptHistoryMetrics(
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

export function scrollTranscriptToBottomIfFollowing(scope: string, userScrolled: boolean): void {
  if (userScrolled) {
    return;
  }

  scrollElementToBottom(`${scope}-output-area`);
}
