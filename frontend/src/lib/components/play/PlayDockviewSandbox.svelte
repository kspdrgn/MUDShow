<script lang="ts">
  import { onMount } from 'svelte';
  import { mount, unmount } from 'svelte';
  import { writable } from 'svelte/store';
  import type {
    AnchoredBox,
    DockviewGroupPanel,
    IDockviewPanel,
    FloatingGroupDragContext,
    PositionResolver,
    PositionResolverArgs,
    SerializedDockview,
  } from 'dockview';
  import { DockviewComponent } from 'dockview';
  import Transcript from './Transcript.svelte';
  import DockviewDummyPanel from './DockviewDummyPanel.svelte';
  import DockviewDebugConsolePanel from './DockviewDebugConsolePanel.svelte';
  import DockviewNotesPanel from './DockviewNotesPanel.svelte';
  import DockviewTreeDataPanel from './DockviewTreeDataPanel.svelte';
  import type {
    DockviewDebugConsolePanelDefinition,
    DockviewDummyWindowPanelDefinition,
    DockviewNotesPanelDefinition,
    DockviewTreeDataPanelDefinition,
  } from './dockview-panel-props';
  import type { DockviewPanelPlacement } from './dockview-panel-types';
  import type { InputBarId } from '../../input-bars';
  import type { PlayTranscript, RenderCache } from '../../playback';
  import type { Trigger } from '../../types';
  import type { WorldSessionAction } from '../../world-session-action';
  import type { SurfaceEdge } from '../../surfaces/surface-registry';
  import { DEFAULT_DOCKVIEW_THEME, getDockviewTheme, type DockviewThemeId } from '../../dockview-themes';

  export let visible = true;
  export let dockviewThemeId: DockviewThemeId = DEFAULT_DOCKVIEW_THEME;
  export let initialLayout: SerializedDockview | null = null;
  export let onLayoutSnapshot: (layout: SerializedDockview) => void = () => {};
  export let topActions: WorldSessionAction[] = [];
  export let debugConsolePanel: DockviewDebugConsolePanelDefinition | null = null;
  export let notesPanel: DockviewNotesPanelDefinition | null = null;
  export let treeDataPanels: DockviewTreeDataPanelDefinition[] = [];
  export let dummyPanels: DockviewDummyWindowPanelDefinition[] = [];
  export let focusSurfaceId: string | null = null;
  export let focusSurfaceRequestVersion = 0;
  export let onFocusInput: () => void = () => {};
  export let activeBar: InputBarId = 1;
  export let transcript: PlayTranscript;
  export let outputRevision = 0;
  export let workspaceWidth = 'none';
  export let outputFontSize = 13;
  export let scope = 'world';
  export let triggers: Trigger[] = [];
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let renderCache: RenderCache | null = null;
  export let showCurrentOutputWhenScrollingUp = true;
  export let transcriptDiagnosticsEnabled = false;
  export let userScrolled = false;
  export let canReconnect = false;
  export let canDisconnect = false;
  export let canQuickLog = false;
  export let canStopLogging = false;
  export let canEditWorld = false;
  export let canEditCharacter = false;
  export let onReconnect: () => void = () => {};
  export let onDisconnect: () => void = () => {};
  export let onQuickLog: () => void = () => {};
  export let onStopLogging: () => void = () => {};
  export let onOpenLogging: () => void = () => {};
  export let onEditWorld: () => void = () => {};
  export let onEditCharacter: () => void = () => {};
  export let onOpenNotes: () => void = () => {};
  export let onOpenDebugConsole: () => void = () => {};
  export let onOpenTriggers: () => void = () => {};
  export let onOpenStyles: () => void = () => {};
  export let onCloseRequest: (anchorRect: DOMRect) => void = () => {};
  export let onScroll: (userInitiated?: boolean) => void = () => {};
  export let onScrollToBottom: () => void = () => {};

  type SandboxPanelDefinition = {
    title: string;
    eyebrow: string;
    description: string;
    tone: 'workspace' | 'accent' | 'muted' | 'warning';
  };

  type SandboxPanelParams = SandboxPanelDefinition;
  type SandboxPanelParamsWithSurface =
    | SandboxPanelDefinition
    | DockviewDebugConsolePanelDefinition
    | DockviewNotesPanelDefinition
    | DockviewTreeDataPanelDefinition
    | DockviewDummyWindowPanelDefinition;

  let dockRoot: HTMLDivElement | null = null;
  let dockview: DockviewComponent | null = null;
  let topEdgeGroup: ReturnType<DockviewComponent['addEdgeGroup']> | null = null;
  let rightEdgeGroup: ReturnType<DockviewComponent['addEdgeGroup']> | null = null;
  let leftEdgeGroup: ReturnType<DockviewComponent['addEdgeGroup']> | null = null;
  let workspaceTranscriptHost: Record<string, unknown> | null = null;
  let updateWorkspaceTranscript: (() => void) | null = null;
  const workspaceTranscriptState = writable<Record<string, unknown>>({});
  let topEdgeHidden = false;
  let rightEdgeHidden = false;
  let leftEdgeHidden = false;
  let topHideTimer: ReturnType<typeof setTimeout> | null = null;
  let rightHideTimer: ReturnType<typeof setTimeout> | null = null;
  let leftHideTimer: ReturnType<typeof setTimeout> | null = null;
  let removeTopEdgePointerListeners: (() => void) | null = null;
  let removeRightEdgePointerListeners: (() => void) | null = null;
  let removeLeftEdgePointerListeners: (() => void) | null = null;
  let floatingGroupDisposables: Array<{ dispose: () => void }> = [];
  type FloatingContainerBounds = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>;
  type FloatingGroupSnapshot = {
    bounds: AnchoredBox;
    container: FloatingContainerBounds;
  };
  const floatingGroupBounds = new Map<string, FloatingGroupSnapshot>();
  const restoredFloatingPanels = new Set<string>();
  const floatingGroupOverlayDisposables = new Map<string, Array<{ dispose: () => void }>>();
  let floatingLayoutFrame: number | null = null;
  let previousTopEdgeBounds: { left: number; top: number; width: number; height: number } | undefined;
  let previousFloatingContainerBounds: FloatingContainerBounds | undefined;
  let floatingContainerResizeObserver: ResizeObserver | null = null;
  let floatingTitlebarObserver: MutationObserver | null = null;
  let floatingVisibilityLayoutFrame: number | null = null;
  let previousDockviewVisibility = visible;
  let tabDragVisibility: {
    top: { visible: boolean; hasContent: boolean };
    right: { visible: boolean; hasContent: boolean };
    left: { visible: boolean; hasContent: boolean };
  } | null = null;
  let removeTabDragEndListeners: (() => void) | null = null;
  let tabDragRestoreFrame: number | null = null;
  const panelPlacementUpdaters = new Map<string, (placement: DockviewPanelPlacement) => void>();
  const debugConsolePanelUpdaters = new Map<string, (panel: DockviewDebugConsolePanelDefinition) => void>();
  const debugConsolePlacementUpdaters = new Map<string, (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void>();
  const notesPanelUpdaters = new Map<string, (panel: DockviewNotesPanelDefinition) => void>();
  const notesPlacementUpdaters = new Map<string, (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void>();
  const treeDataPanelUpdaters = new Map<string, (panel: DockviewTreeDataPanelDefinition) => void>();
  const treeDataPlacementUpdaters = new Map<string, (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void>();
  const dummyWindowPlacementUpdaters = new Map<string, (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void>();
  const suppressDebugConsoleClose = new Set<string>();
  const suppressNotesClose = new Set<string>();
  const suppressTreeDataClose = new Set<string>();
  const suppressDummyWindowClose = new Set<string>();
  const edgeGroupCustomActionIds = new Set<string>();
  const headerActionRenderers = new Set<() => void>();
  let syncDebugConsolePanel: (() => void) | null = null;
  let syncNotesPanel: (() => void) | null = null;
  let syncTreeDataPanels: (() => void) | null = null;
  let syncDummyWindowPanels: (() => void) | null = null;
  let focusDockviewPanel: ((panelId: string) => void) | null = null;
  let lastHandledFocusSurfaceRequestVersion = 0;
  let debugConsolePanelId: string | null = null;
  let notesPanelId: string | null = null;
  const treeDataPanelIds = new Set<string>();
  const dummyWindowPanelIds = new Set<string>();
  const FLOATING_TITLEBAR_TOOLTIP = 'Hold SHIFT while dragging to re-dock this panel';
  const DEFAULT_FLOATING_PANEL_WIDTH = 375;

  const AUTO_HIDE_DELAY_MS = 2000;
  type EdgeGroupPosition = 'top' | 'right' | 'left';

  function getEdgeGroup(position: EdgeGroupPosition) {
    if (position === 'top') return topEdgeGroup;
    return position === 'right' ? rightEdgeGroup : leftEdgeGroup;
  }

  function addPanelToFloating(panel: IDockviewPanel): void {
    dockview?.api.addFloatingGroup(panel, { width: DEFAULT_FLOATING_PANEL_WIDTH });
  }

  function restoreFloatingPanelBounds(panel: IDockviewPanel): void {
    const params = panel.params as {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    };
    if (!params.position || !params.size) return;
    const floatingWindow = dockview?.getFloatingWindowForGroup(panel.group);
    if (!floatingWindow) return;
    floatingWindow.position({
      left: params.position.x,
      top: params.position.y,
      width: params.size.width,
      height: params.size.height,
    });
  }

  function setEdgeGroupHidden(position: EdgeGroupPosition, hidden: boolean): void {
    if (position === 'top') {
      topEdgeHidden = hidden;
    } else if (position === 'right') {
      rightEdgeHidden = hidden;
    } else {
      leftEdgeHidden = hidden;
    }
  }

  const dropPositionResolver: PositionResolver = {
    resolve(args: PositionResolverArgs) {
      if (args.zones.has('center')) {
        return null;
      }

      if (args.zones.has('left')) {
        return { position: 'left' };
      }

      if (args.zones.has('right')) {
        return { position: 'right' };
      }

      if (args.zones.has('top')) {
        return { position: 'top' };
      }

      if (args.zones.has('bottom')) {
        return { position: 'bottom' };
      }

      return null;
    },
  };

  function getTranscriptWorkspaceProps() {
    return {
      activeBar,
      transcript,
      outputRevision,
      width: workspaceWidth,
      outputFontSize,
      scope,
      visible,
      triggers,
      linkImagePreviews,
      imagePreviewCacheVersion,
      renderCache,
      showCurrentOutputWhenScrollingUp,
      transcriptDiagnosticsEnabled,
      userScrolled,
      canReconnect,
      canDisconnect,
      canQuickLog,
      canStopLogging,
      canEditWorld,
      canEditCharacter,
      onReconnect,
      onDisconnect,
      onQuickLog,
      onStopLogging,
      onOpenLogging,
      onEditWorld,
      onEditCharacter,
      onOpenNotes,
      onOpenDebugConsole,
      onOpenTriggers,
      onOpenStyles,
      onCloseRequest,
      onScroll,
      onScrollToBottom,
    };
  }

  $: {
    activeBar;
    transcript;
    outputRevision;
    workspaceWidth;
    outputFontSize;
    scope;
    visible;
    triggers;
    linkImagePreviews;
    imagePreviewCacheVersion;
    renderCache;
    showCurrentOutputWhenScrollingUp;
    transcriptDiagnosticsEnabled;
    userScrolled;
    canReconnect;
    canDisconnect;
    canQuickLog;
    canStopLogging;
    canEditWorld;
    canEditCharacter;
    debugConsolePanel;
    notesPanel;
    treeDataPanels;
    dummyPanels;
    focusSurfaceRequestVersion;
    if (visible !== previousDockviewVisibility) {
      previousDockviewVisibility = visible;
      if (visible) {
        if (floatingVisibilityLayoutFrame !== null) {
          cancelAnimationFrame(floatingVisibilityLayoutFrame);
        }

        floatingVisibilityLayoutFrame = requestAnimationFrame(() => {
          floatingVisibilityLayoutFrame = null;
          if (!dockview || !dockRoot || !visible) {
            return;
          }

          dockview.layout(dockRoot.clientWidth, dockRoot.clientHeight, true);
          scheduleFloatingGroupReposition();
        });
      }
    }
    updateWorkspaceTranscript?.();
    syncDebugConsolePanel?.();
    syncNotesPanel?.();
    syncTreeDataPanels?.();
    syncDummyWindowPanels?.();
    topActions;
    headerActionRenderers.forEach((render) => render());
    if (focusSurfaceId
      && focusSurfaceRequestVersion !== lastHandledFocusSurfaceRequestVersion
      && focusDockviewPanel) {
      focusDockviewPanel(focusSurfaceId);
      lastHandledFocusSurfaceRequestVersion = focusSurfaceRequestVersion;
    }
  }

  function clearHideTimer(position: EdgeGroupPosition): void {
    if (position === 'top') {
      if (topHideTimer !== null) {
        clearTimeout(topHideTimer);
        topHideTimer = null;
      }
      return;
    }

    if (position === 'right' && rightHideTimer !== null) {
      clearTimeout(rightHideTimer);
      rightHideTimer = null;
    }
    if (position === 'left' && leftHideTimer !== null) {
      clearTimeout(leftHideTimer);
      leftHideTimer = null;
    }
  }

  function revealEdgeGroup(position: EdgeGroupPosition): void {
    const group = getEdgeGroup(position);
    if (!dockview || !group) {
      return;
    }

    if (!hasEdgeGroupContent(position)) {
      hideEmptyEdgeGroup(position);
      return;
    }

    if (!group.isCollapsed()) {
      return;
    }

    clearHideTimer(position);
    dockview.setEdgeGroupVisible(position, true);

    setEdgeGroupHidden(position, false);
  }

  function keepEdgeGroupVisibleDuringTabDrag(position: EdgeGroupPosition): boolean {
    if (!tabDragVisibility || !dockview) {
      return false;
    }

    clearHideTimer(position);
    dockview.setEdgeGroupVisible(position, true);
    setEdgeGroupHidden(position, false);
    return true;
  }

  function hideEdgeGroup(position: EdgeGroupPosition): void {
    const group = getEdgeGroup(position);
    if (!dockview || !group) {
      return;
    }

    if (keepEdgeGroupVisibleDuringTabDrag(position)) {
      return;
    }

    if (!hasEdgeGroupContent(position)) {
      hideEmptyEdgeGroup(position);
      return;
    }

    if (!group.isCollapsed()) {
      return;
    }

    clearHideTimer(position);
    dockview.setEdgeGroupVisible(position, false);

    setEdgeGroupHidden(position, true);
  }

  function scheduleHideEdgeGroup(position: EdgeGroupPosition): void {
    const group = getEdgeGroup(position);
    if (!group || !group.isCollapsed()) {
      return;
    }

    if (keepEdgeGroupVisibleDuringTabDrag(position)) {
      return;
    }

    clearHideTimer(position);

    const handleHide = () => hideEdgeGroup(position);
    if (position === 'top') {
      topHideTimer = setTimeout(handleHide, AUTO_HIDE_DELAY_MS);
      return;
    }

    if (position === 'right') {
      rightHideTimer = setTimeout(handleHide, AUTO_HIDE_DELAY_MS);
    } else {
      leftHideTimer = setTimeout(handleHide, AUTO_HIDE_DELAY_MS);
    }
  }

  function handleSandboxMouseEnter(): void {
    clearHideTimer('top');
    clearHideTimer('right');
    clearHideTimer('left');
  }

  function handleSandboxMouseLeave(): void {
    scheduleHideEdgeGroup('top');
    scheduleHideEdgeGroup('right');
    scheduleHideEdgeGroup('left');
  }

  function attachEdgeGroupPointerListeners(position: EdgeGroupPosition, id: string): void {
    const groupElement = dockRoot?.querySelector<HTMLElement>(`[data-testid="dv-edge-group-${id}"]`);
    if (!groupElement) {
      return;
    }

    const handlePointerEnter = () => clearHideTimer(position);
    const handlePointerLeave = () => scheduleHideEdgeGroup(position);

    groupElement.addEventListener('pointerenter', handlePointerEnter);
    groupElement.addEventListener('pointerleave', handlePointerLeave);

    const removeListeners = () => {
      groupElement.removeEventListener('pointerenter', handlePointerEnter);
      groupElement.removeEventListener('pointerleave', handlePointerLeave);
    };

    if (position === 'top') {
      removeTopEdgePointerListeners = removeListeners;
    } else if (position === 'right') {
      removeRightEdgePointerListeners = removeListeners;
    } else {
      removeLeftEdgePointerListeners = removeListeners;
    }
  }

  function hasEdgeGroupContent(position: EdgeGroupPosition): boolean {
    const group = dockview?.getEdgeGroupPanel(position);
    return (group?.panels.length ?? 0) > 0 || (group ? edgeGroupCustomActionIds.has(group.id) : false);
  }

  function hideEmptyEdgeGroup(position: EdgeGroupPosition): void {
    if (keepEdgeGroupVisibleDuringTabDrag(position)) {
      return;
    }

    clearHideTimer(position);
    dockview?.setEdgeGroupVisible(position, false);

    setEdgeGroupHidden(position, false);
  }

  function initializeEdgeGroup(
    position: EdgeGroupPosition,
    group: ReturnType<DockviewComponent['addEdgeGroup']>,
    id: string,
  ): void {
    if (!hasEdgeGroupContent(position)) {
      hideEmptyEdgeGroup(position);
      return;
    }

    group.collapse();
    dockview?.setEdgeGroupVisible(position, true);
    scheduleHideEdgeGroup(position);
  }

  function revealEdgeGroupsForTabDrag(): void {
    if (!dockview || tabDragVisibility) {
      return;
    }

    tabDragVisibility = {
      top: {
        visible: dockview.isEdgeGroupVisible('top'),
        hasContent: hasEdgeGroupContent('top'),
      },
      right: {
        visible: dockview.isEdgeGroupVisible('right'),
        hasContent: hasEdgeGroupContent('right'),
      },
      left: {
        visible: dockview.isEdgeGroupVisible('left'),
        hasContent: hasEdgeGroupContent('left'),
      },
    };

    for (const position of ['top', 'right', 'left'] as const) {
      clearHideTimer(position);
      const group = getEdgeGroup(position);
      if (group && !dockview.isEdgeGroupVisible(position)) {
        group.collapse();
      }
      dockview.setEdgeGroupVisible(position, true);
      setEdgeGroupHidden(position, false);
    }
  }

  function restoreEdgeGroupsAfterTabDrag(): void {
    const previousVisibility = tabDragVisibility;
    if (!previousVisibility || !dockview) {
      return;
    }

    tabDragVisibility = null;
    removeTabDragEndListeners?.();
    removeTabDragEndListeners = null;

    for (const position of ['top', 'right', 'left'] as const) {
      const group = getEdgeGroup(position);
      const hasContent = hasEdgeGroupContent(position);

      if (previousVisibility[position].visible) {
        if (group?.isCollapsed()) {
          scheduleHideEdgeGroup(position);
        }
        continue;
      }

      if (!group) {
        continue;
      }

      if (!previousVisibility[position].hasContent && hasContent) {
        clearHideTimer(position);
        dockview.setEdgeGroupVisible(position, true);
        setEdgeGroupHidden(position, false);

        if (group.isCollapsed()) {
          scheduleHideEdgeGroup(position);
        }
        continue;
      }

      if (hasContent && !group.isCollapsed()) {
        continue;
      }

      if (hasContent) {
        hideEdgeGroup(position);
      } else {
        hideEmptyEdgeGroup(position);
      }
    }
  }

  function scheduleTabDragRestore(): void {
    if (tabDragRestoreFrame !== null) {
      return;
    }

    tabDragRestoreFrame = requestAnimationFrame(() => {
      tabDragRestoreFrame = null;
      restoreEdgeGroupsAfterTabDrag();
    });
  }

  function beginTabDragVisibility(): void {
    revealEdgeGroupsForTabDrag();
    if (removeTabDragEndListeners) {
      return;
    }

    const finish = () => scheduleTabDragRestore();
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
    window.addEventListener('dragend', finish, { once: true });
    removeTabDragEndListeners = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('dragend', finish);
    };
  }

  function configureFloatingGroup(group: ReturnType<DockviewComponent['addGroup']>): void {
    const applyFloatingGroupPolicy = () => {
      group.header.hidden = group.api.location.type === 'floating';
      trackFloatingGroup(group);
    };

    floatingGroupDisposables.push(group.api.onDidLocationChange(applyFloatingGroupPolicy));
    floatingGroupDisposables.push(group.api.onDidActivePanelChange(applyFloatingTitlebarTooltips));
    applyFloatingGroupPolicy();
  }

  function trackFloatingGroup(group: ReturnType<DockviewComponent['addGroup']>): void {
    const floatingWindow = dockview?.getFloatingWindowForGroup(group);
    const existingDisposables = floatingGroupOverlayDisposables.get(group.id);

    if (group.api.location.type !== 'floating' || !floatingWindow) {
      clearFloatingGroupTracking(group.id);
      return;
    }

    if (!existingDisposables) {
      const disposables = [
        floatingWindow.overlay.onDidChangeEnd(() => {
          captureFloatingGroupBoundsForWindow(floatingWindow);
        }),
      ];
      floatingGroupOverlayDisposables.set(group.id, disposables);
    }

    captureFloatingGroupBoundsForWindow(floatingWindow);
  }

  function clearFloatingGroupTracking(groupId: string): void {
    floatingGroupOverlayDisposables.get(groupId)?.forEach((disposable) => disposable.dispose());
    floatingGroupOverlayDisposables.delete(groupId);
    floatingGroupBounds.delete(groupId);
  }

  function getTopEdgeBounds(): { left: number; top: number; width: number; height: number } | undefined {
    return dockview?.getEdgeGroupPanel('top')?.api.boundingBox;
  }

  function getFloatingContainerBounds(): FloatingContainerBounds | undefined {
    const container = dockview?.getFloatingContainer();
    if (!container) {
      return undefined;
    }

    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return undefined;
    }

    return {
      top: bounds.top,
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
    };
  }

  function sameBounds(
    first: { left: number; top: number; width: number; height: number } | undefined,
    second: { left: number; top: number; width: number; height: number } | undefined,
  ): boolean {
    return first?.left === second?.left
      && first?.top === second?.top
      && first?.width === second?.width
      && first?.height === second?.height;
  }

  function sameFloatingContainerBounds(
    first: FloatingContainerBounds | undefined,
    second: FloatingContainerBounds | undefined,
  ): boolean {
    return first?.top === second?.top
      && first?.bottom === second?.bottom
      && first?.left === second?.left
      && first?.right === second?.right;
  }

  function captureFloatingGroupBounds(): void {
    dockview?.floatingGroups.forEach((floatingWindow) => {
      trackFloatingGroup(floatingWindow.group);
    });
  }

  function captureFloatingGroupBoundsForWindow(
    floatingWindow: DockviewComponent['floatingGroups'][number],
  ): void {
    const container = getFloatingContainerBounds();
    if (!container) {
      return;
    }

    floatingGroupBounds.set(floatingWindow.group.id, {
      bounds: floatingWindow.overlay.toJSON(),
      container,
    });
    const bounds = floatingWindow.overlay.toJSON() as Record<string, number>;
    const left = bounds.left ?? 0;
    const top = bounds.top ?? 0;
    floatingWindow.group.panels.forEach((panel) => {
      const params = panel.params as {
        onBoundsChange?: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
      };
      if (typeof bounds.width === 'number' && typeof bounds.height === 'number') {
        params.onBoundsChange?.({ x: left, y: top }, { width: bounds.width, height: bounds.height });
      }
    });
  }

  function translateFloatingBounds(
    snapshot: FloatingGroupSnapshot,
    container: FloatingContainerBounds,
  ): AnchoredBox {
    const bounds = { ...snapshot.bounds } as Record<
      'top' | 'bottom' | 'left' | 'right' | 'width' | 'height',
      number
    >;

    if ('top' in snapshot.bounds) {
      bounds.top = snapshot.container.top + snapshot.bounds.top - container.top;
    } else if ('bottom' in snapshot.bounds) {
      bounds.bottom = container.bottom - (snapshot.container.bottom - snapshot.bounds.bottom);
    }

    if ('left' in snapshot.bounds) {
      bounds.left = snapshot.container.left + snapshot.bounds.left - container.left;
    } else if ('right' in snapshot.bounds) {
      bounds.right = container.right - (snapshot.container.right - snapshot.bounds.right);
    }

    return bounds as AnchoredBox;
  }

  function scheduleFloatingGroupReposition(): void {
    if (floatingLayoutFrame !== null) {
      cancelAnimationFrame(floatingLayoutFrame);
    }

    floatingLayoutFrame = requestAnimationFrame(() => {
      floatingLayoutFrame = null;

      const currentTopEdgeBounds = getTopEdgeBounds();
      const topEdgeChanged = !sameBounds(previousTopEdgeBounds, currentTopEdgeBounds);
      const currentFloatingContainerBounds = getFloatingContainerBounds();
      if (!currentFloatingContainerBounds) {
        return;
      }

      const floatingContainerChanged = !sameFloatingContainerBounds(
        previousFloatingContainerBounds,
        currentFloatingContainerBounds,
      );

      if (topEdgeChanged || floatingContainerChanged) {
        dockview?.floatingGroups.forEach((floatingWindow) => {
          const previousSnapshot = floatingGroupBounds.get(floatingWindow.group.id);
          if (previousSnapshot) {
            floatingWindow.position(
              translateFloatingBounds(previousSnapshot, currentFloatingContainerBounds),
            );
          }
        });
      }

      previousTopEdgeBounds = currentTopEdgeBounds;
      previousFloatingContainerBounds = currentFloatingContainerBounds;
      captureFloatingGroupBounds();
    });
  }

  function clampFloatingGroupDrag({
    group,
    proposed,
  }: FloatingGroupDragContext): { top: number; left: number } | void {
    const container = dockview?.getFloatingContainer();
    const shell = dockRoot;
    if (!container || !shell) {
      return;
    }

    const containerBounds = container.getBoundingClientRect();
    const shellBounds = shell.getBoundingClientRect();
    const titlebarHeight = dockview?.getFloatingWindowForGroup(group)?.overlay.headerHeight ?? 0;

    const minimumTop = shellBounds.top - containerBounds.top;
    const maximumTop = Math.max(
      minimumTop,
      shellBounds.bottom - containerBounds.top - titlebarHeight,
    );
    const minimumLeft = shellBounds.left - containerBounds.left;
    const maximumLeft = Math.max(
      minimumLeft,
      shellBounds.right - containerBounds.left - proposed.width,
    );

    return {
      top: Math.min(Math.max(proposed.top, minimumTop), maximumTop),
      left: Math.min(Math.max(proposed.left, minimumLeft), maximumLeft),
    };
  }

  function applyFloatingTitlebarTooltips(): void {
    dockRoot?.querySelectorAll<HTMLElement>('.dv-tab').forEach((tab) => {
      if (tab.closest('.dv-resize-container-with-titlebar')) {
        return;
      }

      tab.title = FLOATING_TITLEBAR_TOOLTIP;
    });

    dockview?.floatingGroups.forEach((floatingWindow) => {
      const titlebar = floatingWindow.overlay.element.querySelector<HTMLElement>('.dv-floating-titlebar');
      if (!titlebar) {
        return;
      }

      const panelTitle = floatingWindow.group.activePanel?.api.title ?? floatingWindow.group.activePanel?.title;
      const tooltip = panelTitle
        ? `${panelTitle} — ${FLOATING_TITLEBAR_TOOLTIP}`
        : FLOATING_TITLEBAR_TOOLTIP;
      titlebar.title = tooltip;
      if (titlebar.getAttribute('aria-label') !== tooltip) {
        titlebar.setAttribute('aria-label', tooltip);
      }
    });
  }

  function getPanelPlacement(panel: { group: { api: { location: { type: string } } } }): DockviewPanelPlacement {
    const locationType = panel.group.api.location.type;
    return locationType === 'edge' || locationType === 'floating' || locationType === 'popout'
      ? locationType
      : 'grid';
  }

  function getPanelEdge(panel: { group: { api: { location: { type: string; position?: string } } } }): SurfaceEdge | undefined {
    const position = panel.group.api.location.position;
    return panel.group.api.location.type === 'edge'
      && (position === 'top' || position === 'right' || position === 'bottom' || position === 'left')
      ? position
      : undefined;
  }

  function updatePanelPlacement(panel: { id: string; group: { api: { location: { type: string } } } }): void {
    const panelWithParams = panel as typeof panel & { params?: { initialPlacement?: DockviewPanelPlacement } };
    if (panelWithParams.params?.initialPlacement === 'floating'
      && !restoredFloatingPanels.has(panel.id)
      && panel.group.api.location.type !== 'floating') {
      restoredFloatingPanels.add(panel.id);
      addPanelToFloating(panel as IDockviewPanel);
      restoreFloatingPanelBounds(panel as IDockviewPanel);
    }
    const placement = getPanelPlacement(panel);
    panelPlacementUpdaters.get(panel.id)?.(placement);
    debugConsolePlacementUpdaters.get(panel.id)?.(placement, getPanelEdge(panel));
    notesPlacementUpdaters.get(panel.id)?.(placement, getPanelEdge(panel));
    treeDataPlacementUpdaters.get(panel.id)?.(placement, getPanelEdge(panel));
    dummyWindowPlacementUpdaters.get(panel.id)?.(placement, getPanelEdge(panel));
  }

  function bringPanelToFront(panel: {
    api: { setActive: () => void };
    group: DockviewGroupPanel;
  }): void {
    const location = panel.group.api.location;
    if (location.type === 'edge'
      && (location.position === 'top' || location.position === 'right' || location.position === 'left')) {
      revealEdgeGroup(location.position);
    }

    panel.api.setActive();
    dockview?.getFloatingWindowForGroup(panel.group)?.overlay.bringToFront();
  }

  onMount(() => {
    if (!dockRoot) {
      return;
    }

    dockview = new DockviewComponent(dockRoot, {
      theme: getDockviewTheme(dockviewThemeId),
      className: getDockviewTheme(dockviewThemeId).className,
      defaultHeaderPosition: 'top',
      dndStrategy: 'pointer',
      dropPositionResolver,
      transformFloatingGroupDrag: clampFloatingGroupDrag,
      // Floating panels may intentionally extend above the center viewport
      // when the top edge group occupies part of the window. The host-level
      // repositioning logic keeps their window-relative position stable.
      floatingGroupBounds: {
        minimumHeightWithinViewport: 0,
        minimumWidthWithinViewport: 100,
      },
      createRightHeaderActionComponent: (group) => {
        const element = document.createElement('div');
        element.className = 'play-dockview-header-action-shell';
        let removeClickListener: (() => void) | null = null;
        let removeLocationListener: { dispose: () => void } | null = null;
        let currentLocation = group.api.location;

        function render(): void {
          element.replaceChildren();

          const hasCustomAction =
            topActions.length > 0
            && currentLocation.type === 'edge'
            && currentLocation.position === 'top';

          if (hasCustomAction) {
            edgeGroupCustomActionIds.add(group.id);
            for (const action of topActions) {
              if (action.kind === 'button') {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'play-dockview-header-action';
                button.textContent = action.label;
                button.title = action.title ?? action.label;
                button.disabled = action.disabled ?? false;
                button.addEventListener('click', action.onClick);
                element.appendChild(button);
                continue;
              }

              const select = document.createElement('select');
              select.className = 'play-dockview-header-action play-dockview-header-select';
              select.title = action.title ?? action.label;
              select.setAttribute('aria-label', action.title ?? action.label);
              select.disabled = action.disabled ?? false;
              for (const option of action.options) {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                optionElement.selected = option.value === action.value;
                select.appendChild(optionElement);
              }
              select.addEventListener('change', () => action.onChange(select.value));
              element.appendChild(select);
            }
          } else {
            edgeGroupCustomActionIds.delete(group.id);
          }
        }

        return {
          element,
          init() {
            render();
            const refresh = () => render();
            headerActionRenderers.add(refresh);
            removeClickListener = () => headerActionRenderers.delete(refresh);

            removeLocationListener = group.api.onDidLocationChange((event) => {
              currentLocation = event.location;
              render();
            });
          },
          update() {
            currentLocation = group.api.location;
            render();
          },
          dispose() {
            removeClickListener?.();
            removeClickListener = null;
            removeLocationListener?.dispose();
            removeLocationListener = null;
            edgeGroupCustomActionIds.delete(group.id);
            element.replaceChildren();
          },
        };
      },
      createComponent: ({ id }) => {
        const element = document.createElement('div');
        element.className = 'play-dockview-workspace-shell';
        const panelId = id;
        let mountedTranscript: Record<string, unknown> | null = null;
        let mountFrame: number | null = null;
        let mountedDummy: Record<string, unknown> | null = null;
        let mountedDebugConsole: Record<string, unknown> | null = null;
        let mountedNotes: Record<string, unknown> | null = null;
        let mountedTreeData: Record<string, unknown> | null = null;
        let mountedDummyWindow: Record<string, unknown> | null = null;

        async function mountWorkspaceTranscript(): Promise<void> {
          if (mountedTranscript) {
            await unmount(mountedTranscript);
            mountedTranscript = null;
          }

          element.replaceChildren();
          mountedTranscript = mount(Transcript, {
            target: element,
            props: {
              ...getTranscriptWorkspaceProps(),
              workspaceState: workspaceTranscriptState,
            },
          });

          workspaceTranscriptState.set(getTranscriptWorkspaceProps());
          updateWorkspaceTranscript = () => workspaceTranscriptState.set(getTranscriptWorkspaceProps());

          queueMicrotask(() => {
            dockviewInstance.layout(dockRoot?.clientWidth ?? 0, dockRoot?.clientHeight ?? 0, true);
          });
        }

        function scheduleWorkspaceTranscriptMount(): void {
          if (mountFrame !== null) {
            cancelAnimationFrame(mountFrame);
          }

          mountFrame = requestAnimationFrame(() => {
            mountFrame = null;
            void mountWorkspaceTranscript();
          });
        }

        return {
          element,
          init(params) {
            const definition = params.params as SandboxPanelParamsWithSurface | undefined;
            if (definition && 'kind' in definition && definition.kind === 'debug-console') {
              const panelPlacement = writable<DockviewPanelPlacement>('grid');
              const model = writable(definition.model);
              mountedDebugConsole = mount(DockviewDebugConsolePanel, {
                target: element,
                props: {
                  model,
                  panelPlacement,
                  onCommand: definition.onCommand,
                  onPromoteToFloating: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      addPanelToFloating(panel);
                    }
                  },
                  onDockToEdge: () => {
                    const panel = findPanel(panelId);
                    const edge = definition.getPreviousDockedEdge() ?? 'top';
                    const dockGroup = dockviewInstance.getEdgeGroupPanel(edge)
                      ?? dockviewInstance.getEdgeGroupPanel('top');
                    if (panel && dockGroup) {
                      panel.api.moveTo({ group: dockGroup, position: 'center' });
                    }
                  },
                  onPopOutNative: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      suppressDebugConsoleClose.add(panelId);
                      dockviewInstance.removePanel(panel);
                    }
                    definition.onPopOutNative();
                  },
                },
              });
              debugConsolePanelUpdaters.set(panelId, (nextPanel) => {
                model.set(nextPanel.model);
              });
              panelPlacementUpdaters.set(panelId, (placement) => panelPlacement.set(placement));
              debugConsolePlacementUpdaters.set(panelId, definition.onPlacementChange);
              return;
            }

            if (definition && 'kind' in definition && definition.kind === 'notes') {
              const panelPlacement = writable<DockviewPanelPlacement>('grid');
              const model = writable(definition.model);
              mountedNotes = mount(DockviewNotesPanel, {
                target: element,
                props: {
                  model,
                  panelPlacement,
                  onCommand: definition.onCommand,
                  onPromoteToFloating: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      addPanelToFloating(panel);
                    }
                  },
                  onDockToEdge: () => {
                    const panel = findPanel(panelId);
                    const edge = definition.getPreviousDockedEdge() ?? 'top';
                    const dockGroup = dockviewInstance.getEdgeGroupPanel(edge)
                      ?? dockviewInstance.getEdgeGroupPanel('top');
                    if (panel && dockGroup) {
                      panel.api.moveTo({ group: dockGroup, position: 'center' });
                    }
                  },
                  onPopOutNative: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      suppressNotesClose.add(panelId);
                      dockviewInstance.removePanel(panel);
                    }
                    definition.onPopOutNative();
                  },
                },
              });
              notesPanelUpdaters.set(panelId, (nextPanel) => {
                model.set(nextPanel.model);
              });
              panelPlacementUpdaters.set(panelId, (placement) => panelPlacement.set(placement));
              notesPlacementUpdaters.set(panelId, (placement, edge) => {
                definition.onPlacementChange(placement, edge);
              });
              return;
            }

            if (definition && 'kind' in definition && definition.kind === 'tree-data') {
              const panelPlacement = writable<DockviewPanelPlacement>('grid');
              const model = writable(definition.model);
              const viewState = writable(definition.viewState);
              mountedTreeData = mount(DockviewTreeDataPanel, {
                target: element,
                props: {
                  model,
                  viewState,
                  panelPlacement,
                  onCommand: definition.onCommand,
                  onPromoteToFloating: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      addPanelToFloating(panel);
                    }
                  },
                  onDockToEdge: () => {
                    const panel = findPanel(panelId);
                    const edge = definition.getPreviousDockedEdge() ?? 'top';
                    const dockGroup = dockviewInstance.getEdgeGroupPanel(edge)
                      ?? dockviewInstance.getEdgeGroupPanel('top');
                    if (panel && dockGroup) {
                      panel.api.moveTo({ group: dockGroup, position: 'center' });
                    }
                  },
                  onPopOutNative: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      suppressTreeDataClose.add(panelId);
                      dockviewInstance.removePanel(panel);
                    }
                    definition.onPopOutNative();
                  },
                  onClose: definition.onClose,
                },
              });
              treeDataPanelUpdaters.set(panelId, (nextPanel) => {
                model.set(nextPanel.model);
                viewState.set(nextPanel.viewState);
              });
              panelPlacementUpdaters.set(panelId, (placement) => panelPlacement.set(placement));
              treeDataPlacementUpdaters.set(panelId, (placement, edge) => {
                definition.onPlacementChange(placement, edge);
              });
              return;
            }

            if (definition && 'kind' in definition && definition.kind === 'dummy-window') {
              const panelPlacement = writable<DockviewPanelPlacement>('grid');
              mountedDummyWindow = mount(DockviewDummyPanel, {
                target: element,
                props: {
                  title: definition.title,
                  eyebrow: definition.eyebrow,
                  description: definition.description,
                  tone: definition.tone,
                  panelPlacement,
                  onPromoteToFloating: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      addPanelToFloating(panel);
                    }
                  },
                  onDockToEdge: () => {
                    const panel = findPanel(panelId);
                    const edge = definition.getPreviousDockedEdge() ?? 'top';
                    const dockGroup = dockviewInstance.getEdgeGroupPanel(edge)
                      ?? dockviewInstance.getEdgeGroupPanel('top');
                    if (panel && dockGroup) {
                      panel.api.moveTo({ group: dockGroup, position: 'center' });
                    }
                  },
                  onPopOutNative: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      suppressDummyWindowClose.add(panelId);
                      dockviewInstance.removePanel(panel);
                    }
                    definition.onPopOutNative();
                  },
                  onClose: definition.onClose,
                },
              });
              panelPlacementUpdaters.set(panelId, (placement) => panelPlacement.set(placement));
              dummyWindowPlacementUpdaters.set(panelId, definition.onPlacementChange);
              return;
            }

            if (!definition || definition.title !== 'Transcript Workspace') {
              const panelPlacement = writable<DockviewPanelPlacement>('grid');
              mountedDummy = mount(DockviewDummyPanel, {
                target: element,
                props: {
                  ...(definition ?? { title: '', eyebrow: '', description: '', tone: 'muted' }),
                  panelPlacement,
                  onPromoteToFloating: () => {
                    const panel = findPanel(panelId);
                    if (panel) {
                      addPanelToFloating(panel);
                    }
                  },
                  onDockToEdge: () => {
                    const panel = findPanel(panelId);
                    const topGroup = dockviewInstance.getEdgeGroupPanel('top');
                    if (panel && topGroup) {
                      panel.api.moveTo({ group: topGroup, position: 'center' });
                    }
                  },
                  onPopOutNative: () => console.debug('[play-dockview] dummy native pop-out requested'),
                  onPopInNative: () => console.debug('[play-dockview] dummy native pop-in requested'),
                },
              });
              panelPlacementUpdaters.set(panelId, (placement) => panelPlacement.set(placement));
              return;
            }

            scheduleWorkspaceTranscriptMount();
          },
          update(params) {
            const definition = params.params as SandboxPanelDefinition | undefined;
            if (!definition || definition.title !== 'Transcript Workspace') {
              return;
            }

            scheduleWorkspaceTranscriptMount();
          },
        dispose() {
            if (mountFrame !== null) {
              cancelAnimationFrame(mountFrame);
              mountFrame = null;
            }
            void (mountedTranscript ? unmount(mountedTranscript) : Promise.resolve());
            void (mountedDummy ? unmount(mountedDummy) : Promise.resolve());
            void (mountedDebugConsole ? unmount(mountedDebugConsole) : Promise.resolve());
            void (mountedNotes ? unmount(mountedNotes) : Promise.resolve());
            void (mountedTreeData ? unmount(mountedTreeData) : Promise.resolve());
            void (mountedDummyWindow ? unmount(mountedDummyWindow) : Promise.resolve());
            panelPlacementUpdaters.delete(panelId);
            debugConsolePanelUpdaters.delete(panelId);
            debugConsolePlacementUpdaters.delete(panelId);
            notesPanelUpdaters.delete(panelId);
            notesPlacementUpdaters.delete(panelId);
            treeDataPanelUpdaters.delete(panelId);
            treeDataPlacementUpdaters.delete(panelId);
            dummyWindowPlacementUpdaters.delete(panelId);
            mountedTranscript = null;
            mountedDummy = null;
            mountedDebugConsole = null;
            mountedNotes = null;
            mountedTreeData = null;
            mountedDummyWindow = null;
            updateWorkspaceTranscript = null;
            element.replaceChildren();
          },
        };
      },
    });

    const focusInputAfterPanelClick = (): void => {
      requestAnimationFrame(() => onFocusInput());
    };
    const removeActivePanelListener = dockview.onDidActivePanelChange(({ panel }) => {
      if (panel) {
        focusInputAfterPanelClick();
      }
    });
    const handlePanelTabPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('.dv-tab')) {
        focusInputAfterPanelClick();
      }
    };
    dockRoot.addEventListener('pointerdown', handlePanelTabPointerDown, true);

    dockview.onDidAddGroup(configureFloatingGroup);
    floatingTitlebarObserver = new MutationObserver(applyFloatingTitlebarTooltips);
    floatingTitlebarObserver.observe(dockRoot, {
      childList: true,
      subtree: true,
    });
    applyFloatingTitlebarTooltips();

    dockview.onWillDragPanel((event) => {
      beginTabDragVisibility();
      console.debug('[play-dockview] drag start', {
        panelId: event.panel.id,
        groupId: event.panel.group.id,
      });
    });
    const removeTabDropListener = dockview.onDidDrop(scheduleTabDragRestore);

    dockview.onDidMovePanel((event) => {
      console.debug('[play-dockview] panel moved', {
        panelId: event.panel.id,
        from: event.from.id,
        to: event.to.id,
      });
      updatePanelPlacement(event.panel);
    });

    topEdgeGroup = dockview.addEdgeGroup('top', {
      id: 'play-dockview-top',
      initialSize: 168,
      minimumSize: 120,
    });
    topEdgeGroup.onDidCollapsedChange((event) => {
      topEdgeHidden = false;
      dockview?.setEdgeGroupVisible('top', true);

      if (event.isCollapsed) {
        scheduleHideEdgeGroup('top');
      } else {
        clearHideTimer('top');
      }
    });
    topEdgeGroup.setHeaderPosition('top');

    rightEdgeGroup = dockview.addEdgeGroup('right', {
      id: 'play-dockview-right',
      initialSize: 280,
      minimumSize: 200,
    });
    rightEdgeGroup.onDidCollapsedChange((event) => {
      rightEdgeHidden = false;
      dockview?.setEdgeGroupVisible('right', true);

      if (event.isCollapsed) {
        scheduleHideEdgeGroup('right');
      } else {
        clearHideTimer('right');
      }
    });
    rightEdgeGroup.setHeaderPosition('right');

    leftEdgeGroup = dockview.addEdgeGroup('left', {
      id: 'play-dockview-left',
      initialSize: 280,
      minimumSize: 200,
    });
    leftEdgeGroup.onDidCollapsedChange((event) => {
      leftEdgeHidden = false;
      dockview?.setEdgeGroupVisible('left', true);

      if (event.isCollapsed) {
        scheduleHideEdgeGroup('left');
      } else {
        clearHideTimer('left');
      }
    });
    leftEdgeGroup.setHeaderPosition('left');

    const removeFloatingLayoutListener = dockview.onDidLayoutChange(() => {
      scheduleFloatingGroupReposition();
    });
    floatingContainerResizeObserver = new ResizeObserver(() => {
      scheduleFloatingGroupReposition();
    });
    floatingContainerResizeObserver.observe(dockview.getFloatingContainer());
    const removeFloatingGroupListener = dockview.onDidRemoveGroup((group) => {
      clearFloatingGroupTracking(group.id);
    });

    const dockviewInstance = dockview;
    const topEdgeGroupInstance = topEdgeGroup;
    const rightEdgeGroupInstance = rightEdgeGroup;
    const leftEdgeGroupInstance = leftEdgeGroup;

    function findPanel(panelId: string) {
      const edgePanels = ['top', 'right', 'left']
        .flatMap((position) => dockviewInstance.getEdgeGroupPanel(position as EdgeGroupPosition)?.panels ?? []);
      const floatingPanels = dockviewInstance.floatingGroups
        .flatMap((floatingGroup) => floatingGroup.group.panels);

      return [...dockviewInstance.panels, ...edgePanels, ...floatingPanels]
        .find((panel) => panel.id === panelId);
    }

    focusDockviewPanel = (panelId) => {
      const panel = findPanel(panelId);
      if (!panel) {
        return;
      }

      bringPanelToFront(panel);
    };

    function revealEdgeGroupForPanel(position: EdgeGroupPosition): void {
      const group = position === 'top'
        ? topEdgeGroupInstance
        : position === 'right'
          ? rightEdgeGroupInstance
          : leftEdgeGroupInstance;
      if (!group) {
        return;
      }
      group.expand();
      dockviewInstance.setEdgeGroupVisible(position, true);
      clearHideTimer(position);
      setEdgeGroupHidden(position, false);
    }

    syncDebugConsolePanel = () => {
      const panelId = debugConsolePanel?.instanceId ?? null;
      const isNewPanel = panelId !== null && debugConsolePanelId !== panelId;
      const existingPanel = [
        ...dockviewInstance.panels,
        ...['top', 'right', 'left'].flatMap((position) => dockviewInstance
          .getEdgeGroupPanel(position as EdgeGroupPosition)?.panels ?? []),
        ...dockviewInstance.floatingGroups.flatMap((floatingGroup) => floatingGroup.group.panels),
      ]
        .find((panel) => panel.id === (panelId ?? debugConsolePanelId));

      if (!debugConsolePanel) {
        if (existingPanel) {
          dockviewInstance.removePanel(existingPanel);
        }
        debugConsolePanelId = null;
        return;
      }

      debugConsolePanelUpdaters.get(debugConsolePanel.instanceId)?.(debugConsolePanel);

      if (existingPanel) {
        debugConsolePanelId = panelId;
        if (isNewPanel) {
          revealEdgeGroupForPanel('top');
        }
        updatePanelPlacement(existingPanel);
        if (isNewPanel) {
          bringPanelToFront(existingPanel);
        }
        return;
      }

      const panel = dockviewInstance.addPanel({
        id: debugConsolePanel.instanceId,
        component: 'sandbox',
        title: debugConsolePanel.title,
        params: debugConsolePanel,
        position: { referenceGroup: topEdgeGroupInstance.id },
      });
      debugConsolePanelId = panel.id;
      revealEdgeGroupForPanel('top');
      updatePanelPlacement(panel);
      bringPanelToFront(panel);
    };

    syncNotesPanel = () => {
      const panelId = notesPanel?.instanceId ?? null;
      const isNewPanel = panelId !== null && notesPanelId !== panelId;
      const existingPanel = [
        ...dockviewInstance.panels,
        ...['top', 'right', 'left'].flatMap((position) => dockviewInstance
          .getEdgeGroupPanel(position as EdgeGroupPosition)?.panels ?? []),
        ...dockviewInstance.floatingGroups.flatMap((floatingGroup) => floatingGroup.group.panels),
      ]
        .find((panel) => panel.id === (panelId ?? notesPanelId));

      if (!notesPanel) {
        if (existingPanel) {
          dockviewInstance.removePanel(existingPanel);
        }
        notesPanelId = null;
        return;
      }

      notesPanelUpdaters.get(notesPanel.instanceId)?.(notesPanel);

      if (existingPanel) {
        notesPanelId = panelId;
        if (isNewPanel) {
          revealEdgeGroupForPanel('top');
        }
        updatePanelPlacement(existingPanel);
        if (isNewPanel) {
          bringPanelToFront(existingPanel);
        }
        return;
      }

      const panel = dockviewInstance.addPanel({
        id: notesPanel.instanceId,
        component: 'sandbox',
        title: notesPanel.title,
        params: notesPanel,
        position: { referenceGroup: topEdgeGroupInstance.id },
      });
      notesPanelId = panel.id;
      revealEdgeGroupForPanel('top');
      updatePanelPlacement(panel);
      bringPanelToFront(panel);
    };

    syncTreeDataPanels = () => {
      const desiredPanelIds = new Set(treeDataPanels.map((panel) => panel.instanceId));

      for (const panelId of treeDataPanelIds) {
        if (desiredPanelIds.has(panelId)) {
          continue;
        }

        const panel = findPanel(panelId);
        if (panel) {
          suppressTreeDataClose.add(panelId);
          dockviewInstance.removePanel(panel);
        }
        treeDataPanelIds.delete(panelId);
      }

      for (const treeDataPanel of treeDataPanels) {
        const panelId = treeDataPanel.instanceId;
        const existingPanel = [
          ...dockviewInstance.panels,
          ...['top', 'right', 'left'].flatMap((position) => dockviewInstance
            .getEdgeGroupPanel(position as EdgeGroupPosition)?.panels ?? []),
          ...dockviewInstance.floatingGroups.flatMap((floatingGroup) => floatingGroup.group.panels),
        ]
          .find((panel) => panel.id === panelId);

        treeDataPanelUpdaters.get(panelId)?.(treeDataPanel);

        if (existingPanel) {
          treeDataPanelIds.add(panelId);
          updatePanelPlacement(existingPanel);
          continue;
        }

        const panel = dockviewInstance.addPanel({
          id: panelId,
          component: 'sandbox',
          title: treeDataPanel.title,
          params: treeDataPanel,
          position: { referenceGroup: topEdgeGroupInstance.id },
        });
        treeDataPanelIds.add(panelId);
        revealEdgeGroupForPanel('top');
        updatePanelPlacement(panel);
        bringPanelToFront(panel);
      }
    };

    const removeTreeDataPanelListener = dockviewInstance.onDidRemovePanel((panel) => {
      if (suppressTreeDataClose.delete(panel.id)) {
        treeDataPanelIds.delete(panel.id);
        queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
        });
        return;
      }

      if (!treeDataPanelIds.has(panel.id)) {
        return;
      }

      treeDataPanelIds.delete(panel.id);
      treeDataPanels.find((treeDataPanel) => treeDataPanel.instanceId === panel.id)?.onClose();
      queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
      });
    });

    syncDummyWindowPanels = () => {
      const desiredPanelIds = new Set(dummyPanels.map((panel) => panel.instanceId));

      for (const panelId of dummyWindowPanelIds) {
        if (desiredPanelIds.has(panelId)) {
          continue;
        }

        const panel = findPanel(panelId);
        if (panel) {
          suppressDummyWindowClose.add(panelId);
          dockviewInstance.removePanel(panel);
        }
        dummyWindowPanelIds.delete(panelId);
      }

      for (const dummyPanel of dummyPanels) {
        const panelId = dummyPanel.instanceId;
        const existingPanel = [
          ...dockviewInstance.panels,
          ...['top', 'right', 'left'].flatMap((position) => dockviewInstance
            .getEdgeGroupPanel(position as EdgeGroupPosition)?.panels ?? []),
          ...dockviewInstance.floatingGroups.flatMap((floatingGroup) => floatingGroup.group.panels),
        ].find((panel) => panel.id === panelId);

        if (existingPanel) {
          dummyWindowPanelIds.add(panelId);
          updatePanelPlacement(existingPanel);
          continue;
        }

        const panel = dockviewInstance.addPanel({
          id: panelId,
          component: 'sandbox',
          title: dummyPanel.title,
          params: dummyPanel,
          position: { referenceGroup: topEdgeGroupInstance.id },
        });
        dummyWindowPanelIds.add(panelId);
        revealEdgeGroupForPanel('top');
        updatePanelPlacement(panel);
        bringPanelToFront(panel);
      }
    };

    const removeDummyWindowPanelListener = dockviewInstance.onDidRemovePanel((panel) => {
      if (suppressDummyWindowClose.delete(panel.id)) {
        dummyWindowPanelIds.delete(panel.id);
        queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
        });
        return;
      }

      if (!dummyWindowPanelIds.has(panel.id)) {
        return;
      }

      dummyWindowPanelIds.delete(panel.id);
      dummyPanels.find((dummyPanel) => dummyPanel.instanceId === panel.id)?.onClose();
      queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
      });
    });

    const removeNotesPanelListener = dockviewInstance.onDidRemovePanel((panel) => {
      if (suppressNotesClose.delete(panel.id)) {
        notesPanelId = null;
        queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
        });
        return;
      }

      if (notesPanel?.instanceId !== panel.id) {
        return;
      }

      notesPanelId = null;
      notesPanel?.onClose();
      queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
          scheduleHideEdgeGroup('left');
      });
    });

    const removeDebugConsolePanelListener = dockviewInstance.onDidRemovePanel((panel) => {
      if (suppressDebugConsoleClose.delete(panel.id)) {
        debugConsolePanelId = null;
        queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
        });
        return;
      }

      if (debugConsolePanel?.instanceId !== panel.id) {
        return;
      }

      debugConsolePanelId = null;
      debugConsolePanel?.onClose();
      queueMicrotask(() => {
          scheduleHideEdgeGroup('top');
          scheduleHideEdgeGroup('right');
      });
    });

    const workspacePanel = dockviewInstance.addPanel({
      id: 'play-dockview-workspace',
      component: 'sandbox',
      title: 'Transcript Workspace',
      params: {
        title: 'Transcript Workspace',
        eyebrow: 'center dock',
        description:
          'This is a temporary Dockview host for the main reading area. The real transcript wiring can be dropped in later.',
        tone: 'workspace',
      },
    });
    const enforceTranscriptWorkspaceInvariant = () => {
      workspacePanel.group.header.hidden = true;
      workspacePanel.group.locked = true;
    };
    enforceTranscriptWorkspaceInvariant();

    const removeWorkspaceDropListener = dockviewInstance.onWillDrop((event) => {
      if (event.group?.id === workspacePanel.group.id) {
        event.preventDefault();
      }
    });

    dockviewInstance.setEdgeGroupVisible('top', true);
    dockviewInstance.setEdgeGroupVisible('right', true);
    dockviewInstance.setEdgeGroupVisible('left', true);

    dockviewInstance.panels.forEach(updatePanelPlacement);
    syncDebugConsolePanel?.();
    syncNotesPanel?.();
    syncTreeDataPanels?.();
    syncDummyWindowPanels?.();

    if (initialLayout) {
      dockviewInstance.fromJSON(initialLayout, { reuseExistingPanels: true });
      enforceTranscriptWorkspaceInvariant();
    }

    attachEdgeGroupPointerListeners('top', topEdgeGroupInstance.id);
    attachEdgeGroupPointerListeners('right', rightEdgeGroupInstance.id);
    attachEdgeGroupPointerListeners('left', leftEdgeGroupInstance.id);
    initializeEdgeGroup('top', topEdgeGroupInstance, topEdgeGroupInstance.id);
    initializeEdgeGroup('right', rightEdgeGroupInstance, rightEdgeGroupInstance.id);
    initializeEdgeGroup('left', leftEdgeGroupInstance, leftEdgeGroupInstance.id);
    dockviewInstance.panels.forEach(updatePanelPlacement);
    previousTopEdgeBounds = getTopEdgeBounds();
    previousFloatingContainerBounds = getFloatingContainerBounds();
    captureFloatingGroupBounds();

    return () => {
      captureFloatingGroupBounds();
      const layoutSnapshot = dockviewInstance.toJSON();
      onLayoutSnapshot({
        ...layoutSnapshot,
        popoutGroups: undefined,
      });

      if (debugConsolePanelId) suppressDebugConsoleClose.add(debugConsolePanelId);
      if (notesPanelId) suppressNotesClose.add(notesPanelId);
      treeDataPanelIds.forEach((panelId) => suppressTreeDataClose.add(panelId));
      dummyWindowPanelIds.forEach((panelId) => suppressDummyWindowClose.add(panelId));

      clearHideTimer('top');
      clearHideTimer('right');
      clearHideTimer('left');
      removeTopEdgePointerListeners?.();
      removeTopEdgePointerListeners = null;
      removeRightEdgePointerListeners?.();
      removeRightEdgePointerListeners = null;
      removeLeftEdgePointerListeners?.();
      removeLeftEdgePointerListeners = null;
      if (floatingLayoutFrame !== null) {
        cancelAnimationFrame(floatingLayoutFrame);
        floatingLayoutFrame = null;
      }
      removeFloatingLayoutListener.dispose();
      removeFloatingGroupListener.dispose();
      removeTabDropListener.dispose();
      if (floatingVisibilityLayoutFrame !== null) {
        cancelAnimationFrame(floatingVisibilityLayoutFrame);
        floatingVisibilityLayoutFrame = null;
      }
      if (tabDragRestoreFrame !== null) {
        cancelAnimationFrame(tabDragRestoreFrame);
        tabDragRestoreFrame = null;
      }
      restoreEdgeGroupsAfterTabDrag();
      floatingContainerResizeObserver?.disconnect();
      floatingContainerResizeObserver = null;
      floatingGroupOverlayDisposables.forEach((disposables) => {
        disposables.forEach((disposable) => disposable.dispose());
      });
      floatingGroupOverlayDisposables.clear();
      floatingGroupBounds.clear();
      previousTopEdgeBounds = undefined;
      previousFloatingContainerBounds = undefined;
      floatingGroupDisposables.forEach((disposable) => disposable.dispose());
      floatingGroupDisposables = [];
      floatingTitlebarObserver?.disconnect();
      floatingTitlebarObserver = null;
      syncDebugConsolePanel = null;
      syncNotesPanel = null;
      syncTreeDataPanels = null;
      syncDummyWindowPanels = null;
      focusDockviewPanel = null;
      debugConsolePanelId = null;
      notesPanelId = null;
      treeDataPanelIds.clear();
      dummyWindowPanelIds.clear();
      suppressDebugConsoleClose.clear();
      suppressNotesClose.clear();
      suppressTreeDataClose.clear();
      suppressDummyWindowClose.clear();
      removeDebugConsolePanelListener.dispose();
      removeNotesPanelListener.dispose();
      removeTreeDataPanelListener.dispose();
      removeDummyWindowPanelListener.dispose();
      removeWorkspaceDropListener.dispose();
      removeActivePanelListener.dispose();
      dockRoot?.removeEventListener('pointerdown', handlePanelTabPointerDown, true);
      dockviewInstance.dispose();
      dockview = null;
      topEdgeGroup = null;
      rightEdgeGroup = null;
      leftEdgeGroup = null;
    };
  });
</script>

<div
  class="play-dockview-sandbox"
  class:hidden={!visible}
  role="none"
  on:mouseenter={handleSandboxMouseEnter}
  on:mouseleave={handleSandboxMouseLeave}
>
  {#if topEdgeHidden}
    <div
      class="play-dockview-edge-activator play-dockview-edge-activator--top"
      aria-hidden="true"
      on:mouseenter={() => revealEdgeGroup('top')}
    ></div>
  {/if}

  {#if rightEdgeHidden}
    <div
      class="play-dockview-edge-activator play-dockview-edge-activator--right"
      aria-hidden="true"
      on:mouseenter={() => revealEdgeGroup('right')}
    ></div>
  {/if}

  {#if leftEdgeHidden}
    <div
      class="play-dockview-edge-activator play-dockview-edge-activator--left"
      aria-hidden="true"
      on:mouseenter={() => revealEdgeGroup('left')}
    ></div>
  {/if}

  <div bind:this={dockRoot} class="play-dockview-sandbox-root"></div>
</div>
