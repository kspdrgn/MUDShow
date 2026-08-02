<script lang="ts">
  import { type InputBarConfig, type InputBarId } from '../../input-bars';
  import { onMount } from 'svelte';
  import type { Trigger } from '../../types';
  import type { PlayTranscript, RenderCache } from '../../playback';
  import type { DebugConsoleEntry } from '../../debug-console';
  import DebugConsolePanel from './DebugConsolePanel.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';
  import InputBars from './InputBars.svelte';
  import DummyChannelPanel from './DummyChannelPanel.svelte';
  import WorldChannelsBar from './WorldChannelsBar.svelte';
  import WorldChannelsPanel from './WorldChannelsPanel.svelte';
  import type { AppStyleValues } from '../styles/style-settings';
  import { getSquiggleDecorationStyle } from '../../spellcheck-style';
  import {
    measureCharacterWidth,
    normalizeCharacterWidth,
  } from './play-width';
  import { type ChannelTabVM, type ChannelTabId } from './channel';

  export let scope = 'world';
  export let visible = true;
  export let styleValues: AppStyleValues;
  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let hasNewActivity = false;
  export let loggingActive = false;
  export let triggers: Trigger[] = [];
  export let notes = '';
  export let notesVisible = false;
  export let debugConsoleEntries: DebugConsoleEntry[] = [];
  export let debugConsoleVisible = false;
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let showCurrentOutputWhenScrollingUp = true;
  export let transcriptDiagnosticsEnabled = false;
  export let userScrolled = false;
  export let spellcheckEnabled = true;
  export let spellcheckLanguage = 'en-US';
  export let spellcheckIgnoredWords = '';
  export let spellcheckSuggestionLimit = 5;
  export let spellcheckMinimumWordLength = 3;
  export let spellcheckDebounceMs = 250;
  export let squiggleOpacity = 1;
  export let squiggleColor = '#ff0000';
  export let squiggleStyle = 'wavy';
  export let squiggleSize = 1;
  export let transcript: PlayTranscript;
  export let outputRevision = 0;
  export let renderCache: RenderCache | null = null;
  export let characterWidth: number | undefined = undefined;
  export let outputFontSize = 13;
  export let onReconnectTab: () => void;
  export let onDisconnectTab: () => void;
  export let onQuickLogTab: () => void;
  export let onOpenLoggingTab: () => void;
  export let onStopLoggingTab: () => void;
  export let onEditWorldTab: () => void;
  export let onEditCharacterTab: () => void;
  export let onCloseTab: (anchorRect: DOMRect) => void;
  export let onOpenNotes: () => void;
  export let onOpenTriggers: () => void;
  export let onOpenDebugConsole: () => void;
  export let onOpenStyles: () => void;
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
  export let onSpellcheckIgnoreWord: (word: string) => void;
  export let onNotesClose: () => void;
  export let onDebugConsoleClose: () => void;
  export let onOutputScroll: () => void;
  export let onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') => void;
  export let onScrollToBottom: () => void;

  let screenElement: HTMLDivElement | null = null;
  let measuredPlayWidth = 'none';
  let measurementToken = 0;
  let channelBarHovered = false;
  let channelBarAwake = false;
  let channelBarHideTimer: ReturnType<typeof setTimeout> | null = null;
  let lastVisible = visible;
  let channelTabs: ChannelTabVM[] = [
    {
      id: 'dummy',
      label: 'dummy 1',
      open: false,
      panelComponent: DummyChannelPanel,
    },
    {
      id: 'dummy-2',
      label: 'dummy 2',
      open: false,
      panelComponent: DummyChannelPanel,
    },
  ];

  function hasOpenChannels(): boolean {
    return channelTabs.some((tab) => tab.open);
  }

  $: channelPanelOpen = hasOpenChannels();
  $: channelBarPinned = channelPanelOpen;
  $: channelBarVisible = channelBarPinned || channelBarHovered || channelBarAwake;

  function clearChannelBarTimer(): void {
    if (channelBarHideTimer !== null) {
      clearTimeout(channelBarHideTimer);
      channelBarHideTimer = null;
    }
  }

  function showChannelBar(): void {
    channelBarHovered = true;
    channelBarAwake = true;
    clearChannelBarTimer();
  }

  function scheduleChannelBarHide(): void {
    if (hasOpenChannels() || channelBarHovered) {
      return;
    }

    clearChannelBarTimer();
    channelBarHideTimer = setTimeout(() => {
      if (!hasOpenChannels() && !channelBarHovered) {
        channelBarAwake = false;
      }
    }, 1000);
  }

  function hideChannelBar(): void {
    channelBarHovered = false;
    scheduleChannelBarHide();
  }

  function toggleChannel(tabId: ChannelTabId): void {
    const channel = channelTabs.find((tab) => tab.id === tabId);

    if (!channel) {
      return;
    }

    if (channel.open) {
      closeAllChannels();
      return;
    }

    channelTabs = channelTabs.map((tab) => ({
      ...tab,
      open: tab.id === tabId,
    }));
    scheduleChannelBarHide();
  }

  function closeAllChannels(): void {
    channelTabs = channelTabs.map((tab) =>
      tab.open ? { ...tab, open: false } : tab,
    );
    scheduleChannelBarHide();
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

    measuredPlayWidth = measureCharacterWidth(screenElement, widthInCharacters);
  }

  $: {
    void styleValues;
    void characterWidth;
    void visible;
    void updateMeasuredPlayWidth();
  }

  $: {
    if (visible && !lastVisible) {
      channelBarAwake = true;
      clearChannelBarTimer();
      hideChannelBar();
    } else if (!visible && lastVisible) {
      channelBarHovered = false;
      channelBarAwake = false;
      clearChannelBarTimer();
    }

    lastVisible = visible;
  }

  onMount(() => {
    void updateMeasuredPlayWidth();

    if (visible) {
      channelBarAwake = true;
      hideChannelBar();
    }

    return () => {
      clearChannelBarTimer();
    };
  });
