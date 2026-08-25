<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { copyTextToClipboard } from '../../session-dom';
  import {
    renderDebugConsoleTextHtml,
    type DebugConsoleEntry,
  } from '../../debug-console';
  import type { DebugConsoleWindowCommand, DebugConsoleWindowSnapshot, DebugConsoleWindowTransportSession } from './debug-console-transport';

  export let model: DebugConsoleWindowSnapshot['model'];
  export const onCommand: (command: DebugConsoleWindowCommand) => void = () => {};
  export let transportSession: DebugConsoleWindowTransportSession | null = null;

  let transportSnapshot: DebugConsoleWindowSnapshot | null = null;
  let activeModel = model;
  let unlistenSnapshot: (() => void) | null = null;
  let scroller: HTMLDivElement | null = null;
  let content: HTMLDivElement | null = null;
  let contentResizeObserver: ResizeObserver | null = null;
  let userScrolled = false;
  let lastEntryCount = 0;

  function logDebugConsoleWindow(message: string, details: Record<string, unknown>): void {
    console.debug(`[debug-console-window] ${message}`, details);
  }

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

  function syncTransportSession(session: DebugConsoleWindowTransportSession | null): void {
    if (unlistenSnapshot) {
      unlistenSnapshot();
      unlistenSnapshot = null;
    }

    transportSnapshot = session?.getSnapshot()?.payload ?? null;
    logDebugConsoleWindow('sync transport session', {
      hasSession: session !== null,
      revision: session?.getRevision() ?? null,
      hasSnapshot: transportSnapshot !== null,
      entryCount: transportSnapshot?.model.entries.length ?? 0,
    });

    if (!session) {
      return;
    }

    unlistenSnapshot = session.onSnapshot((envelope) => {
      transportSnapshot = envelope.payload;
      logDebugConsoleWindow('snapshot received', {
        revision: envelope.revision,
        entryCount: envelope.payload.model.entries.length,
      });
    });
  }

  function scrollToBottom(): void {
    if (!(scroller instanceof HTMLElement)) {
      return;
    }

    scroller.scrollTop = scroller.scrollHeight;
    userScrolled = false;
  }

  async function followEntries(): Promise<void> {
    if (userScrolled || activeModel.entries.length === lastEntryCount) {
      return;
    }

    lastEntryCount = activeModel.entries.length;
    await tick();
    scrollToBottom();
  }

  function handleScroll(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    userScrolled = distanceFromBottom > 2;
  }

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !(scroller instanceof HTMLElement)) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!scroller.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = selection.toString();
    if (!text.trim()) {
      return;
    }

    await copyTextToClipboard(text);
  }

  onMount(() => {
    document.addEventListener('mouseup', handleMouseUp);
    if (content) {
      contentResizeObserver = new ResizeObserver(() => {
        if (!userScrolled) {
          scrollToBottom();
        }
      });
      contentResizeObserver.observe(content);
    }
    scrollToBottom();

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      contentResizeObserver?.disconnect();
      contentResizeObserver = null;
    };
  });

  $: syncTransportSession(transportSession);
  onDestroy(() => syncTransportSession(null));

  $: activeModel = transportSnapshot?.model ?? model;
  $: {
    if (!userScrolled && activeModel.entries.length !== lastEntryCount) {
      void followEntries();
    }

    if (!transportSession) {
      lastEntryCount = activeModel.entries.length;
    }
  }

  onDestroy(() => {
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
  });
</script>

<section class="debug-console-window">
  <div
    bind:this={scroller}
    class="debug-console-scroll"
    role="region"
    aria-label="Debug console output"
    on:scroll={handleScroll}
  >
    <div class="debug-console-content" bind:this={content}>
      {#if activeModel.entries.length === 0}
        <p class="debug-console-empty-state">No debug output yet.</p>
      {:else}
        {#each activeModel.entries as entry (entry.id)}
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
      {/if}
    </div>
  </div>

</section>

<style>
  .debug-console-window {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
    color: var(--text-color, #e7eef9);
    background:
      radial-gradient(circle at top right, rgba(107, 126, 255, 0.18), transparent 32%),
      linear-gradient(180deg, rgba(16, 20, 28, 0.98), rgba(10, 13, 19, 0.98));
  }

  .debug-console-scroll {
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: auto;
    border: 0;
    border-radius: 0;
    background: rgba(5, 7, 10, 0.42);
  }

  .debug-console-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
    min-height: 100%;
    padding: 0.7rem;
  }

  .debug-console-empty-state {
    margin: 0;
    padding: 1rem;
    color: rgba(200, 214, 245, 0.72);
  }

  .debug-console-entry {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.55rem 0.65rem;
    border-radius: 0.7rem;
    border: 1px solid rgba(145, 164, 205, 0.1);
    background: rgba(255, 255, 255, 0.02);
  }

  .debug-console-entry--incoming {
    border-color: rgba(90, 190, 255, 0.22);
  }

  .debug-console-entry--outgoing {
    border-color: rgba(255, 196, 90, 0.22);
  }

  .debug-console-entry--status {
    border-color: rgba(160, 170, 190, 0.18);
  }

  .debug-console-entry-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    color: rgba(200, 214, 245, 0.76);
    font-size: 0.74rem;
    letter-spacing: 0.02em;
  }

  .debug-console-entry-direction {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(231, 238, 249, 0.86);
  }

  .debug-console-entry-source {
    opacity: 0.88;
  }

  .debug-console-entry-body {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

</style>
