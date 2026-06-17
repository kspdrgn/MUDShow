<script lang="ts">
  export let open = false;
  export let notes = '';
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

<div id="notes-panel" class:open={open}>
  <div id="notes-label">notes</div>
  <textarea
    id="notes-editor"
    bind:value={draft}
    spellcheck="false"
    placeholder="notes for this character..."
    on:input={() => onInput(draft)}
  ></textarea>
</div>
