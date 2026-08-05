<script lang="ts">
  import { type InputBarConfig, type InputBarId } from '../../input-bars';
  import { onMount } from 'svelte';
  import type { Trigger } from '../../types';
  import type { PlayTranscript, RenderCache } from '../../playback';
  import type { DebugConsoleEntry } from '../../debug-console';
  import DebugConsolePanel from './DebugConsolePanel.svelte';
  import DummyChannelPanel from './DummyChannelPanel.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';
  import InputBars from './InputBars.svelte';
  import WorldChannelsBar from './WorldChannelsBar.svelte';
  import WorldChannelsPanel from './WorldChannelsPanel.svelte';
  import type { AppStyleValues } from '../styles/style-settings';
  import { getSquiggleDecorationStyle } from '../../spellcheck-style';
  import {
    measureCharacterWidth,
    normalizeCharacterWidth,
  } from './play-width';
  import { type ChannelTabVM, type ChannelTabId } from './channel';

  type PlayScreenActions = {
    onReconnectTab: () => void;
    onDisconnectTab: () => void;
    onQuickLogTab: () => void;
    onOpenLoggingTab: () => void;
    onStopLoggingTab: () => void;
    onEditWorldTab: () => void;
    onEditCharacterTab: () => void;
    onCloseTab: (anchorRect: DOMRect) => void;
    onOpenNotes: () => void;
    onOpenTriggers: () => void;
    onOpenDebugConsole: () => void;
    onOpenStyles: () => void;
    onInputFocusBar: (bar: InputBarId) => void;
    onInputSubmit: (bar: InputBarId, value: string) => void;
    onInputComplete: (
      bar: InputBarId,
      value: string,
      selectionStart: number,
    ) => { value: string; cursor: number } | null;
    onInputAddBar: (bar: InputBarId) => void;
    onInputRemoveBar: (bar: InputBarId) => void;
    onInputResizeBar: (bar: InputBarId, delta: -1 | 1) => void;
    onNotesInput: (notes: string) => void;
    onSpellcheckIgnoreWord: (word: string) => void;
    onNotesClose: () => void;
    onDebugConsoleClose: () => void;
    onOutputScroll: () => void;
    onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') => void;
    onScrollToBottom: () => void;
  };

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
  export let actions: PlayScreenActions;
  export let canReconnect = false;
  export let canDisconnect = false;
  export let canQuickLog = false;
  export let canStopLogging = false;
  export let canEditWorld = false;
  export let canEditCharacter = false;

  let screenElement: HTMLDivElement | null = null;
  let measuredPlayWidth = 'none';
  let measurementToken = 0;
  let channelBarHovered = false;
  let channelBarAwake = false;
  let channelBarHideTimer: ReturnType<typeof setTimeout> | null = null;
  let lastVisible = visible;
  let dummyChannelOneOpen = false;
  let dummyChannelTwoOpen = false;
  const notesChannelId = 'notes';
  const debugConsoleChannelId = 'debug-console';
  const dummyChannelOneId = 'dummy';
  const dummyChannelTwoId = 'dummy-2';

  $: channelTabs = [
    {
      id: dummyChannelOneId,
      label: 'dummy 1',
      open: dummyChannelOneOpen,
      panelComponent: DummyChannelPanel,
      panelProps: {
        title: 'dummy panel',
      },
    },
    {
      id: dummyChannelTwoId,
      label: 'dummy 2',
      open: dummyChannelTwoOpen,
      panelComponent: DummyChannelPanel,
      panelProps: {
        title: 'dummy panel',
      },
    },
    {
      id: notesChannelId,
      label: 'notes',
      open: notesVisible,
      panelComponent: NotesPanel,
      panelProps: {
        embedded: true,
        notes,
        scope,
        spellcheckEnabled,
        spellcheckLanguage,
        spellcheckIgnoredWords,
        spellcheckSuggestionLimit,
        spellcheckMinimumWordLength,
        spellcheckDebounceMs,
        onInput: actions.onNotesInput,
        onIgnoreWord: actions.onSpellcheckIgnoreWord,
        onClose: actions.onNotesClose,
      },
    },
    {
      id: debugConsoleChannelId,
      label: 'debug console',
      open: debugConsoleVisible,
      panelComponent: DebugConsolePanel,
      panelProps: {
        embedded: true,
        entries: debugConsoleEntries,
        scope,
        activeBar,
        onClose: actions.onDebugConsoleClose,
      },
    },
  ] satisfies ChannelTabVM[];

  $: channelPanelOpen = notesVisible || debugConsoleVisible || dummyChannelOneOpen || dummyChannelTwoOpen;
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
    clearChannelBarTimer();
    channelBarHideTimer = setTimeout(() => {
      if (!channelPanelOpen && !channelBarHovered) {
        channelBarAwake = false;
      }
    }, 1000);
  }

  function hideChannelBar(): void {
    channelBarHovered = false;
    scheduleChannelBarHide();
  }

  function toggleChannel(tabId: ChannelTabId): void {
    if (tabId === dummyChannelOneId) {
      dummyChannelOneOpen = !dummyChannelOneOpen;
      dummyChannelTwoOpen = false;
      if (!dummyChannelOneOpen) {
        scheduleChannelBarHide();
      } else {
        channelBarAwake = true;
        clearChannelBarTimer();
        if (notesVisible) {
          actions.onNotesClose();
        }
        if (debugConsoleVisible) {
          actions.onDebugConsoleClose();
        }
      }
      return;
    }

    if (tabId === dummyChannelTwoId) {
      dummyChannelTwoOpen = !dummyChannelTwoOpen;
      dummyChannelOneOpen = false;
      if (!dummyChannelTwoOpen) {
        scheduleChannelBarHide();
      } else {
        channelBarAwake = true;
        clearChannelBarTimer();
        if (notesVisible) {
          actions.onNotesClose();
        }
        if (debugConsoleVisible) {
          actions.onDebugConsoleClose();
        }
      }
      return;
    }

    if (tabId === notesChannelId) {
      dummyChannelOneOpen = false;
      dummyChannelTwoOpen = false;
      if (notesVisible) {
        closeAllChannels();
      } else {
        channelBarAwake = true;
        clearChannelBarTimer();
        actions.onOpenNotes();
      }
      return;
    }

    if (tabId !== debugConsoleChannelId) {
      return;
    }

    if (debugConsoleVisible) {
      closeAllChannels();
      return;
    }

    dummyChannelOneOpen = false;
    dummyChannelTwoOpen = false;
    channelBarAwake = true;
    clearChannelBarTimer();
    actions.onOpenDebugConsole();
  }

  function closeAllChannels(): void {
    dummyChannelOneOpen = false;
    dummyChannelTwoOpen = false;
    if (notesVisible) {
      actions.onNotesClose();
    } else if (debugConsoleVisible) {
      actions.onDebugConsoleClose();
    }
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
    onReconnect={actions.onReconnectTab}
    onDisconnect={actions.onDisconnectTab}
    onQuickLog={actions.onQuickLogTab}
    onStopLogging={actions.onStopLoggingTab}
    onOpenLogging={actions.onOpenLoggingTab}
    onEditWorld={actions.onEditWorldTab}
    onEditCharacter={actions.onEditCharacterTab}
    onOpenNotes={actions.onOpenNotes}
    onOpenDebugConsole={actions.onOpenDebugConsole}
    onOpenTriggers={actions.onOpenTriggers}
    onOpenStyles={actions.onOpenStyles}
    onCloseRequest={actions.onCloseTab}
    onScroll={actions.onOutputScroll}
    onScrollToBottom={actions.onScrollToBottom}
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
    onIgnoreWord={actions.onSpellcheckIgnoreWord}
    onFocusBar={actions.onInputFocusBar}
    onSubmit={actions.onInputSubmit}
    onComplete={actions.onInputComplete}
    onAddBar={actions.onInputAddBar}
    onRemoveBar={actions.onInputRemoveBar}
    onResizeBar={actions.onInputResizeBar}
    onOutputScrollKey={actions.onOutputScrollKey}
  />
</div>
