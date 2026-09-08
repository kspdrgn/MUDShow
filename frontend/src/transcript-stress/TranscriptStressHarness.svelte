<script lang="ts">
  import Transcript from '../lib/components/play/Transcript.svelte';
  import { PlayTranscript } from '../lib/playback';

  type Pane = { id: string; transcript: PlayTranscript; revision: number; userScrolled: boolean };

  let panes: Pane[] = [createPane('stress-a'), createPane('stress-b')];
  let activePaneId = 'stress-a';
  let showSplit = true;
  let chunkNumber = 0;

  function createPane(id: string): Pane {
    const transcript = new PlayTranscript(50_000);
    for (let index = 0; index < 40; index += 1) {
      transcript.append(`[${id}] initial line ${index}\n`);
    }
    return { id, transcript, revision: 1, userScrolled: false };
  }

  function getPane(id = activePaneId): Pane {
    return panes.find((pane) => pane.id === id)!;
  }

  function append(count = 1): void {
    const pane = getPane();
    for (let index = 0; index < count; index += 1) {
      chunkNumber += 1;
      pane.transcript.append(`[${pane.id}] stress output ${chunkNumber} — ${'lorem ipsum '.repeat(8)}\n`);
    }
    pane.revision += 1;
    panes = [...panes];
  }

  function switchPane(): void {
    activePaneId = activePaneId === 'stress-a' ? 'stress-b' : 'stress-a';
    panes = [...panes];
  }

  function setScrolled(value: boolean): void {
    getPane().userScrolled = value;
    panes = [...panes];
  }

  function noop(): void {}
</script>

<div class="stress-page">
  <h1>Transcript stress harness</h1>
  <p>Use these controls with browser automation or manually to exercise transcript reliability.</p>
  <div class="stress-controls">
    <button data-testid="append-one" on:click={() => append()}>append output</button>
    <button data-testid="append-many" on:click={() => append(500)}>append 500 chunks</button>
    <button data-testid="switch-pane" on:click={switchPane}>switch inactive tab</button>
    <button data-testid="toggle-split" on:click={() => (showSplit = !showSplit)}>toggle split</button>
    <button data-testid="mark-scrolled" on:click={() => setScrolled(true)}>mark manually scrolled</button>
    <button data-testid="mark-following" on:click={() => setScrolled(false)}>restore follow mode</button>
  </div>
  <p data-testid="active-pane">active: {activePaneId}</p>
  <div class="stress-viewport" data-testid="stress-viewport">
    {#each panes as pane (pane.id)}
      <section class:stress-hidden={pane.id !== activePaneId} data-testid={`pane-${pane.id}`}>
        <Transcript
          scope={pane.id}
          transcript={pane.transcript}
          outputRevision={pane.revision}
          userScrolled={pane.userScrolled}
          showCurrentOutputWhenScrollingUp={showSplit}
          activeBar={1}
          onReconnect={noop}
          onDisconnect={noop}
          onQuickLog={noop}
          onStopLogging={noop}
          onOpenLogging={noop}
          onEditWorld={noop}
          onEditCharacter={noop}
          onOpenNotes={noop}
          onOpenDebugConsole={noop}
          onOpenTriggers={noop}
          onOpenStyles={noop}
          onCloseRequest={noop}
          onScroll={noop}
          onScrollToBottom={() => setScrolled(false)}
        />
      </section>
    {/each}
  </div>
</div>

<style>
  .stress-page { height: 100vh; display: flex; flex-direction: column; padding: 1rem; box-sizing: border-box; background: #151515; color: #eee; }
  .stress-controls { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .5rem; }
  .stress-viewport { flex: 1; min-height: 0; border: 1px solid #555; resize: both; overflow: hidden; }
  .stress-viewport > section { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .stress-viewport > section.stress-hidden { display: none; }
  .stress-viewport :global(.screen-play) { height: 100%; min-height: 0; overflow: hidden; }
</style>
