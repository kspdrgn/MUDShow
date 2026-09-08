import { mount } from 'svelte';
import '../app.css';
import TranscriptStressHarness from './transcript-stress/TranscriptStressHarness.svelte';

mount(TranscriptStressHarness, {
  target: document.getElementById('transcript-stress-root')!,
});
