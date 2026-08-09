<script lang="ts">
  import type { CharacterDraft } from '../../types';
  import { DEFAULT_OUTPUT_HISTORY_LINES } from '../../session-state';

  const emptyDraft: CharacterDraft = {
    name: '',
    width: '',
    sound: false,
    outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
    connectString: '',
  };

  export let draft: CharacterDraft = emptyDraft;

  export let onCancel: () => void;
  export let onSave: (draft: CharacterDraft) => void;

  let name = '';
  let width = '';
  let sound = false;
  let outputHistoryLines = String(DEFAULT_OUTPUT_HISTORY_LINES);
  let connectString = '';

  $: name = draft.name;
  $: width = draft.width;
  $: sound = draft.sound;
  $: outputHistoryLines = draft.outputHistoryLines ?? String(DEFAULT_OUTPUT_HISTORY_LINES);
  $: connectString = draft.connectString ?? '';

  function handleSave(): void {
    onSave({
      name,
      width: String(width),
      sound,
      outputHistoryLines: String(outputHistoryLines),
      connectString: String(connectString),
    });
  }
</script>

<div class="host-modal-content character-modal">
  <form on:submit|preventDefault={handleSave}>
    <div class="field">
      <label for="field-name">name</label>
      <input id="field-name" bind:value={name} autocomplete="off" />
    </div>
    <div class="field">
      <label for="field-width">max width (optional, characters)</label>
      <input
        id="field-width"
        type="number"
        bind:value={width}
        autocomplete="off"
        placeholder="use 0 for full window"
        min="0"
        max="300"
      />
    </div>
    <div class="field field-check">
      <label for="field-sound">
        <input id="field-sound" type="checkbox" bind:checked={sound} />
        sound on activity when unfocused
      </label>
    </div>
    <div class="field">
      <label for="field-output-history-lines">output history lines</label>
      <input
        id="field-output-history-lines"
        type="number"
        bind:value={outputHistoryLines}
        autocomplete="off"
        min="0"
        max="10000"
        placeholder="0"
      />
    </div>
    <div class="field">
      <label for="field-connect-string">connect string (optional)</label>
      <input id="field-connect-string" bind:value={connectString} autocomplete="off" />
    </div>
    <div class="modal-actions">
      <button class="btn" type="button" on:click={onCancel}>cancel</button>
      <button class="btn primary" type="submit">save</button>
    </div>
  </form>
</div>
