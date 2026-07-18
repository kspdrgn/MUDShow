<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let checked = false;
  export let disabled = false;
  export let label = '';

  const dispatch = createEventDispatcher<{ change: boolean }>();
</script>

<label
  class="style-slide-toggle"
  class:style-slide-toggle--checked={checked}
  class:style-slide-toggle--disabled={disabled}
>
  <input
    type="checkbox"
    bind:checked
    disabled={disabled}
    on:change={() => dispatch('change', checked)}
  />
  <span class="style-slide-toggle-track" aria-hidden="true">
    <span class="style-slide-toggle-thumb"></span>
  </span>
  <span class="style-slide-toggle-label">{label}</span>
</label>

<style>
  .style-slide-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    line-height: 1;
    color: var(--text-dim);
    transition: color 0.12s ease;
  }

  .style-slide-toggle:hover,
  .style-slide-toggle:focus-within {
    color: var(--text-bright);
  }

  .style-slide-toggle input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .style-slide-toggle-track {
    position: relative;
    width: 2.6rem;
    height: 1.35rem;
    flex: 0 0 auto;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }

  .style-slide-toggle-thumb {
    position: absolute;
    top: 0.12rem;
    left: 0.12rem;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 50%;
    background: var(--text-bright);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
    transition: transform 0.16s ease;
  }

  .style-slide-toggle--checked .style-slide-toggle-track {
    background: rgba(74, 158, 255, 0.22);
    border-color: rgba(74, 158, 255, 0.42);
  }

  .style-slide-toggle--checked .style-slide-toggle-thumb {
    transform: translateX(1.22rem);
  }

  .style-slide-toggle--disabled {
    cursor: default;
    opacity: 0.55;
  }

  .style-slide-toggle-label {
    font-family: var(--font-ui);
    font-size: 0.64rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    white-space: nowrap;
  }
</style>
