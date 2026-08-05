<script lang="ts">
  const randomString = Math.random().toString(36).slice(2, 10);

  export let open = false;
  export let title = 'dummy panel';
</script>

<div class="world-channels-dummy-copy" class:open={open} aria-hidden={!open}>
  <div class="world-channels-dummy-title">{title}</div>
  <div class="world-channels-dummy-text">
    Random content: {randomString}
  </div>
</div>
