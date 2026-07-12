<script lang="ts">
  export let open = false;
  export let worldName = '';

  export let onCancel: () => void;
  export let onConfirm: () => void;

  function handleOverlayKeyDown(event: KeyboardEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCancel();
    }
  }
</script>

{#if open}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close tab confirmation"
    on:pointerdown|self={onCancel}
    on:keydown={handleOverlayKeyDown}
  >
    <div id="modal">
      <h2>close world tab?</h2>
      <p class="settings-note">World {worldName} is connected. Disconnect and close?</p>
      <div class="modal-actions">
        <button class="btn" type="button" on:click={onCancel}>cancel</button>
        <button class="btn danger" type="button" on:click={onConfirm}>disconnect and close</button>
      </div>
    </div>
  </div>
{/if}
