<script lang="ts">
  import type { HighlightRule } from '../types';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import InputBars from './InputBars.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import Transcript from './Transcript.svelte';

  export let activeBar: 1 | 2 = 1;
  export let connectionStatus: 'idle' | 'connected' | 'error' = 'idle';
  export let highlights: HighlightRule[] = [];
  export let highlightsVisible = false;
  export let notes = '';
  export let notesVisible = false;
  export let outputChunks: string[] = [];
  export let playWidth = '82ch';
  export let onHighlightAdd: (pattern: string, color: string) => void;
  export let onHighlightDelete: (index: number) => void;
  export let onInputFocusBar: (bar: 1 | 2) => void;
  export let onInputSubmit: (bar: 1 | 2, value: string) => void;
  export let onInputComplete: (
    bar: 1 | 2,
    value: string,
    selectionStart: number
  ) => { value: string; cursor: number } | null;
  export let onNotesInput: (notes: string) => void;
  export let onOutputScroll: () => void;
</script>

<div id="screen-play" class="active" style={`--play-width: ${playWidth};`}>
  <HighlightsPanel open={highlightsVisible} {highlights} onAdd={onHighlightAdd} onDelete={onHighlightDelete} />

  <NotesPanel open={notesVisible} {notes} onInput={onNotesInput} />

  <Transcript chunks={outputChunks} width={playWidth} onScroll={onOutputScroll} />

  <InputBars
    {activeBar}
    {connectionStatus}
    onFocusBar={onInputFocusBar}
    onSubmit={onInputSubmit}
    onComplete={onInputComplete}
  />
</div>
