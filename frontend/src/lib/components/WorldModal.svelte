<script lang="ts">
  import type { WorldDraft } from '../types';

  const emptyDraft: WorldDraft = {
    name: '',
    host: '',
    port: '',
    tls: true,
    verifyCertificate: true,
  };

  export let open = false;
  export let title = 'add world';
  export let draft: WorldDraft = emptyDraft;

  export let onCancel: () => void;
  export let onSave: (draft: WorldDraft) => void;

  let name = '';
  let host = '';
  let port = '';
  let tls = true;
  let verifyCertificate = true;

  $: if (open) {
    name = draft.name;
    host = draft.host;
    port = draft.port;
    tls = draft.tls;
    verifyCertificate = draft.tls ? draft.verifyCertificate !== false : false;
  }

  function handleSave(): void {
    onSave({
      name,
      host,
      port: String(port),
      tls,
      verifyCertificate,
    });
  }

  function handleTlsChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    tls = input.checked;
    verifyCertificate = input.checked;
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
          <label for="world-name">world name</label>
          <input id="world-name" bind:value={name} autocomplete="off" placeholder="my mud world" />
        </div>
        <div class="field">
          <label for="world-host">host</label>
          <input id="world-host" bind:value={host} autocomplete="off" placeholder="mush.example.org" />
        </div>
        <div class="field">
          <label for="world-port">port</label>
          <input id="world-port" type="number" bind:value={port} autocomplete="off" placeholder="4201" />
        </div>
        <div class="field field-check">
          <label for="world-tls">
            <input id="world-tls" type="checkbox" checked={tls} on:change={handleTlsChange} />
            use TLS
          </label>
        </div>
        <div class="field field-check">
          <label for="world-verify-certificate">
            <input
              id="world-verify-certificate"
              type="checkbox"
              bind:checked={verifyCertificate}
              disabled={!tls}
            />
            verify certificate
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
