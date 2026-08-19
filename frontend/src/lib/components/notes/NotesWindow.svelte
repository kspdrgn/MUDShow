<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import SpellcheckContextMenu from '../play/SpellcheckContextMenu.svelte';
  import { getWorldNotesEditorId, getWorldNotesPanelId } from '../../world-dom';
  import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
  import {
    getSpellcheckAnnotations,
    getSpellcheckSuggestions,
    getWordBounds,
    renderSpellcheckUnderlayHtml,
  } from '../../spellcheck';
  import {
    getSelectedSpellcheckWord,
    getTextSelectionInfo,
    replaceSelectedText,
  } from '../play/spellcheck-editor';
  import type { NotesWindowCommand, NotesWindowSnapshot, NotesWindowTransportSession } from './notes-transport';

  export let model: NotesWindowSnapshot['model'];
  export let onCommand: (command: NotesWindowCommand) => void = () => {};
  export let transportSession: NotesWindowTransportSession | null = null;

  let transportSnapshot: NotesWindowSnapshot | null = null;
  let activeModel = model;
  let draftNotes = model.notes;
  let lastAppliedNotes = model.notes;
  let unlistenSnapshot: (() => void) | null = null;
  let notesEditor: HTMLTextAreaElement | null = null;
  let menuOpen = false;
  let menuPosition = { x: 0, y: 0 };
  let menuWord = '';
  let menuSuggestions: string[] = [];
  let menuLoading = false;
  let menuRequestToken = 0;
  let liveUnderlayHtml = '';
  let liveLoading = false;
  let liveRequestToken = 0;
  let liveTimer: number | null = null;
  let liveSignature = '';
  let liveScrollX = 0;
  let liveScrollY = 0;

  function portalToBody(node: HTMLElement): { destroy: () => void } {
    if (typeof document === 'undefined') {
      return {
        destroy: () => {},
      };
    }

    const target = document.body;
    const parent = node.parentNode;
    target.appendChild(node);

    return {
      destroy: () => {
        if (parent && node.parentNode === target) {
          parent.appendChild(node);
        }
      },
    };
  }

  function sendCommand(command: NotesWindowCommand, useRevision = true): void {
    if (transportSession) {
      transportSession.sendCommand(
        command,
        useRevision ? { expectedRevision: transportSession.getRevision() } : {},
      );
      return;
    }

    onCommand(command);
  }

  function logNotesWindow(message: string, details: Record<string, unknown>): void {
    console.debug(`[notes-window] ${message}`, details);
  }

  function syncTransportSession(session: NotesWindowTransportSession | null): void {
    if (unlistenSnapshot) {
      unlistenSnapshot();
      unlistenSnapshot = null;
    }

    transportSnapshot = session?.getSnapshot()?.payload ?? null;
    syncDraftNotesFromModel(transportSnapshot?.model ?? model);
    logNotesWindow('sync transport session', {
      hasSession: session !== null,
      revision: session?.getRevision() ?? null,
      hasSnapshot: transportSnapshot !== null,
      noteLength: transportSnapshot?.model.notes.length ?? 0,
    });

    if (!session) {
      return;
    }

    unlistenSnapshot = session.onSnapshot((envelope) => {
      transportSnapshot = envelope.payload;
      syncDraftNotesFromModel(envelope.payload.model);
      logNotesWindow('snapshot received', {
        revision: envelope.revision,
        noteLength: envelope.payload.model.notes.length,
      });
    });
  }

  function syncDraftNotesFromModel(nextModel: NotesWindowSnapshot['model']): void {
    activeModel = nextModel;

    if (nextModel.notes === lastAppliedNotes) {
      return;
    }

    draftNotes = nextModel.notes;
    lastAppliedNotes = nextModel.notes;
  }

  function getTimestampLabel(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function getLiveSignature(value: string): string {
    return [
      value,
      activeModel.spellcheckEnabled ? '1' : '0',
      activeModel.spellcheckLanguage,
      activeModel.spellcheckIgnoredWords,
      activeModel.spellcheckSuggestionLimit,
      activeModel.spellcheckMinimumWordLength,
    ].join('\u0000');
  }

  function clearLiveTimer(): void {
    if (liveTimer !== null) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
  }

  function clearLiveSpellcheck(): void {
    clearLiveTimer();
    liveUnderlayHtml = '';
    liveLoading = false;
    liveSignature = getLiveSignature(draftNotes);
    liveScrollX = 0;
    liveScrollY = 0;
  }

  async function refreshLiveSpellcheck(value: string): Promise<void> {
    liveSignature = getLiveSignature(value);

    if (!activeModel.spellcheckEnabled) {
      clearLiveSpellcheck();
      return;
    }

    const token = liveRequestToken + 1;
    liveRequestToken = token;
    liveLoading = true;

    try {
      const annotations = await getSpellcheckAnnotations({
        text: value,
        word: '',
        language: activeModel.spellcheckLanguage,
        ignoredWords: activeModel.spellcheckIgnoredWords,
        minimumWordLength: activeModel.spellcheckMinimumWordLength,
        suggestionLimit: activeModel.spellcheckSuggestionLimit,
      });

      if (liveRequestToken !== token) {
        return;
      }

      liveUnderlayHtml = renderSpellcheckUnderlayHtml(value, annotations);
    } catch (error) {
      if (liveRequestToken === token) {
        console.error('failed to fetch live notes spellcheck annotations:', error);
        liveUnderlayHtml = '';
      }
    } finally {
      if (liveRequestToken === token) {
        liveLoading = false;
      }
    }
  }

  function scheduleLiveSpellcheck(value: string): void {
    clearLiveTimer();

    if (!activeModel.spellcheckEnabled) {
      clearLiveSpellcheck();
      return;
    }

    liveTimer = window.setTimeout(() => {
      void refreshLiveSpellcheck(value);
    }, activeModel.spellcheckDebounceMs);
  }

  function syncLiveScroll(event: Event): void {
    const input = event.currentTarget as HTMLTextAreaElement | null;
    if (!input) {
      return;
    }

    liveScrollX = input.scrollLeft;
    liveScrollY = input.scrollTop;
  }

  async function loadMenuSuggestions(word: string): Promise<void> {
    const token = ++menuRequestToken;
    const normalizedWord = word.trim();

    if (!normalizedWord || normalizedWord.length < activeModel.spellcheckMinimumWordLength) {
      if (menuRequestToken === token) {
        menuSuggestions = [];
        menuLoading = false;
      }
      return;
    }

    menuLoading = true;

    try {
      const suggestions = await getSpellcheckSuggestions({
        word: normalizedWord,
        language: activeModel.spellcheckLanguage,
        ignoredWords: activeModel.spellcheckIgnoredWords,
        minimumWordLength: activeModel.spellcheckMinimumWordLength,
        suggestionLimit: activeModel.spellcheckSuggestionLimit,
      });

      if (menuRequestToken !== token || !menuOpen) {
        return;
      }

      menuSuggestions = suggestions;
    } catch (error) {
      if (menuRequestToken === token) {
        menuSuggestions = [];
        console.error('failed to fetch notes spellcheck suggestions:', error);
      }
    } finally {
      if (menuRequestToken === token) {
        menuLoading = false;
      }
    }
  }

  function openMenu(event: MouseEvent): void {
    const editor = notesEditor;
    if (!editor) {
      return;
    }

    const selection = getTextSelectionInfo(editor);
    if (!selection) {
      return;
    }

    const { selectedText, word } = getSelectedSpellcheckWord(
      editor.value,
      selection.selectionStart,
      selection.selectionEnd,
      getWordBounds,
    );

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'spellcheck' } }));
    menuOpen = true;
    menuPosition = { x: event.clientX, y: event.clientY };
    menuWord = selectedText || word;
    menuSuggestions = [];
    void loadMenuSuggestions(menuWord);
  }

  function closeMenu(): void {
    menuRequestToken += 1;
    menuLoading = false;
    menuSuggestions = [];
    menuOpen = false;
    menuWord = '';
  }

  function applyReplacement(replacement: string): void {
    replaceSelectedText(notesEditor, replacement);
  }

  async function copySelection(): Promise<void> {
    const selection = getTextSelectionInfo(notesEditor);
    if (!selection || !selection.selectedText) {
      return;
    }

    try {
      await copyTextToClipboard(selection.selectedText);
    } catch (error) {
      console.error('failed to copy notes selection:', error);
    }
  }

  async function cutSelection(): Promise<void> {
    const selection = getTextSelectionInfo(notesEditor);
    if (!selection || !selection.selectedText) {
      return;
    }

    try {
      await copyTextToClipboard(selection.selectedText);
      applyReplacement('');
    } catch (error) {
      console.error('failed to cut notes selection:', error);
    }
  }

  async function pasteClipboard(): Promise<void> {
    if (!notesEditor) {
      return;
    }

    try {
      const text = await readTextFromClipboard();
      applyReplacement(text);
    } catch (error) {
      console.error('failed to paste notes text:', error);
    }
  }

  function selectAll(): void {
    if (!notesEditor) {
      return;
    }

    notesEditor.focus();
    notesEditor.setSelectionRange(0, notesEditor.value.length);
  }

  function ignoreAlways(): void {
    if (menuWord) {
      sendCommand({ type: 'ignoreWordRequested', word: menuWord });
    }
    closeMenu();
  }

  function requestClose(): void {
    sendCommand({ type: 'closeRequested' });
  }

  function handleNotesInput(event: Event): void {
    const editor = event.currentTarget as HTMLTextAreaElement | null;
    if (!editor) {
      return;
    }

    draftNotes = editor.value;
    lastAppliedNotes = draftNotes;
    sendCommand({ type: 'notesChanged', notes: draftNotes }, false);
  }

  function syncSnapshotNotes(): void {
    const nextNotes = transportSnapshot?.model.notes ?? model.notes;
    if (nextNotes !== lastAppliedNotes) {
      draftNotes = nextNotes;
      lastAppliedNotes = nextNotes;
    }
  }

  $: activeModel = transportSnapshot?.model ?? model;
  $: syncTransportSession(transportSession);
  $: {
    if (!activeModel.spellcheckEnabled) {
      closeMenu();
      clearLiveSpellcheck();
    } else {
      const nextSignature = getLiveSignature(draftNotes);
      if (nextSignature !== liveSignature) {
        scheduleLiveSpellcheck(draftNotes);
      }
    }
  }

  onMount(() => {
    document.addEventListener('mouseup', handleMouseUp);
    scheduleLiveSpellcheck(draftNotes);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      clearLiveTimer();
    };
  });

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !notesEditor) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!notesEditor.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = selection.toString();
    if (text.trim()) {
      try {
        await copyTextToClipboard(text);
      } catch (error) {
        console.error('failed to copy notes selection:', error);
      }
    }
  }

  onDestroy(() => syncTransportSession(null));
