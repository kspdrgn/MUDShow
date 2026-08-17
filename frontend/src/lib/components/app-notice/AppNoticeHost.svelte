<script lang="ts">
  import { onMount } from 'svelte';

  export let open = false;
  export let title = 'modal notice';
  export let onClose: () => void;

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    onClose();
  }

  function closeFromKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    closeFromBackdrop(event as unknown as MouseEvent);
  }

  onMount(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!open || event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  });
</script>

{#if open}
  <div class="app-notice-root" aria-live="polite">
    <div
      class="app-notice-backdrop"
      role="button"
      tabindex="0"
      aria-label={`close ${title}`}
      on:click={closeFromBackdrop}
      on:keydown={closeFromKeydown}
    ></div>

    <div class="app-notice-stack">
      <div class="app-notice-shell" role="dialog" tabindex="-1" aria-modal="true" aria-label={title}>
        <div class="app-notice-body">
          <slot />
        </div>
      </div>
    </div>
  </div>
{/if}
