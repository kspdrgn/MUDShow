import type { AppTab } from '../../tabs';

export interface TabDragState {
  tabId: string;
  pointerId: number;
  pointerTarget: HTMLElement | null;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  isDragging: boolean;
  dropIndex: number;
  indicatorLeft: number;
}

export const TAB_DRAG_THRESHOLD = 6;

export interface TabDragPositionInput {
  tabs: AppTab[];
  tabGroupElements: Record<string, HTMLDivElement | null>;
  titlebarTabsElement: HTMLDivElement | null;
  quickConnectContainer: HTMLDivElement | null;
}

export function createTabDragState(
  tab: AppTab,
  event: PointerEvent,
  tabs: AppTab[],
): TabDragState {
  return {
    tabId: tab.id,
    pointerId: event.pointerId,
    pointerTarget: event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
    startX: event.clientX,
    startY: event.clientY,
    clientX: event.clientX,
    clientY: event.clientY,
    isDragging: false,
    dropIndex: Math.max(0, tabs.filter((item) => item.id !== tab.id).length),
    indicatorLeft: 0,
  };
}

export function calculateTabDragPosition(
  drag: TabDragState,
  clientX: number,
  input: TabDragPositionInput,
): Pick<TabDragState, 'dropIndex' | 'indicatorLeft' | 'clientX' | 'clientY'> {
  const draggedTabId = drag.tabId;
  const otherTabs = input.tabs.filter((tab) => tab.id !== draggedTabId);
  const containerRect = input.titlebarTabsElement?.getBoundingClientRect();

  if (!containerRect) {
    return {
      dropIndex: otherTabs.length,
      indicatorLeft: 0,
      clientX,
      clientY: drag.clientY,
    };
  }

  let dropIndex = otherTabs.length;
  let indicatorLeft = containerRect.width;

  for (let index = 0; index < otherTabs.length; index += 1) {
    const tab = otherTabs[index];
    const element = input.tabGroupElements[tab.id];
    const rect = element?.getBoundingClientRect();

    if (!rect) {
      continue;
    }

    const midpoint = rect.left + rect.width / 2;
    if (clientX < midpoint) {
      dropIndex = index;
      indicatorLeft = rect.left - containerRect.left - 2;
      break;
    }
  }

  if (dropIndex === otherTabs.length) {
    const quickConnectRect = input.quickConnectContainer?.getBoundingClientRect() ?? null;
    const lastTab = otherTabs[otherTabs.length - 1];
    const rect = lastTab ? input.tabGroupElements[lastTab.id]?.getBoundingClientRect() ?? null : null;
    indicatorLeft = quickConnectRect
      ? quickConnectRect.left - containerRect.left - 3
      : rect
        ? rect.right - containerRect.left + 3
        : containerRect.width;
  }

  return {
    dropIndex,
    indicatorLeft: Math.max(0, indicatorLeft),
    clientX,
    clientY: drag.clientY,
  };
}

export function createSuppressedTabClickScheduler(
  onTick?: (tabId: string | null) => void,
): {
  suppressTabClickId: string | null;
  clearSuppressedTabClick: () => void;
  scheduleSuppressedTabClick: (tabId: string) => void;
} {
  let suppressTabClickId: string | null = null;
  let suppressTabClickTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearSuppressedTabClick(): void {
    if (suppressTabClickTimeout !== null) {
      clearTimeout(suppressTabClickTimeout);
      suppressTabClickTimeout = null;
    }

    suppressTabClickId = null;
    onTick?.(suppressTabClickId);
  }

  function scheduleSuppressedTabClick(tabId: string): void {
    clearSuppressedTabClick();
    suppressTabClickId = tabId;
    onTick?.(suppressTabClickId);
    suppressTabClickTimeout = setTimeout(() => {
      if (suppressTabClickId === tabId) {
        suppressTabClickId = null;
        onTick?.(suppressTabClickId);
      }

      suppressTabClickTimeout = null;
    }, 0);
  }

  return {
    get suppressTabClickId() {
      return suppressTabClickId;
    },
    clearSuppressedTabClick,
    scheduleSuppressedTabClick,
  };
}
