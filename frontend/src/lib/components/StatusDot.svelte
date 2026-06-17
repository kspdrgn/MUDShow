<script lang="ts">
  export let status: 'idle' | 'connected' | 'error' = 'idle';
</script>

<div
  id="status-dot"
  class:connected={status === 'connected'}
  class:error={status === 'error'}
></div>
