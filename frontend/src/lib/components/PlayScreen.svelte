<script lang="ts">
  import type { HighlightRule } from '../types';
  import { type InputBarConfig, type InputBarId } from '../input-bars';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import InputBars from './InputBars.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';
  import type { AppStyleValues } from './style-settings';

  export let scope = 'world';
  export let visible = true;
  export let styleValues: AppStyleValues;
  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let loggingActive = false;
  export let highlights: HighlightRule[] = [];
  export let highlightsVisible = false;
  export let notes = '';
  export let notesVisible = false;
  export let linkImagePreviews = false;
  export let showCurrentOutputWhenScrollingUp = true;
  export let userScrolled = false;
  export let outputChunks: string[] = [];
  export let playWidth = 'none';
  export let onHighlightAdd: (pattern: string, color: string) => void;
  export let onHighlightUpdatePattern: (index: number, pattern: string) => void;
  export let onHighlightUpdateColor: (index: number, color: string) => void;
  export let onHighlightToggleCaseSensitive: (index: number) => void;
  export let onHighlightToggleWordBoundary: (index: number) => void;
  export let onHighlightDelete: (index: number) => void;
  export let onInputFocusBar: (bar: InputBarId) => void;
  export let onInputSubmit: (bar: InputBarId, value: string) => void;
  export let onInputComplete: (
    bar: InputBarId,
    value: string,
    selectionStart: number
  ) => { value: string; cursor: number } | null;
  export let onInputAddBar: (bar: InputBarId) => void;
  export let onInputRemoveBar: (bar: InputBarId) => void;
  export let onInputResizeBar: (bar: InputBarId, delta: -1 | 1) => void;
  export let onNotesInput: (notes: string) => void;
  export let onOutputScroll: () => void;
  export let onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') => void;
  export let onScrollToBottom: () => void;
</script>

<div
  class:active={visible}
  class="screen-play"
  style={`--play-width: ${playWidth};`}
  style:--world-output-font-family={styleValues.output.fontFamily}
  style:--world-output-font-size={`${styleValues.output.fontSize}px`}
  style:--world-output-foreground={styleValues.output.foregroundColor}
  style:--world-output-background={styleValues.output.backgroundColor}
  style:--world-input-font-family={styleValues.input.fontFamily}
  style:--world-input-font-size={`${styleValues.input.fontSize}px`}
  style:--world-input-foreground={styleValues.input.foregroundColor}
  style:--world-input-background={styleValues.input.backgroundColor}
>
  <HighlightsPanel
    open={highlightsVisible}
    {highlights}
    {scope}
    onAdd={onHighlightAdd}
    onUpdatePattern={onHighlightUpdatePattern}
    onUpdateColor={onHighlightUpdateColor}
    onToggleCaseSensitive={onHighlightToggleCaseSensitive}
    onToggleWordBoundary={onHighlightToggleWordBoundary}
    onDelete={onHighlightDelete}
  />

  <NotesPanel open={notesVisible} {notes} {scope} onInput={onNotesInput} />

  <Transcript
    {activeBar}
    chunks={outputChunks}
    width={playWidth}
    {scope}
    {highlights}
    {linkImagePreviews}
    {showCurrentOutputWhenScrollingUp}
    {userScrolled}
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
