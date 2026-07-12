<script lang="ts">
  export let open = false;
  export let title = '';
  export let message = '';
  export let confirmLabel = 'ok';

  export let onClose: () => void;

  function handleOverlayKeyDown(event: KeyboardEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  }
</script>

{#if open}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label={title || 'notice modal'}
    on:click|self={onClose}
    on:keydown={handleOverlayKeyDown}
  >
    <div id="modal">
      <h2>{title}</h2>
      <p class="settings-note">{message}</p>
      <div class="modal-actions">
        <button class="btn primary" type="button" on:click={onClose}>{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}
