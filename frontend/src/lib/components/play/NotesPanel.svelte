<script lang="ts">
  import { onDestroy } from 'svelte';
  import SpellcheckContextMenu from './SpellcheckContextMenu.svelte';
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
  } from './spellcheck-editor';

  export let open = false;
  export let embedded = false;
  export let notes = '';
  export let scope = 'world';
  export let onInput: (notes: string) => void;
  export let onClose: () => void;
  export let spellcheckEnabled = true;
  export let spellcheckLanguage = 'en-US';
  export let spellcheckIgnoredWords = '';
  export let spellcheckSuggestionLimit = 5;
  export let spellcheckMinimumWordLength = 3;
  export let spellcheckDebounceMs = 250;
  export let onIgnoreWord: (word: string) => void;

  let draft = notes;
  let lastNotes = notes;
  let lastOpen = false;
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

  $: if (open && (!lastOpen || notes !== lastNotes)) {
    draft = notes;
  }

  $: {
    lastOpen = open;
    lastNotes = notes;
  }

  $: {
    if (!open) {
      closeMenu();
      clearLiveSpellcheck();
    } else {
      draft;
      spellcheckEnabled;
      spellcheckLanguage;
      spellcheckIgnoredWords;
      spellcheckSuggestionLimit;
      spellcheckMinimumWordLength;
      spellcheckDebounceMs;

      const nextSignature = getLiveSignature(draft);
      if (nextSignature !== liveSignature) {
        scheduleLiveSpellcheck(draft);
      }
    }
  }

  function closeMenu(): void {
    menuRequestToken += 1;
    menuLoading = false;
    menuSuggestions = [];
    menuOpen = false;
    menuWord = '';
  }

  function getLiveSignature(value: string): string {
    return [
      value,
      spellcheckEnabled ? '1' : '0',
      spellcheckLanguage,
      spellcheckIgnoredWords,
      spellcheckSuggestionLimit,
      spellcheckMinimumWordLength,
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
    liveSignature = getLiveSignature(draft);
    liveScrollX = 0;
    liveScrollY = 0;
  }

  async function refreshLiveSpellcheck(value: string): Promise<void> {
    liveSignature = getLiveSignature(value);

    if (!spellcheckEnabled) {
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
        language: spellcheckLanguage,
        ignoredWords: spellcheckIgnoredWords,
        minimumWordLength: spellcheckMinimumWordLength,
        suggestionLimit: spellcheckSuggestionLimit,
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

    if (!spellcheckEnabled) {
      clearLiveSpellcheck();
      return;
    }

    liveTimer = window.setTimeout(() => {
      void refreshLiveSpellcheck(value);
    }, spellcheckDebounceMs);
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

    if (!normalizedWord || normalizedWord.length < spellcheckMinimumWordLength) {
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
        language: spellcheckLanguage,
        ignoredWords: spellcheckIgnoredWords,
        minimumWordLength: spellcheckMinimumWordLength,
        suggestionLimit: spellcheckSuggestionLimit,
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

  function applyReplacement(replacement: string): void {
    replaceSelectedText(notesEditor, replacement);
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

  async function copySelection(): Promise<void> {
    const selection = getTextSelectionInfo(notesEditor);
    if (!selection) {
      return;
    }

    if (!selection.selectedText) {
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
    if (!selection) {
      return;
    }

    if (!selection.selectedText) {
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
      onIgnoreWord(menuWord);
    }
    closeMenu();
  }

  onDestroy(() => {
    clearLiveTimer();
  });
</script>

<div
  class="notes-panel"
  class:embedded={embedded}
  id={getWorldNotesPanelId(scope)}
  class:open={open}
>
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
      id={getWorldNotesEditorId(scope)}
      bind:this={notesEditor}
      bind:value={draft}
      lang={spellcheckLanguage}
      spellcheck="false"
      placeholder="notes for this character..."
      on:input={() => onInput(draft)}
      on:scroll={syncLiveScroll}
      on:contextmenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(event);
      }}
    ></textarea>
  </div>
</div>

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
