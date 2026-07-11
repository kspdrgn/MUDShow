<script lang="ts">
  import type { HighlightRule } from '../types';
  import { type InputBarConfig, type InputBarId } from '../input-bars';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import InputBars from './InputBars.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';

  export let scope = 'world';
  export let visible = true;
  export let bars: InputBarConfig[] = [];
  export let activeBar: InputBarId = 1;
  export let connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let highlights: HighlightRule[] = [];
  export let highlightsVisible = false;
  export let notes = '';
  export let notesVisible = false;
  export let linkImagePreviews = false;
  export let userScrolled = false;
  export let outputChunks: string[] = [];
  export let outputRevision = 0;
  export let playWidth = 'none';
  export let onHighlightAdd: (pattern: string, color: string) => void;
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
  export let onScrollToBottom: () => void;
</script>

<div class:active={visible} class="screen-play" style={`--play-width: ${playWidth};`}>
  <HighlightsPanel open={highlightsVisible} {highlights} {scope} onAdd={onHighlightAdd} onDelete={onHighlightDelete} />

  <NotesPanel open={notesVisible} {notes} {scope} onInput={onNotesInput} />

  {#key outputRevision}
    <Transcript
      {activeBar}
      chunks={outputChunks}
      width={playWidth}
      {scope}
      {highlights}
      {linkImagePreviews}
      {userScrolled}
      onScroll={onOutputScroll}
      onScrollToBottom={onScrollToBottom}
    />
  {/key}

  <InputBars
    {bars}
    {activeBar}
    {connectionStatus}
    {scope}
    onFocusBar={onInputFocusBar}
    onSubmit={onInputSubmit}
    onComplete={onInputComplete}
    onAddBar={onInputAddBar}
    onRemoveBar={onInputRemoveBar}
    onResizeBar={onInputResizeBar}
  />
</div>
