<script lang="ts">
  import type { WorldDraft } from '../../types';

  const emptyDraft: WorldDraft = {
    name: '',
    host: '',
    port: '',
    tls: true,
    verifyCertificate: true,
    compatibility: 'telnet',
  };

  export let draft: WorldDraft = emptyDraft;

  export let onCancel: () => void;
  export let onSave: (draft: WorldDraft) => void;

  let name = '';
  let host = '';
  let port = '';
  let tls = true;
  let verifyCertificate = true;
  let compatibility: WorldDraft['compatibility'] = 'telnet';

  $: name = draft.name;
  $: host = draft.host;
  $: port = draft.port;
  $: tls = draft.tls;
  $: verifyCertificate = draft.tls ? draft.verifyCertificate !== false : false;
  $: compatibility = draft.compatibility;

  function handleSave(): void {
    onSave({
      name,
      host,
      port: String(port),
      tls,
      verifyCertificate,
      compatibility,
    });
  }

  function handleTlsChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    tls = input.checked;
    verifyCertificate = input.checked;
  }
</script>

<div class="host-modal-content host-world-modal-content">
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
    <div class="field">
      <label for="world-compatibility">world compatibility</label>
      <select id="world-compatibility" bind:value={compatibility}>
        <option value="telnet">telnet</option>
        <option value="fuzzball">fuzzball</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" type="button" on:click={onCancel}>cancel</button>
      <button class="btn primary" type="submit">save</button>
    </div>
  </form>
</div>
