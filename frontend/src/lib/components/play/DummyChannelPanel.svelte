<script lang="ts">
  function makeRandomString(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  const randomString = makeRandomString();
</script>

<div class="world-channels-dummy-copy">
  <div class="world-channels-dummy-title">dummy panel</div>
  <div class="world-channels-dummy-text">
    Random content: {randomString}
  </div>
</div>
