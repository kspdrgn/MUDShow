<script lang="ts">
  export let status: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
</script>

<div
  class="status-dot"
  class:connecting={status === 'connecting'}
  class:connected={status === 'connected'}
  class:disconnected={status === 'disconnected'}
></div>
