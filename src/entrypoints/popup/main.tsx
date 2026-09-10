import { render } from 'preact';
import '@/ui/styles/tokens.css';
import { getActiveSite } from '@/core/activeSite';
import { applyTheme, initSettingsStore, settings } from '@/core/settings/store';
import { Popup } from './Popup';

async function bootstrap() {
  const root = document.getElementById('app');
  if (!root) return;

  // Pre-load settings from storage and detect active tab in parallel before mounting.
  // This guarantees the first visual paint immediately renders the persisted user configuration,
  // preventing toggle switch animation lag, layout shifts, or flash of default states.
  try {
    const [_, activeSite] = await Promise.all([
      initSettingsStore(),
      getActiveSite().catch(() => null),
    ]);
    applyTheme(settings.value.theme);
    render(<Popup initialSite={activeSite} />, root);
  } catch (error) {
    console.error('Failed to pre-load settings:', error);
    render(<Popup />, root);
  }
}

void bootstrap();


