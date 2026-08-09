<script lang="ts">
  export let title = 'close world tab?';
  export let message = '';
  export let confirmLabel = 'disconnect and close';

  export let onCancel: () => void;
  export let onConfirm: () => void;
</script>

<div class="host-modal-content host-confirm-close-content" aria-label={title}>
  <p class="settings-note">{message}</p>
  <div class="modal-actions">
    <button class="btn" type="button" on:click={onCancel}>cancel</button>
    <button class="btn danger" type="button" on:click={onConfirm}>{confirmLabel}</button>
  </div>
</div>
