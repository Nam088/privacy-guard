import { render } from 'preact';
import '@/ui/styles/tokens.css';
import { applyTheme } from '@/core/settings/store';
import { Popup } from './Popup';

function bootstrap() {
  const root = document.getElementById('app');
  if (!root) return;

  // Restore saved theme immediately from localStorage on frame 0 to prevent any theme flash
  try {
    const cachedTheme = localStorage.getItem('pg_theme');
    if (cachedTheme === 'light' || cachedTheme === 'dark') {
      applyTheme(cachedTheme);
    }
  } catch {
    // Ignore localStorage access failures
  }

  // Clear any existing nodes to ensure pristine single-tree mount
  root.replaceChildren();

  // Instant zero-latency render on frame 0:
  // Does not block initial paint on browser IPC or tabs.query.
  // Settings store and active site detection run in the background.
  render(<Popup />, root);
}

bootstrap();
