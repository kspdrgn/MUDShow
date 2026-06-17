<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Character, HighlightRule } from './lib/types';
  import {
    loadCharacters,
    loadHighlights,
    loadNotes,
    saveCharacters,
    saveHighlights,
    saveNotes,
  } from './lib/storage';
  import { ansiToHtml, applyHighlights, buildHighlightRegexes, stripTelnet } from './lib/formatting';
  import { CompletionManager } from './lib/completion';
  import { MudConnection } from './lib/connection';

  const PROXY_WS_URL = 'ws://localhost:8080';
  const completion = new CompletionManager();
  const connection = new MudConnection();

  let characters = loadCharacters();
  let highlights: HighlightRule[] = loadHighlights();
  let highlightRegexes = buildHighlightRegexes(highlights);
  let screen: 'list' | 'play' = 'list';
  let currentCharacter: Character | null = null;
  let outputChunks: string[] = [];
  let outputEndsWithBr = true;
  let userScrolled = false;
  let activeBar: 1 | 2 = 1;
  let notesVisible = false;
  let highlightsVisible = false;
  let connectionStatus: 'idle' | 'connected' | 'error' = 'idle';
  let hasNewActivity = false;
  let notes = '';
  let highlightInput = '';
  let highlightColor = '#f1c40f';
  let inputOne = '';
  let inputTwo = '';
  let modalOpen = false;
  let modalTitle = 'add character';
  let editingIndex: number | null = null;
  let modalName = '';
  let modalHost = '';
  let modalPort = '';
  let modalTls = true;
  let modalWidth = '82';
  let modalSound = false;
  let outputEl: HTMLDivElement | null = null;
  let notesEl: HTMLTextAreaElement | null = null;
  let highlightInputEl: HTMLInputElement | null = null;
  let input1El: HTMLInputElement | null = null;
  let input2El: HTMLInputElement | null = null;

  $: highlightRegexes = buildHighlightRegexes(highlights);
  $: playWidth = `${currentCharacter?.width ?? 82}ch`;
  $: pageTitle =
    screen === 'play' && currentCharacter
      ? hasNewActivity
        ? `* ${currentCharacter.name}`
        : currentCharacter.name
      : 'MUDShow';

  onMount(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (hasNewActivity) {
          hasNewActivity = false;
        }

        if (!userScrolled) {
          scrollOutputToBottom();
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeModal();
        }
        return;
      }

      if (screen !== 'play') {
        return;
      }

      if (event.key === 'F1') {
        event.preventDefault();
        focusBar(1);
      } else if (event.key === 'F2') {
        event.preventDefault();
        focusBar(2);
      } else if (event.key === 'F3') {
        event.preventDefault();
        void togglePanel('notes');
      } else if (event.key === 'F4') {
        event.preventDefault();
        void togglePanel('highlights');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      connection.close();
    };
  });

  async function openModal(index: number | null = null): Promise<void> {
    editingIndex = index;
    const selected = index === null ? null : characters[index] ?? null;

    if (selected) {
      modalTitle = 'edit character';
      modalName = selected.name;
      modalHost = selected.host;
      modalPort = String(selected.port);
      modalTls = selected.tls !== false;
      modalWidth = String(selected.width ?? 82);
      modalSound = selected.sound === true;
    } else {
      modalTitle = 'add character';
      modalName = '';
      modalHost = '';
      modalPort = '';
      modalTls = true;
      modalWidth = '82';
      modalSound = false;
    }

    modalOpen = true;
    await tick();
    document.getElementById('field-name')?.focus();
  }

  function closeModal(): void {
    modalOpen = false;
    editingIndex = null;
  }

  function saveCharacter(): void {
    const name = modalName.trim();
    const host = modalHost.trim();
    const port = Number.parseInt(modalPort, 10);
    const width = Number.parseInt(modalWidth, 10) || 82;

    if (!name || !host || !Number.isFinite(port)) {
      return;
    }

    const nextCharacter: Character = {
      name,
      host,
      port,
      tls: modalTls,
      width,
      sound: modalSound,
    };

    if (editingIndex === null) {
      characters = [...characters, nextCharacter];
    } else {
      const next = [...characters];
      next[editingIndex] = nextCharacter;
      characters = next;
    }

    saveCharacters(characters);
    closeModal();
  }

  function deleteCharacter(index: number): void {
    const next = [...characters];
    next.splice(index, 1);
    characters = next;
    saveCharacters(characters);
  }

  async function connectToCharacter(index: number): Promise<void> {
    const character = characters[index];
    if (!character) {
      return;
    }

    screen = 'play';
    currentCharacter = character;
    notesVisible = false;
    highlightsVisible = false;
    connectionStatus = 'idle';
    hasNewActivity = false;
    outputChunks = [];
    outputEndsWithBr = true;
    userScrolled = false;
    activeBar = 1;
    inputOne = '';
    inputTwo = '';
    completion.resetCycle();
    notes = loadNotes(character.name);

    await tick();
    focusBar(1);

    const url = `${PROXY_WS_URL}?host=${encodeURIComponent(character.host)}&port=${character.port}&tls=${character.tls !== false}`;

    connection.connect(url, {
      onOpen: () => {
        connectionStatus = 'connected';
        void appendOutput(`\x1b[90m[connected to ${character.host}:${character.port}]\x1b[0m\n`);
      },
      onMessage: (text) => {
        void appendOutput(text);

        if (document.hidden) {
          if (!hasNewActivity) {
            if (character.sound) {
              playBeep();
            }

            hasNewActivity = true;
          }
        }
      },
      onClose: () => {
        connectionStatus = 'error';
        void appendOutput('\x1b[90m[disconnected - press F5 to reconnect]\x1b[0m\n');
      },
      onError: () => {
        connectionStatus = 'error';
        void appendOutput('\x1b[31m[connection error]\x1b[0m\n');
      },
    });
  }

  async function appendOutput(rawText: string): Promise<void> {
    const text = stripTelnet(rawText).replace(/\r+\n/g, '\n');
    completion.harvest(text);

    let html = ansiToHtml(text);
    html = applyHighlights(html, highlightRegexes);

    if (!outputEndsWithBr && !html.startsWith('<br>')) {
      html = '<br>' + html;
    }

    outputEndsWithBr = /<br>\s*(?:<\/[^>]+>)*\s*$/.test(html);
    outputChunks = [...outputChunks, html];

    if (outputChunks.length > 2000) {
      outputChunks = outputChunks.slice(-2000);
    }

    await tick();
    if (!userScrolled) {
      scrollOutputToBottom();
    }
  }

  function scrollOutputToBottom(): void {
    if (!outputEl) {
      return;
    }

    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function handleOutputScroll(): void {
    if (!outputEl) {
      return;
    }

    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    userScrolled = distance > 50;
  }

  function focusBar(bar: 1 | 2): void {
    activeBar = bar;
    const input = bar === 1 ? input1El : input2El;
    input?.focus();
  }

  function sendInput(value: string): void {
    if (!value.trim()) {
      return;
    }

    connection.send(value + '\r\n');
  }

  async function handleInputKeydown(event: KeyboardEvent, bar: 1 | 2): Promise<void> {
    const input = bar === 1 ? input1El : input2El;
    const currentValue = bar === 1 ? inputOne : inputTwo;

    if (event.key === 'Enter') {
      event.preventDefault();
      sendInput(currentValue);

      if (bar === 1) {
        inputOne = '';
      } else {
        inputTwo = '';
      }

      completion.resetCycle();
      await tick();

      if (!userScrolled) {
        scrollOutputToBottom();
      }

      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const result = completion.complete(currentValue, input?.selectionStart ?? currentValue.length);

      if (!result) {
        return;
      }

      if (bar === 1) {
        inputOne = result.value;
      } else {
        inputTwo = result.value;
      }

      await tick();
      input?.setSelectionRange(result.cursor, result.cursor);
      return;
    }

    if (event.key !== 'Shift') {
      completion.resetCycle();
    }
  }

  async function togglePanel(panel: 'notes' | 'highlights'): Promise<void> {
    const shouldOpen = panel === 'notes' ? !notesVisible : !highlightsVisible;

    if (panel === 'notes') {
      notesVisible = shouldOpen;
      highlightsVisible = false;
    } else {
      highlightsVisible = shouldOpen;
      notesVisible = false;
    }

    await tick();

    if (shouldOpen) {
      if (panel === 'notes') {
        notesEl?.focus();
      } else {
        highlightInputEl?.focus();
      }
    } else {
      focusBar(activeBar);
    }
  }

  function addHighlight(): void {
    const pattern = highlightInput.trim();

    if (!pattern) {
      return;
    }

    highlights = [...highlights, { pattern, color: highlightColor }];
    saveHighlights(highlights);
    highlightInput = '';
    highlightInputEl?.focus();
  }

  function deleteHighlight(index: number): void {
    const next = [...highlights];
    next.splice(index, 1);
    highlights = next;
    saveHighlights(highlights);
  }

  function playBeep(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 1100;

      const now = ctx.currentTime;
      const attackSec = 0.2;
      const durationSec = 0.55;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + attackSec);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
      osc.start(now);
      osc.stop(now + durationSec);
    } catch {
      // Audio can be blocked until user gesture; ignore quietly.
    }
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if screen === 'list'}
  <div id="screen-list">
    <h1>MUDShow</h1>

    {#if characters.length === 0}
      <div id="empty-state">no characters yet - add one below</div>
    {/if}

    {#if characters.length > 0}
      <div id="char-list">
        {#each characters as character, index}
          <div class="char-row">
            <span class="char-name">{character.name}</span>
            <span class="char-host">{character.host}:{character.port}</span>
            <div class="char-actions">
              <button class="btn primary" on:click={() => void connectToCharacter(index)}>connect</button>
              <button class="btn" on:click={() => void openModal(index)}>edit</button>
              <button class="btn danger" on:click={() => deleteCharacter(index)}>del</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div id="list-footer">
      <button class="btn primary" on:click={() => void openModal()}>+ add character</button>
    </div>
  </div>
{/if}

<div id="screen-play" class:active={screen === 'play'} style={`--play-width: ${playWidth};`}>
  <div id="highlights-panel" class:open={highlightsVisible}>
    <div id="highlights-label">highlights</div>
    <div id="highlights-list">
      {#if highlights.length === 0}
        <div style="padding:0.5rem 0.8rem;color:var(--text-dim);font-size:0.8rem;">no highlights yet</div>
      {:else}
        {#each highlights as rule, index}
          <div class="highlight-row">
            <div class="highlight-swatch" style={`background:${rule.color}`}></div>
            <span class="highlight-pattern">{rule.pattern}</span>
            <button class="btn danger" on:click={() => deleteHighlight(index)}>del</button>
          </div>
        {/each}
      {/if}
    </div>
    <form id="highlights-add" on:submit|preventDefault={addHighlight}>
      <input
        bind:this={highlightInputEl}
        type="text"
        bind:value={highlightInput}
        placeholder="text to highlight..."
        autocomplete="off"
        spellcheck="false"
      />
      <input type="color" bind:value={highlightColor} />
      <button class="btn primary" type="submit">add</button>
    </form>
  </div>

  <div id="notes-panel" class:open={notesVisible}>
    <div id="notes-label">notes</div>
    <textarea
      bind:this={notesEl}
      id="notes-editor"
      bind:value={notes}
      spellcheck="false"
      placeholder="notes for this character..."
      on:input={() => {
        if (currentCharacter) {
          saveNotes(currentCharacter.name, notes);
        }
      }}
    ></textarea>
  </div>

  <div id="output-area" bind:this={outputEl} on:scroll={handleOutputScroll}>
    {#each outputChunks as chunk}
      <div class="output-chunk">{@html chunk}</div>
    {/each}
  </div>

  <div id="input-area">
    <div id="input-area-inner">
      <div class:focused={activeBar === 1} class="input-bar" id="bar1">
        <span class="input-indicator">F1</span>
        <input
          bind:this={input1El}
          class="mud-input"
          id="input1"
          type="text"
          bind:value={inputOne}
          autocomplete="off"
          spellcheck="false"
          on:focus={() => (activeBar = 1)}
          on:keydown={(event) => void handleInputKeydown(event, 1)}
        />
        <div id="status-dot" class:connected={connectionStatus === 'connected'} class:error={connectionStatus === 'error'}></div>
      </div>
      <div class:focused={activeBar === 2} class="input-bar" id="bar2">
        <span class="input-indicator">F2</span>
        <input
          bind:this={input2El}
          class="mud-input"
          id="input2"
          type="text"
          bind:value={inputTwo}
          autocomplete="off"
          spellcheck="false"
          on:focus={() => (activeBar = 2)}
          on:keydown={(event) => void handleInputKeydown(event, 2)}
        />
      </div>
    </div>
  </div>
</div>

{#if modalOpen}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close modal"
    on:click|self={closeModal}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeModal();
      }
    }}
  >
    <div id="modal">
      <h2>{modalTitle}</h2>
      <form on:submit|preventDefault={saveCharacter}>
        <div class="field">
          <label for="field-name">name</label>
          <input id="field-name" bind:value={modalName} autocomplete="off" />
        </div>
        <div class="field">
          <label for="field-host">host</label>
          <input id="field-host" bind:value={modalHost} autocomplete="off" placeholder="mush.example.org" />
        </div>
        <div class="field">
          <label for="field-port">port</label>
          <input id="field-port" type="number" bind:value={modalPort} autocomplete="off" placeholder="4201" />
        </div>
        <div class="field field-check">
          <label for="field-tls">
            <input id="field-tls" type="checkbox" bind:checked={modalTls} />
            use TLS
          </label>
        </div>
        <div class="field">
          <label for="field-width">output width (characters)</label>
          <input
            id="field-width"
            type="number"
            bind:value={modalWidth}
            autocomplete="off"
            placeholder="82"
            min="40"
            max="300"
          />
        </div>
        <div class="field field-check">
          <label for="field-sound">
            <input id="field-sound" type="checkbox" bind:checked={modalSound} />
            sound on activity when unfocused
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" type="button" on:click={closeModal}>cancel</button>
          <button class="btn primary" type="submit">save</button>
        </div>
      </form>
    </div>
  </div>
{/if}