</script>

<section class="notes-window">
  <header class="notes-window-header">
    <div class="notes-window-copy">
      <p class="notes-window-kicker">notes</p>
      <h2>{activeModel.title}</h2>
      {#if activeModel.description}
        <p class="notes-window-description">{activeModel.description}</p>
      {/if}
      <p class="notes-window-cache-id">
        persistence cache id: {activeModel.characterId ?? 'none'}
      </p>
    </div>

    <div class="notes-window-actions">
      <button
        type="button"
        class="btn notes-window-close"
        aria-label="Close notes"
        title="Close notes"
        on:click={requestClose}
      >
        X
      </button>
    </div>
  </header>

  <div class="notes-editor-shell">
    <div class="spellcheck-underlay" aria-hidden="true" data-loading={liveLoading}>
      <div
        class="spellcheck-underlay-content"
        style:transform={`translate(${-liveScrollX}px, ${-liveScrollY}px)`}
      >
        {@html liveUnderlayHtml}
      </div>
    </div>
    <textarea
      class="notes-editor spellcheck-input"
      id={getWorldNotesEditorId(activeModel.sourceTabId || activeModel.worldId || 'notes')}
      bind:this={notesEditor}
      bind:value={draftNotes}
      lang={activeModel.spellcheckLanguage}
      spellcheck="false"
      placeholder="notes for this character..."
      on:input={handleNotesInput}
      on:scroll={syncLiveScroll}
      on:contextmenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(event);
      }}
    ></textarea>
  </div>
