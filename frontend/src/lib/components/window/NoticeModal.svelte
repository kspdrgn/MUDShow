<script lang="ts">
  export let message = '';
  export let confirmLabel = 'ok';

  export let onClose: () => void;
</script>

<div class="host-modal-content host-notice-content">
  <p class="settings-note">{message}</p>
  <div class="modal-actions">
    <button class="btn primary" type="button" on:click={onClose}>{confirmLabel}</button>
  </div>
</div>
