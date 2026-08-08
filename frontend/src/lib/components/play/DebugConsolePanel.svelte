<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { copyTextToClipboard, focusElement } from '../../session-dom';
  import { getWorldDebugConsolePanelId, getWorldInputBarInputId } from '../../world-dom';
  import {
    renderDebugConsoleTextHtml,
    type DebugConsoleEntry,
  } from '../../debug-console';
  import type { InputBarId } from '../../input-bars';

  export let open = false;
  export let embedded = false;
  export let entries: DebugConsoleEntry[] = [];
  export let scope = 'world';
  export let activeBar: InputBarId = 1;
  export let onClose: () => void;

  let consoleScroller: HTMLDivElement | null = null;
  let consoleContent: HTMLDivElement | null = null;
  let contentResizeObserver: ResizeObserver | null = null;
  let userScrolled = false;
  let lastEntryCount = 0;

  function getTimestampLabel(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function getDirectionLabel(direction: DebugConsoleEntry['direction']): string {
    switch (direction) {
      case 'incoming':
        return 'incoming';
      case 'outgoing':
        return 'outgoing';
      default:
        return 'status';
    }
  }

  function buildEntryTitle(entry: DebugConsoleEntry): string {
    const lineLabel = entry.lineCount === 1 ? 'line' : 'lines';
    return [
      `Timestamp: ${getTimestampLabel(entry.timestamp)}`,
      `Direction: ${getDirectionLabel(entry.direction)}`,
      `Source: ${entry.sourceLabel}`,
      `Size: ${entry.lineCount} ${lineLabel}`,
    ].join('\n');
  }

  function syncScrollState(): void {
    if (!(consoleScroller instanceof HTMLElement)) {
      return;
    }

    const distanceFromBottom = consoleScroller.scrollHeight - consoleScroller.scrollTop - consoleScroller.clientHeight;
    userScrolled = distanceFromBottom > 2;
  }

  function scrollToBottom(): void {
    if (!(consoleScroller instanceof HTMLElement)) {
      return;
    }

    consoleScroller.scrollTop = consoleScroller.scrollHeight;
    userScrolled = false;
  }

  async function followEntries(): Promise<void> {
    if (!open || userScrolled || entries.length === lastEntryCount) {
      return;
    }

    lastEntryCount = entries.length;
    await tick();
    scrollToBottom();
  }

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !(consoleScroller instanceof HTMLElement)) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!consoleScroller.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = selection.toString();

    if (text.trim()) {
      try {
        await copyTextToClipboard(text);
      } finally {
        focusElement(getWorldInputBarInputId(scope, activeBar));
      }
      return;
    }

    focusElement(getWorldInputBarInputId(scope, activeBar));
  }

  function handleScroll(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    userScrolled = distanceFromBottom > 2;
  }

  function handleScrollToBottomClick(): void {
    scrollToBottom();
    focusElement(getWorldInputBarInputId(scope, activeBar));
  }

  onMount(() => {
    if (consoleContent) {
      contentResizeObserver = new ResizeObserver(() => {
        if (!userScrolled) {
          scrollToBottom();
        }
      });
      contentResizeObserver.observe(consoleContent);
    }

    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      contentResizeObserver?.disconnect();
      contentResizeObserver = null;
    };
  });

  onDestroy(() => {
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
  });

  $: if (open && entries.length !== lastEntryCount) {
    void followEntries();
  }

  $: {
    if (open && !userScrolled) {
      void tick().then(scrollToBottom);
    }

    if (!open) {
      lastEntryCount = entries.length;
      userScrolled = false;
    }
  }
</script>

<div
  class="debug-console-panel"
  class:embedded={embedded}
  id={getWorldDebugConsolePanelId(scope)}
  class:open={open}
>
  <div class="panel-header">
    <div class="panel-header-group">
      <div class="debug-console-label">debug console</div>
      <div class="debug-console-hint">incoming, outgoing, and status messages</div>
    </div>
    <button
      type="button"
      class="btn panel-close"
      aria-label="Close debug console"
      title="Close debug console"
      on:click={onClose}
    >
      X
    </button>
  </div>

  <div
    bind:this={consoleScroller}
    class="debug-console-scroll"
    role="region"
    aria-label="Debug console output"
    on:scroll={handleScroll}
  >
    <div class="debug-console-content" bind:this={consoleContent}>
      {#each entries as entry (entry.id)}
        <article
          class="debug-console-entry"
          class:debug-console-entry--incoming={entry.direction === 'incoming'}
          class:debug-console-entry--outgoing={entry.direction === 'outgoing'}
          class:debug-console-entry--status={entry.direction === 'status'}
          title={buildEntryTitle(entry)}
        >
          <div class="debug-console-entry-head">
            <span class="debug-console-entry-timestamp">{getTimestampLabel(entry.timestamp)}</span>
            <span class="debug-console-entry-direction">{getDirectionLabel(entry.direction)}</span>
            <span class="debug-console-entry-source">{entry.sourceLabel}</span>
          </div>
          <div class="debug-console-entry-body">
            {@html renderDebugConsoleTextHtml(entry.text)}
          </div>
        </article>
      {/each}
    </div>
  </div>

  {#if userScrolled}
    <button
      type="button"
      class="debug-console-scroll-bottom-button"
      aria-label="Scroll debug console to bottom"
      on:click={handleScrollToBottomClick}
    >
      ↓
    </button>
  {/if}
</div>
