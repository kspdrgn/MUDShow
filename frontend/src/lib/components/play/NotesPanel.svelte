<script lang="ts">
  import SpellcheckContextMenu from './SpellcheckContextMenu.svelte';
  import { getWorldNotesEditorId, getWorldNotesPanelId } from '../../world-dom';
  import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
  import { getWordBounds } from '../../spellcheck';

  export let open = false;
  export let notes = '';
  export let scope = 'world';
  export let onInput: (notes: string) => void;
  export let onClose: () => void;
  export let spellcheckEnabled = true;
  export let spellcheckLanguage = 'en-US';
  export let onIgnoreWord: (word: string) => void;

  let draft = notes;
  let lastNotes = notes;
  let lastOpen = false;
  let notesEditor: HTMLTextAreaElement | null = null;
  let menuOpen = false;
  let menuPosition = { x: 0, y: 0 };
  let menuWord = '';

  $: if (open && (!lastOpen || notes !== lastNotes)) {
    draft = notes;
  }

  $: {
    lastOpen = open;
    lastNotes = notes;
  }

  function closeMenu(): void {
    menuOpen = false;
    menuWord = '';
  }

  function applyReplacement(replacement: string): void {
    if (!notesEditor) {
      return;
    }

    const selectionStart = notesEditor.selectionStart ?? 0;
    const selectionEnd = notesEditor.selectionEnd ?? selectionStart;
    notesEditor.setRangeText(replacement, selectionStart, selectionEnd, 'end');
    notesEditor.dispatchEvent(new Event('input', { bubbles: true }));
    notesEditor.focus();
  }

  function openMenu(event: MouseEvent): void {
    if (!notesEditor) {
      return;
    }

    const selectionStart = notesEditor.selectionStart ?? 0;
    const selectionEnd = notesEditor.selectionEnd ?? selectionStart;
    const selectedText = notesEditor.value.slice(selectionStart, selectionEnd).trim();
    const word = getWordBounds(notesEditor.value, selectionStart, selectionEnd);

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'spellcheck' } }));
    menuOpen = true;
    menuPosition = { x: event.clientX, y: event.clientY };
    menuWord = selectedText || word?.word || '';
  }

  async function copySelection(): Promise<void> {
    if (!notesEditor) {
      return;
    }

    const selectionStart = notesEditor.selectionStart ?? 0;
    const selectionEnd = notesEditor.selectionEnd ?? selectionStart;
    const selectedText = notesEditor.value.slice(selectionStart, selectionEnd);
    if (selectedText) {
      try {
        await copyTextToClipboard(selectedText);
      } catch (error) {
        console.error('failed to copy notes selection:', error);
      }
    }
  }

  async function cutSelection(): Promise<void> {
    if (!notesEditor) {
      return;
    }

    const selectionStart = notesEditor.selectionStart ?? 0;
    const selectionEnd = notesEditor.selectionEnd ?? selectionStart;
    const selectedText = notesEditor.value.slice(selectionStart, selectionEnd);
    if (!selectedText) {
      return;
    }

    try {
      await copyTextToClipboard(selectedText);
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
      onIgnoreWord(menuWord);
    }
    closeMenu();
  }
</script>

<div class="notes-panel" id={getWorldNotesPanelId(scope)} class:open={open}>
  <div class="panel-header">
    <div class="notes-label">notes</div>
    <button
      type="button"
      class="btn panel-close"
      aria-label="Close notes panel"
      title="Close notes panel"
      on:click={onClose}
    >
      X
    </button>
  </div>
  <textarea
    class="notes-editor"
    id={getWorldNotesEditorId(scope)}
    bind:this={notesEditor}
    bind:value={draft}
    lang={spellcheckLanguage}
    spellcheck={spellcheckEnabled}
    placeholder="notes for this character..."
    on:input={() => onInput(draft)}
    on:contextmenu={(event) => {
      event.preventDefault();
      openMenu(event);
    }}
  ></textarea>
</div>

<SpellcheckContextMenu
  open={menuOpen}
  position={menuPosition}
  ariaLabel="notes spellcheck context menu"
  suggestions={[]}
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
