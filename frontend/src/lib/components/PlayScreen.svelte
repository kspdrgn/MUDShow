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
  export let highlightColor = '#f1c40f';
  export let highlightInput = '';
  export let inputOne = '';
  export let inputTwo = '';
  export let notes = '';
  export let notesVisible = false;
  export let outputChunks: string[] = [];
  export let playWidth = '82ch';
  export let onHighlightAdd: () => void;
  export let onHighlightDelete: (index: number) => void;
  export let onInputKeydown: (event: KeyboardEvent, bar: 1 | 2) => void | Promise<void>;
  export let onInputFocusBar: (bar: 1 | 2) => void;
  export let onNotesInput: () => void;
  export let onOutputScroll: () => void;

  let transcriptRef: Transcript | null = null;
  let notesPanelRef: NotesPanel | null = null;
  let highlightsPanelRef: HighlightsPanel | null = null;
  let inputBarsRef: InputBars | null = null;

  export function focusNotes(): void {
    notesPanelRef?.focus();
  }

  export function focusHighlights(): void {
    highlightsPanelRef?.focus();
  }

  export function focusBar(bar: 1 | 2): void {
    inputBarsRef?.focus(bar);
  }

  export function scrollToBottom(): void {
    transcriptRef?.scrollToBottom();
  }

  export function getTranscriptElement(): HTMLDivElement | null {
    return transcriptRef?.getElement() ?? null;
  }
</script>

<div id="screen-play" class="active" style={`--play-width: ${playWidth};`}>
  <HighlightsPanel
    bind:this={highlightsPanelRef}
    open={highlightsVisible}
    {highlights}
    bind:highlightInput
    bind:highlightColor
    onAdd={onHighlightAdd}
    onDelete={onHighlightDelete}
  />

  <NotesPanel bind:this={notesPanelRef} open={notesVisible} bind:notes onInput={onNotesInput} />

  <Transcript bind:this={transcriptRef} chunks={outputChunks} width={playWidth} onScroll={onOutputScroll} />

  <InputBars
    bind:this={inputBarsRef}
    bind:activeBar
    bind:inputOne
    bind:inputTwo
    {connectionStatus}
    onFocusBar={onInputFocusBar}
    onInputKeydown={onInputKeydown}
  />
</div>