</script>

<div
  bind:this={screenElement}
  class:active={visible}
  class="screen-play"
  style={`--play-width: ${measuredPlayWidth};`}
  style:--world-output-font-family={styleValues.output.fontFamily}
  style:--world-output-font-weight={`${styleValues.output.fontWeight}`}
  style:--world-output-font-style={styleValues.output.fontStyle}
  style:--world-output-font-stretch={styleValues.output.fontStretch}
  style:--world-output-font-size={`${styleValues.output.fontSize}px`}
  style:--world-output-foreground={styleValues.output.foregroundColor}
  style:--world-output-background={styleValues.output.backgroundColor}
  style:--world-input-font-family={styleValues.input.fontFamily}
  style:--world-input-font-weight={`${styleValues.input.fontWeight}`}
  style:--world-input-font-style={styleValues.input.fontStyle}
  style:--world-input-font-stretch={styleValues.input.fontStretch}
  style:--world-input-font-size={`${styleValues.input.fontSize}px`}
  style:--world-input-foreground={styleValues.input.foregroundColor}
  style:--world-input-background={styleValues.input.backgroundColor}
  style:--spellcheck-squiggle-opacity={`${squiggleOpacity}`}
  style:--spellcheck-squiggle-color={squiggleColor}
  style:--spellcheck-squiggle-style={getSquiggleDecorationStyle(squiggleStyle)}
  style:--spellcheck-squiggle-size={`${squiggleSize}`}
>
  <div
    class="world-channels-hover-zone"
    aria-hidden="true"
    on:mouseenter={showChannelBar}
    on:mouseleave={hideChannelBar}
  ></div>

  <WorldChannelsBar
    visible={channelBarVisible}
    tabs={channelTabs}
    onHide={closeAllChannels}
    onToggleChannel={toggleChannel}
  />

  <WorldChannelsPanel
    tabs={channelTabs}
  />

  <NotesPanel
    open={notesVisible}
    {notes}
    {scope}
    {spellcheckEnabled}
    {spellcheckLanguage}
    {spellcheckIgnoredWords}
    {spellcheckSuggestionLimit}
    {spellcheckMinimumWordLength}
    {spellcheckDebounceMs}
    onInput={onNotesInput}
    onIgnoreWord={onSpellcheckIgnoreWord}
    onClose={onNotesClose}
  />

  <DebugConsolePanel
    open={debugConsoleVisible}
    entries={debugConsoleEntries}
    {scope}
    activeBar={activeBar}
    onClose={onDebugConsoleClose}
  />

  <Transcript
    {activeBar}
    {transcript}
    {outputRevision}
    width={measuredPlayWidth}
    {outputFontSize}
    {scope}
    {visible}
    {triggers}
    {linkImagePreviews}
    {transcriptDiagnosticsEnabled}
    {imagePreviewCacheVersion}
    {renderCache}
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
    onOpenNotes={onOpenNotes}
    onOpenDebugConsole={onOpenDebugConsole}
    onOpenTriggers={onOpenTriggers}
    onOpenStyles={onOpenStyles}
    onCloseRequest={onCloseTab}
    onScroll={onOutputScroll}
    onScrollToBottom={onScrollToBottom}
  />

  <InputBars
    {bars}
    {activeBar}
    {connectionStatus}
    {hasNewActivity}
    {loggingActive}
    {scope}
    {spellcheckEnabled}
    {spellcheckLanguage}
    {spellcheckIgnoredWords}
    {spellcheckSuggestionLimit}
    {spellcheckMinimumWordLength}
    {spellcheckDebounceMs}
    onIgnoreWord={onSpellcheckIgnoreWord}
    onFocusBar={onInputFocusBar}
    onSubmit={onInputSubmit}
    onComplete={onInputComplete}
    onAddBar={onInputAddBar}
    onRemoveBar={onInputRemoveBar}
    onResizeBar={onInputResizeBar}
    onOutputScrollKey={onOutputScrollKey}
  />
</div>
