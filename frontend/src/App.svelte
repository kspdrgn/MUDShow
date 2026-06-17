<script lang="ts">
  import { onMount } from 'svelte';
  import CharacterList from './lib/components/CharacterList.svelte';
  import CharacterModal from './lib/components/CharacterModal.svelte';
  import PlayScreen from './lib/components/PlayScreen.svelte';
  import type { Character, HighlightRule } from './lib/types';
  import { loadCharacters, loadHighlights } from './lib/storage';
  import { MudSessionController, type SessionUi } from './lib/session';

  let characters = loadCharacters();
  let highlights: HighlightRule[] = loadHighlights();
  let screen: SessionUi['screen'] = 'list';
  let currentCharacter: Character | null = null;
  let outputChunks: string[] = [];
  let outputEndsWithBr = true;
  let userScrolled = false;
  let activeBar: 1 | 2 = 1;
  let notesVisible = false;
  let highlightsVisible = false;
  let connectionStatus: SessionUi['connectionStatus'] = 'idle';
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
  let playScreenRef: any = null;

  const controller = new MudSessionController({
    setUi,
    getUi,
    getCharacters: () => characters,
    setCharacters: (next) => {
      characters = next;
    },
    getHighlights: () => highlights,
    setHighlights: (next) => {
      highlights = next;
    },
    focusBar: (bar) => playScreenRef?.focusBar(bar),
    focusNotes: () => playScreenRef?.focusNotes(),
    focusHighlights: () => playScreenRef?.focusHighlights(),
    scrollToBottom: () => playScreenRef?.scrollToBottom(),
    getTranscriptElement: () => playScreenRef?.getTranscriptElement?.() ?? null,
  });

  $: pageTitle =
    screen === 'play' && currentCharacter
      ? hasNewActivity
        ? `* ${currentCharacter.name}`
        : currentCharacter.name
      : 'MUDShow';

  onMount(() => {
    const handleVisibilityChange = () => controller.handleVisibilityChange();
    const handleKeyDown = (event: KeyboardEvent) => controller.handleGlobalKeyDown(event);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      controller.dispose();
    };
  });

  function setUi(patch: Partial<SessionUi>): void {
    if (patch.screen !== undefined) screen = patch.screen;
    if (patch.currentCharacter !== undefined) currentCharacter = patch.currentCharacter;
    if (patch.outputChunks !== undefined) outputChunks = patch.outputChunks;
    if (patch.outputEndsWithBr !== undefined) outputEndsWithBr = patch.outputEndsWithBr;
    if (patch.userScrolled !== undefined) userScrolled = patch.userScrolled;
    if (patch.activeBar !== undefined) activeBar = patch.activeBar;
    if (patch.notesVisible !== undefined) notesVisible = patch.notesVisible;
    if (patch.highlightsVisible !== undefined) highlightsVisible = patch.highlightsVisible;
    if (patch.connectionStatus !== undefined) connectionStatus = patch.connectionStatus;
    if (patch.hasNewActivity !== undefined) hasNewActivity = patch.hasNewActivity;
    if (patch.notes !== undefined) notes = patch.notes;
    if (patch.highlightInput !== undefined) highlightInput = patch.highlightInput;
    if (patch.highlightColor !== undefined) highlightColor = patch.highlightColor;
    if (patch.inputOne !== undefined) inputOne = patch.inputOne;
    if (patch.inputTwo !== undefined) inputTwo = patch.inputTwo;
    if (patch.modalOpen !== undefined) modalOpen = patch.modalOpen;
    if (patch.modalTitle !== undefined) modalTitle = patch.modalTitle;
    if (patch.editingIndex !== undefined) editingIndex = patch.editingIndex;
    if (patch.modalName !== undefined) modalName = patch.modalName;
    if (patch.modalHost !== undefined) modalHost = patch.modalHost;
    if (patch.modalPort !== undefined) modalPort = patch.modalPort;
    if (patch.modalTls !== undefined) modalTls = patch.modalTls;
    if (patch.modalWidth !== undefined) modalWidth = patch.modalWidth;
    if (patch.modalSound !== undefined) modalSound = patch.modalSound;
  }

  function getUi(): SessionUi {
    return {
      screen,
      currentCharacter,
      outputChunks,
      outputEndsWithBr,
      userScrolled,
      activeBar,
      notesVisible,
      highlightsVisible,
      connectionStatus,
      hasNewActivity,
      notes,
      highlightInput,
      highlightColor,
      inputOne,
      inputTwo,
      modalOpen,
      modalTitle,
      editingIndex,
      modalName,
      modalHost,
      modalPort,
      modalTls,
      modalWidth,
      modalSound,
    };
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if screen === 'list'}
  <CharacterList
    {characters}
    onConnect={(index) => void controller.connectToCharacter(index)}
    onEdit={(index) => void controller.openModal(index)}
    onDelete={(index) => controller.deleteCharacter(index)}
    onAdd={() => void controller.openModal()}
  />
{/if}

{#if screen === 'play'}
  <PlayScreen
    bind:this={playScreenRef}
    bind:activeBar
    bind:connectionStatus
    bind:highlights
    bind:highlightsVisible
    bind:highlightColor
    bind:highlightInput
    bind:inputOne
    bind:inputTwo
    bind:notes
    bind:notesVisible
    {outputChunks}
    playWidth={`${currentCharacter?.width ?? 82}ch`}
    onHighlightAdd={() => controller.addHighlight()}
    onHighlightDelete={(index) => controller.deleteHighlight(index)}
    onInputKeydown={(event, bar) => controller.handleInputKeydown(event, bar)}
    onInputFocusBar={(bar) => controller.handleInputFocus(bar)}
    onNotesInput={() => controller.handleNotesInput()}
    onOutputScroll={() => controller.handleOutputScroll()}
  />
{/if}

<CharacterModal
  open={modalOpen}
  title={modalTitle}
  bind:name={modalName}
  bind:host={modalHost}
  bind:port={modalPort}
  bind:tls={modalTls}
  bind:width={modalWidth}
  bind:sound={modalSound}
  onCancel={() => controller.closeModal()}
  onSave={() => controller.saveCharacter()}
/>
