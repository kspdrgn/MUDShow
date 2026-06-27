<script lang="ts">
  import type { CharacterDraft } from '../types';
  import { DEFAULT_OUTPUT_HISTORY_LINES } from '../session-state';

  const emptyDraft: CharacterDraft = {
    name: '',
    host: '',
    port: '',
    tls: true,
    verifyCertificate: true,
    width: '',
    sound: false,
    outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
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
  let verifyCertificate = true;
  let width = '';
  let sound = false;
  let outputHistoryLines = String(DEFAULT_OUTPUT_HISTORY_LINES);

  $: if (open) {
    name = draft.name;
    host = draft.host;
    port = draft.port;
    tls = draft.tls;
    verifyCertificate = draft.tls ? draft.verifyCertificate !== false : false;
    width = draft.width;
    sound = draft.sound;
    outputHistoryLines = draft.outputHistoryLines ?? String(DEFAULT_OUTPUT_HISTORY_LINES);
  }

  function handleSave(): void {
    onSave({
      name,
      host,
      port: String(port),
      tls,
      verifyCertificate,
      width: String(width),
      sound,
      outputHistoryLines: String(outputHistoryLines),
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
            <input id="field-tls" type="checkbox" checked={tls} on:change={handleTlsChange} />
            use TLS
          </label>
        </div>
        <div class="field field-check">
          <label for="field-verify-certificate">
            <input
              id="field-verify-certificate"
              type="checkbox"
              bind:checked={verifyCertificate}
              disabled={!tls}
            />
            verify certificate
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
        <div class="field">
          <label for="field-output-history-lines">output history lines</label>
          <input
            id="field-output-history-lines"
          type="number"
          bind:value={outputHistoryLines}
          autocomplete="off"
          min="0"
          max="10000"
          placeholder="0"
        />
      </div>
        <div class="modal-actions">
          <button class="btn" type="button" on:click={onCancel}>cancel</button>
          <button class="btn primary" type="submit">save</button>
        </div>
      </form>
    </div>
  </div>
{/if}