</section>

<div use:portalToBody>
  <SpellcheckContextMenu
    open={menuOpen}
    position={menuPosition}
    ariaLabel="notes spellcheck context menu"
    suggestions={menuSuggestions}
    loading={menuLoading}
    onDismiss={closeMenu}
    onCopy={() => void copySelection()}
    onCut={() => void cutSelection()}
    onPaste={() => void pasteClipboard()}
    onSelectAll={selectAll}
    onIgnoreOnce={closeMenu}
    onIgnoreAlways={ignoreAlways}
    onChooseSuggestion={(suggestion) => {
      applyReplacement(suggestion);
      closeMenu();
    }}
  />
</div>

<style>
  .notes-window {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 1rem;
    color: var(--text-color, #e7eef9);
    background:
      radial-gradient(circle at top right, rgba(107, 126, 255, 0.18), transparent 32%),
      linear-gradient(180deg, rgba(16, 20, 28, 0.98), rgba(10, 13, 19, 0.98));
  }

  .notes-window-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .notes-window-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .notes-window-kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.72rem;
    color: rgba(200, 214, 245, 0.65);
  }

  .notes-window h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 650;
  }

  .notes-window-description {
    margin: 0;
    max-width: 34rem;
    color: rgba(231, 238, 249, 0.72);
  }

  .notes-window-cache-id {
    margin: 0;
    max-width: 34rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    color: rgba(200, 214, 245, 0.58);
    word-break: break-all;
  }

  .notes-window-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .notes-window-close {
    min-width: 2rem;
    padding: 0.2rem 0.55rem;
    line-height: 1;
  }

  .notes-editor-shell {
    position: relative;
    min-height: 18rem;
    display: grid;
  }

  .spellcheck-underlay,
  .notes-editor {
    grid-area: 1 / 1;
  }

  .spellcheck-underlay {
    overflow: hidden;
    border-radius: 0.9rem;
    border: 1px solid rgba(145, 164, 205, 0.14);
    background: rgba(5, 7, 10, 0.42);
    pointer-events: none;
  }

  .spellcheck-underlay-content {
    min-height: 100%;
    padding: 0.85rem;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .notes-editor {
    width: 100%;
    min-height: 18rem;
    resize: vertical;
    border-radius: 0.9rem;
    border: 1px solid rgba(145, 164, 205, 0.14);
    background: transparent;
    color: inherit;
    padding: 0.85rem;
    box-sizing: border-box;
  }
</style>
