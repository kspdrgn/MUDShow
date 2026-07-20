<script lang="ts">
  import { type InputBarConfig, type InputBarId } from '../../input-bars';
  import { onMount } from 'svelte';
  import type { Trigger } from '../../types';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';
  import InputBars from './InputBars.svelte';
  import type { AppStyleValues } from '../styles/style-settings';

  export let scope = 'world';
  export let visible = true;
  export let styleValues: AppStyleValues;
  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let loggingActive = false;
  export let triggers: Trigger[] = [];
  export let notes = '';
  export let notesVisible = false;
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let showCurrentOutputWhenScrollingUp = true;
  export let userScrolled = false;
  export let outputChunks: string[] = [];
  export let characterWidth: number | undefined = undefined;
  export let onReconnectTab: () => void;
  export let onDisconnectTab: () => void;
  export let onQuickLogTab: () => void;
  export let onOpenLoggingTab: () => void;
  export let onStopLoggingTab: () => void;
  export let onEditWorldTab: () => void;
  export let onEditCharacterTab: () => void;
  export let onCloseTab: (anchorRect: DOMRect) => void;
  export let onOpenTriggers: () => void;
  export let canReconnect = false;
  export let canDisconnect = false;
  export let canQuickLog = false;
  export let canStopLogging = false;
  export let canEditWorld = false;
  export let canEditCharacter = false;
  export let onInputFocusBar: (bar: InputBarId) => void;
  export let onInputSubmit: (bar: InputBarId, value: string) => void;
  export let onInputComplete: (
    bar: InputBarId,
    value: string,
    selectionStart: number,
  ) => { value: string; cursor: number } | null;
  export let onInputAddBar: (bar: InputBarId) => void;
  export let onInputRemoveBar: (bar: InputBarId) => void;
  export let onInputResizeBar: (bar: InputBarId, delta: -1 | 1) => void;
  export let onNotesInput: (notes: string) => void;
  export let onNotesClose: () => void;
  export let onOutputScroll: () => void;
  export let onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') => void;
  export let onScrollToBottom: () => void;

  let screenElement: HTMLDivElement | null = null;
  let measuredPlayWidth = 'none';
  let measurementToken = 0;

  function normalizeCharacterWidth(value: number | undefined): number | null {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.max(1, Math.round(value));
  }

  function measureTextWidth(text: string): number {
    if (!screenElement) {
      return 0;
    }

    const probe = document.createElement('span');
    probe.textContent = text;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'pre';
    probe.style.fontFamily = 'var(--world-output-font-family, var(--font-mono))';
    probe.style.fontSize = 'var(--world-output-font-size, 13px)';
    probe.style.fontVariantLigatures = 'none';
    probe.style.fontFeatureSettings = '"liga" 0, "clig" 0, "calt" 0';

    screenElement.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();

    return width;
  }

  function measureCharacterWidth(widthInCharacters: number): string {
    const sampleSize = 80;
    const narrowWidth = measureTextWidth('i'.repeat(sampleSize));
    const wideWidth = measureTextWidth('W'.repeat(sampleSize));
    const monoTolerance = 0.02 * sampleSize;
    const isMonospace = narrowWidth > 0 && wideWidth > 0 && Math.abs(narrowWidth - wideWidth) <= monoTolerance;
    const measuredWidth = isMonospace
      ? measureTextWidth('0'.repeat(widthInCharacters))
      : (measureTextWidth('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.repeat(2)) / 126) * widthInCharacters;

    if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
      return `${widthInCharacters}ch`;
    }

    return `${measuredWidth}px`;
  }

  async function updateMeasuredPlayWidth(): Promise<void> {
    const widthInCharacters = normalizeCharacterWidth(characterWidth);
    if (widthInCharacters === null) {
      measuredPlayWidth = 'none';
      return;
    }

    if (!screenElement || !visible) {
      return;
    }

    const token = ++measurementToken;
    await document.fonts?.ready;

    if (token !== measurementToken) {
      return;
    }

    measuredPlayWidth = measureCharacterWidth(widthInCharacters);
  }

  $: {
    void styleValues;
    void characterWidth;
    void visible;
    void updateMeasuredPlayWidth();
  }

  onMount(() => {
    void updateMeasuredPlayWidth();
  });
</script>

<div
  bind:this={screenElement}
  class:active={visible}
  class="screen-play"
  style={`--play-width: ${measuredPlayWidth};`}
  style:--world-output-font-family={styleValues.output.fontFamily}
  style:--world-output-font-size={`${styleValues.output.fontSize}px`}
  style:--world-output-foreground={styleValues.output.foregroundColor}
  style:--world-output-background={styleValues.output.backgroundColor}
  style:--world-input-font-family={styleValues.input.fontFamily}
  style:--world-input-font-size={`${styleValues.input.fontSize}px`}
  style:--world-input-foreground={styleValues.input.foregroundColor}
  style:--world-input-background={styleValues.input.backgroundColor}
>
  <NotesPanel open={notesVisible} {notes} {scope} onInput={onNotesInput} onClose={onNotesClose} />

  <Transcript
    {activeBar}
    chunks={outputChunks}
    width={measuredPlayWidth}
    {scope}
    {triggers}
    {linkImagePreviews}
    {imagePreviewCacheVersion}
    {showCurrentOutputWhenScrollingUp}
    {userScrolled}
    {canReconnect}
    {canDisconnect}
    {canQuickLog}
    {canStopLogging}
    {canEditWorld}
    {canEditCharacter}
    onReconnect={onReconnectTab}
    onDisconnect={onDisconnectTab}
    onQuickLog={onQuickLogTab}
    onStopLogging={onStopLoggingTab}
    onOpenLogging={onOpenLoggingTab}
    onEditWorld={onEditWorldTab}
    onEditCharacter={onEditCharacterTab}
    onOpenNotes={onNotesClose}
    onOpenTriggers={onOpenTriggers}
    onCloseRequest={onCloseTab}
    onScroll={onOutputScroll}
    onScrollToBottom={onScrollToBottom}
  />

  <InputBars
    {bars}
    {activeBar}
    {connectionStatus}
    {loggingActive}
    {scope}
    onFocusBar={onInputFocusBar}
    onSubmit={onInputSubmit}
    onComplete={onInputComplete}
    onAddBar={onInputAddBar}
    onRemoveBar={onInputRemoveBar}
    onResizeBar={onInputResizeBar}
    onOutputScrollKey={onOutputScrollKey}
  />
</div>
