<script lang="ts">
  import { getWorldNotesEditorId, getWorldNotesPanelId } from '../world-dom';

  export let open = false;
  export let notes = '';
  export let scope = 'world';
  export let onInput: (notes: string) => void;

  let draft = notes;
  let lastNotes = notes;
  let lastOpen = false;

  $: if (open && (!lastOpen || notes !== lastNotes)) {
    draft = notes;
  }

  $: {
    lastOpen = open;
    lastNotes = notes;
  }
</script>

<div class="notes-panel" id={getWorldNotesPanelId(scope)} class:open={open}>
  <div class="notes-label">notes</div>
  <textarea
    id={getWorldNotesEditorId(scope)}
    bind:value={draft}
    spellcheck="true"
    placeholder="notes for this character..."
    on:input={() => onInput(draft)}
  ></textarea>
</div>
