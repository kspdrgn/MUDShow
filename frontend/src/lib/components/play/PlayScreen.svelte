  <script lang="ts">
  import { type InputBarConfig, type InputBarId } from '../../input-bars';
  import { onMount } from 'svelte';
  import type { Trigger } from '../../types';
  import type { PlayTranscript, RenderCache } from '../../playback';
  import InputBars from './InputBars.svelte';
import PlayDockviewSandbox from './PlayDockviewSandbox.svelte';
  import type {
    DockviewDebugConsolePanelDefinition,
    DockviewDummyWindowPanelDefinition,
    DockviewFuzzballStoragePanelDefinition,
  DockviewNotesPanelDefinition,
  DockviewTreeDataPanelDefinition,
} from './dockview-panel-props';
  import type { AppStyleValues } from '../styles/style-settings';
  import { getSquiggleDecorationStyle } from '../../spellcheck-style';
  import {
    measureCharacterWidth,
    normalizeCharacterWidth,
  } from './play-width';
  import { type ChannelBarControlVM, type ChannelTabVM, type ChannelTabId } from './channel';
  import { appServices } from '../../app-services';

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
    onSpellcheckIgnoreWord: (word: string) => void;
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
    onOutputScroll: (userInitiated?: boolean) => void;
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
  export let channels: { tabs: ChannelTabVM[]; controls: ChannelBarControlVM[] } = {
    tabs: [],
    controls: [],
  };
  export let onOpenFuzzballStorageViewer: (() => void) | undefined = undefined;
  export let showFuzzballStorageViewerButton = false;
  export let debugConsolePanel: DockviewDebugConsolePanelDefinition | null = null;
  export let notesPanel: DockviewNotesPanelDefinition | null = null;
  export let fuzzballPanels: DockviewFuzzballStoragePanelDefinition[] = [];
  export let treeDataPanels: DockviewTreeDataPanelDefinition[] = [];
  export let dummyPanels: DockviewDummyWindowPanelDefinition[] = [];
  export let focusSurfaceId: string | null = null;
  export let focusSurfaceRequestVersion = 0;
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let showCurrentOutputWhenScrollingUp = true;
  export let transcriptDiagnosticsEnabled = false;
  export let userScrolled = false;
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
  const spellcheckConfig = appServices.spellcheck.config;

  $: {
    void channels;
    void triggers;
    void linkImagePreviews;
    void imagePreviewCacheVersion;
    void showCurrentOutputWhenScrollingUp;
    void transcriptDiagnosticsEnabled;
    void userScrolled;
    void transcript;
    void outputRevision;
    void renderCache;
    void outputFontSize;
    void canReconnect;
    void canDisconnect;
    void canQuickLog;
    void canStopLogging;
    void canEditWorld;
    void canEditCharacter;
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

  <PlayDockviewSandbox
    visible={visible}
    onOpenFuzzballStorageViewer={onOpenFuzzballStorageViewer}
    {showFuzzballStorageViewerButton}
    {debugConsolePanel}
    {notesPanel}
    {fuzzballPanels}
    {treeDataPanels}
    {dummyPanels}
    {focusSurfaceId}
    {focusSurfaceRequestVersion}
    activeBar={activeBar}
    transcript={transcript}
    outputRevision={outputRevision}
    workspaceWidth={measuredPlayWidth}
    outputFontSize={outputFontSize}
    scope={scope}
    triggers={triggers}
    linkImagePreviews={linkImagePreviews}
    imagePreviewCacheVersion={imagePreviewCacheVersion}
    renderCache={renderCache}
    showCurrentOutputWhenScrollingUp={showCurrentOutputWhenScrollingUp}
    transcriptDiagnosticsEnabled={transcriptDiagnosticsEnabled}
    userScrolled={userScrolled}
    canReconnect={canReconnect}
    canDisconnect={canDisconnect}
    canQuickLog={canQuickLog}
    canStopLogging={canStopLogging}
    canEditWorld={canEditWorld}
    canEditCharacter={canEditCharacter}
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
    spellcheckEnabled={$spellcheckConfig.enabled}
    spellcheckLanguage={$spellcheckConfig.language}
    spellcheckIgnoredWords={$spellcheckConfig.ignoredWords}
    spellcheckSuggestionLimit={$spellcheckConfig.suggestionLimit}
    spellcheckMinimumWordLength={$spellcheckConfig.minimumWordLength}
    spellcheckDebounceMs={$spellcheckConfig.debounceMs}
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
