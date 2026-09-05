<script lang="ts">
  import { onMount } from 'svelte';
  import { createCloseButton, DockviewComponent, type ITabRenderer } from 'dockview';
  import { DEFAULT_DOCKVIEW_THEME, getDockviewTheme, type DockviewThemeId } from '../../dockview-themes';
  import type { AppTab } from '../../tabs';
  import type { WorldTabSessionState } from '../../world-session';

  export let tabs: AppTab[] = [];
  export let activeTabId: string | null = null;
  export let worldSessions: Record<string, WorldTabSessionState> = {};
  export let dockviewThemeId: DockviewThemeId = DEFAULT_DOCKVIEW_THEME;
  export let onSelectTab: (tabId: string) => void = () => {};
  export let onReorderTab: (tabId: string, targetIndex: number) => void = () => {};
  export let onCloseTab: (tabId: string) => void = () => {};
  export let onContextMenu: (tabId: string, event: MouseEvent) => void = () => {};

  let root: HTMLDivElement | null = null;
  let dockview: DockviewComponent | null = null;
  let syncing = false;

  function markDockviewTabsNoDrag(): void {
    root?.querySelectorAll('.dv-tab').forEach((tab) => {
      tab.setAttribute('data-tauri-drag-region', 'false');
    });
  }

  function preventEmptyAreaDrag(event: PointerEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('.dv-tab')) {
      event.stopPropagation();
    }
  }

  function preventTitlebarDragForTab(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest('.dv-tab')) {
      event.stopPropagation();
    }
  }

  function getTab(id: string): AppTab | null {
    return tabs.find((tab) => tab.id === id) ?? null;
  }

  function createTabRenderer({ id }: { id: string }): ITabRenderer {
    const element = document.createElement('div');
    element.className = 'app-dockview-tab';
    element.setAttribute('role', 'tab');
    element.setAttribute('data-tauri-drag-region', 'false');

    const label = document.createElement('span');
    label.className = 'app-dockview-tab-label';
    element.appendChild(label);

    const status = document.createElement('span');
    status.className = 'app-dockview-tab-status';
    status.setAttribute('aria-hidden', 'true');
    element.appendChild(status);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dv-default-tab-action app-dockview-tab-close';
    close.setAttribute('data-tauri-drag-region', 'false');
    close.title = 'close tab';
    close.appendChild(createCloseButton());
    element.appendChild(close);

    let removeTitleListener: { dispose: () => void } | null = null;

    function render(): void {
      const tab = getTab(id);
      if (!tab) return;
      const worldSession = tab.kind === 'world' ? worldSessions[id] ?? null : null;
      label.textContent = tab.title;
      element.title = tab.title;
      element.setAttribute('aria-label', `${tab.title} tab`);
      status.replaceChildren();
      if (worldSession) {
        const connection = document.createElement('span');
        connection.className = `status-dot ${worldSession.connectionStatus}`;
        const activity = document.createElement('span');
        activity.className = `status-dot activity ${worldSession.hasNewActivity ? '' : 'inactive'}`;
        const logging = document.createElement('span');
        logging.className = `status-dot logging ${worldSession.loggingActive ? '' : 'inactive'}`;
        status.append(connection, activity, logging);
      }
    }

    return {
      element,
      init(params) {
        render();
        close.title = `close ${getTab(id)?.title ?? 'tab'}`;
        close.setAttribute('aria-label', close.title);
        close.addEventListener('click', (event) => {
          event.stopPropagation();
          onCloseTab(id);
        });
        element.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          onContextMenu(id, event);
        });
        removeTitleListener = params.api.onDidTitleChange(() => render());
      },
      update() { render(); },
      dispose() { removeTitleListener?.dispose(); },
    };
  }

  function syncPanels(): void {
    if (!dockview) return;
    syncing = true;
    const ids = new Set(tabs.map((tab) => tab.id));
    for (const panel of [...dockview.panels]) {
      if (!ids.has(panel.id)) dockview.removePanel(panel);
    }
    for (const [index, tab] of tabs.entries()) {
      const existing = dockview.panels.find((panel) => panel.id === tab.id);
      if (!existing) {
        dockview.addPanel({
          id: tab.id,
          component: 'app-tab-content',
          tabComponent: 'app-tab',
          title: tab.title,
          inactive: index !== 0,
        });
      } else if (existing.title !== tab.title) {
        existing.setTitle(tab.title);
      }
    }
    if (activeTabId) dockview.panels.find((panel) => panel.id === activeTabId)?.api.setActive();
    syncing = false;
  }

  onMount(() => {
    if (!root) return;
    const tabObserver = new MutationObserver(markDockviewTabsNoDrag);
    tabObserver.observe(root, { childList: true, subtree: true });
    root.addEventListener('pointerdown', preventEmptyAreaDrag, true);
    root.addEventListener('mousedown', preventTitlebarDragForTab, true);
    dockview = new DockviewComponent(root, {
      theme: getDockviewTheme(dockviewThemeId),
      className: getDockviewTheme(dockviewThemeId).className,
      defaultHeaderPosition: 'top',
      dndStrategy: 'pointer',
      createComponent: () => ({ element: document.createElement('div'), init() {} }),
      createTabComponent: createTabRenderer,
    });
    markDockviewTabsNoDrag();
    dockview.onDidActivePanelChange(({ panel }) => {
      if (!syncing && panel) onSelectTab(panel.id);
    });
    dockview.onDidRemovePanel((panel) => {
      if (!syncing && getTab(panel.id)) onCloseTab(panel.id);
    });
    dockview.onDidLayoutChange(() => {
      if (syncing || !dockview) return;
      const group = dockview.groups[0];
      group?.panels.forEach((panel, index) => {
        const tabIndex = tabs.findIndex((tab) => tab.id === panel.id);
        if (tabIndex >= 0 && tabIndex !== index) onReorderTab(panel.id, index);
      });
    });
    syncPanels();
    return () => {
      tabObserver.disconnect();
      root?.removeEventListener('pointerdown', preventEmptyAreaDrag, true);
      root?.removeEventListener('mousedown', preventTitlebarDragForTab, true);
      dockview?.dispose();
      dockview = null;
    };
  });

  $: {
    void worldSessions;
    syncPanels();
    if (dockview && activeTabId && dockview.activePanel?.id !== activeTabId) {
      dockview.panels.find((panel) => panel.id === activeTabId)?.api.setActive();
    }
    dockview?.panels.forEach((panel) => panel.view.tab.update?.({ params: {} }));
  }
</script>

<div
  bind:this={root}
  class="app-dockview"
  aria-label="app tabs"
></div>
