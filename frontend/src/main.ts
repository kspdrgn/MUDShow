import App from './App.svelte';
import { mount } from 'svelte';
import '../app.css';

console.log('[window-action] frontend main boot', {
  href: typeof window !== 'undefined' ? window.location.href : null,
  readyState: typeof document !== 'undefined' ? document.readyState : null,
});

const app = mount(App, {
  target: document.getElementById('app') as HTMLElement,
});

export default app;
