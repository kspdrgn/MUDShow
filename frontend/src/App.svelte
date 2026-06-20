<script lang="ts">
  import { onMount } from 'svelte';
  import CharacterList from './lib/components/CharacterList.svelte';
  import CharacterModal from './lib/components/CharacterModal.svelte';
  import PlayScreen from './lib/components/PlayScreen.svelte';
  import { session } from './lib/session';

  $: pageTitle =
    $session.screen === 'play' && $session.currentCharacter
      ? $session.hasNewActivity
        ? `* ${$session.currentCharacter.name}`
        : $session.currentCharacter.name
      : 'MUDShow';

  onMount(() => {
    const handleVisibilityChange = () => session.handleVisibilityChange();
    const handleKeyDown = (event: KeyboardEvent) => session.handleGlobalKeyDown(event);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      session.dispose();
    };
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if $session.screen === 'list'}
  <CharacterList
    characters={$session.characters}
    onConnect={(index) => void session.connectToCharacter(index)}
    onEdit={(index) => void session.openModal(index)}
    onDelete={(index) => session.deleteCharacter(index)}
    onAdd={() => void session.openModal()}
  />
{/if}

{#if $session.screen === 'play'}
  <PlayScreen
    activeBar={$session.activeBar}
    connectionStatus={$session.connectionStatus}
    highlights={$session.highlights}
    highlightsVisible={$session.highlightsVisible}
    notes={$session.notes}
    notesVisible={$session.notesVisible}
    outputChunks={$session.outputChunks}
    playWidth={$session.currentCharacter?.width !== undefined ? `${$session.currentCharacter.width}ch` : 'none'}
    onHighlightAdd={(pattern, color) => session.addHighlight(pattern, color)}
    onHighlightDelete={(index) => session.deleteHighlight(index)}
    onInputFocusBar={(bar) => session.handleInputFocus(bar)}
    onInputSubmit={(bar, value) => session.handleInputSubmit(bar, value)}
    onInputComplete={(bar, value, selectionStart) => session.completeInput(value, selectionStart)}
    onNotesInput={(notes) => session.saveNotes(notes)}
    onOutputScroll={() => session.handleOutputScroll()}
  />
{/if}

<CharacterModal
  open={$session.modalOpen}
  title={$session.modalTitle}
  draft={$session.modalDraft}
  onCancel={() => session.closeModal()}
  onSave={(draft) => session.saveCharacter(draft)}
/>
