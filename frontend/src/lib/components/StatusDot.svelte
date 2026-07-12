<script lang="ts">
  export let status: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let variant: 'connection' | 'logging' = 'connection';
</script>

<div
  class="status-dot"
  class:connecting={status === 'connecting'}
  class:connected={status === 'connected'}
  class:disconnected={status === 'disconnected'}
  class:logging={variant === 'logging'}
></div>
