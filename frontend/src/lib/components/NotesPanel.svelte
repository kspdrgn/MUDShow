<script lang="ts">
  export let open = false;
  export let notes = '';
  export let onInput: () => void;
  let notesEl: HTMLTextAreaElement | null = null;

  export function focus(): void {
    notesEl?.focus();
  }
</script>

<div id="notes-panel" class:open={open}>
  <div id="notes-label">notes</div>
  <textarea
    bind:this={notesEl}
    id="notes-editor"
    bind:value={notes}
    spellcheck="false"
    placeholder="notes for this character..."
    on:input={onInput}
  ></textarea>
</div>
