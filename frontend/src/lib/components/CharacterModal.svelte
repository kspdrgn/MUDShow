<script lang="ts">
  import type { CharacterDraft } from '../types';

  const emptyDraft: CharacterDraft = {
    name: '',
    host: '',
    port: '',
    tls: true,
    width: '',
    sound: false,
  };

  export let open = false;
  export let title = 'add character';
  export let draft: CharacterDraft = emptyDraft;

  export let onCancel: () => void;
  export let onSave: (draft: CharacterDraft) => void;

  let name = '';
  let host = '';
  let port = '';
  let tls = true;
  let width = '';
  let sound = false;

  $: if (open) {
    name = draft.name;
    host = draft.host;
    port = draft.port;
    tls = draft.tls;
    width = draft.width;
    sound = draft.sound;
  }

  function handleSave(): void {
    onSave({ name, host, port, tls, width, sound });
  }
</script>

{#if open}
  <div
      id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close modal"
    on:click|self={onCancel}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onCancel();
      }
    }}
  >
    <div id="modal">
      <h2>{title}</h2>
      <form on:submit|preventDefault={handleSave}>
        <div class="field">
          <label for="field-name">name</label>
          <input id="field-name" bind:value={name} autocomplete="off" />
        </div>
        <div class="field">
          <label for="field-host">host</label>
          <input id="field-host" bind:value={host} autocomplete="off" placeholder="mush.example.org" />
        </div>
        <div class="field">
          <label for="field-port">port</label>
          <input id="field-port" type="number" bind:value={port} autocomplete="off" placeholder="4201" />
        </div>
        <div class="field field-check">
          <label for="field-tls">
            <input id="field-tls" type="checkbox" bind:checked={tls} />
            use TLS
          </label>
        </div>
        <div class="field">
          <label for="field-width">max width (optional, characters)</label>
          <input
            id="field-width"
            type="number"
            bind:value={width}
            autocomplete="off"
            placeholder="use 0 for full window"
            min="0"
            max="300"
          />
        </div>
        <div class="field field-check">
          <label for="field-sound">
            <input id="field-sound" type="checkbox" bind:checked={sound} />
            sound on activity when unfocused
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" type="button" on:click={onCancel}>cancel</button>
          <button class="btn primary" type="submit">save</button>
        </div>
      </form>
    </div>
  </div>
{/if}
