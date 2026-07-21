<script lang="ts">
  export let status: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  export let variant: 'connection' | 'activity' | 'logging' = 'connection';
  export let active = true;
</script>

<div
  class="status-dot"
  class:inactive={!active}
  class:connecting={status === 'connecting'}
  class:connected={status === 'connected'}
  class:disconnected={status === 'disconnected'}
  class:activity={variant === 'activity'}
  class:logging={variant === 'logging'}
></div>
