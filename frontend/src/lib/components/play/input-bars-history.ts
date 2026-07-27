import type { InputBarId } from '../../input-bars';

export interface HistoryBrowseState {
  cursor: number | null;
  editIndex: number | null;
}

export function createHistoryBrowseState(): HistoryBrowseState {
  return { cursor: null, editIndex: null };
}

export function getHistoryBrowseState(
  historyState: Record<InputBarId, HistoryBrowseState>,
  bar: InputBarId,
): HistoryBrowseState {
  return historyState[bar] ?? createHistoryBrowseState();
}

export function setHistoryBrowseState(
  historyState: Record<InputBarId, HistoryBrowseState>,
  bar: InputBarId,
  next: HistoryBrowseState,
): Record<InputBarId, HistoryBrowseState> {
  return {
    ...historyState,
    [bar]: next,
  };
}

export function resetHistoryBrowseState(
  historyState: Record<InputBarId, HistoryBrowseState>,
  bar: InputBarId,
): Record<InputBarId, HistoryBrowseState> {
  return setHistoryBrowseState(historyState, bar, createHistoryBrowseState());
}

export function shiftHistoryBrowseState(
  historyState: Record<InputBarId, HistoryBrowseState>,
  removed: number,
): Record<InputBarId, HistoryBrowseState> {
  if (removed <= 0) {
    return historyState;
  }

  const shift = (value: number | null): number | null => {
    if (value === null) {
      return null;
    }

    return Math.max(0, value - removed);
  };

  const nextHistoryState: Record<InputBarId, HistoryBrowseState> = {};
  for (const [key, entry] of Object.entries(historyState)) {
    const bar = Number(key) as InputBarId;
    nextHistoryState[bar] = {
      cursor: shift(entry.cursor),
      editIndex: shift(entry.editIndex),
    };
  }

  return nextHistoryState;
}

export function appendHistoryValue(
  history: string[],
  historyState: Record<InputBarId, HistoryBrowseState>,
  value: string,
  limit: number,
): { history: string[]; historyState: Record<InputBarId, HistoryBrowseState>; index: number } {
  let nextHistory = [...history, value];
  let nextHistoryState = historyState;

  if (nextHistory.length > limit) {
    const removed = nextHistory.length - limit;
    nextHistory = nextHistory.slice(removed);
    nextHistoryState = shiftHistoryBrowseState(historyState, removed);
  }

  return {
    history: nextHistory,
    historyState: nextHistoryState,
    index: nextHistory.length - 1,
  };
}

export function updateHistoryValue(history: string[], index: number, value: string): string[] {
  if (index < 0 || index >= history.length) {
    return history;
  }

  const next = [...history];
  next[index] = value;
  return next;
}
