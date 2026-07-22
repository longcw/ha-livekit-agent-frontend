import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { Root } from './App';
import { HassStore } from './hass/store';
import { CARD_STYLES } from './styles';

/**
 * The Lovelace custom card. Home Assistant calls `setConfig` once and `set hass` on every
 * state change; both feed the HassStore, which drives the React tree (via useSyncExternalStore)
 * so tiles reflect live state.
 *
 * Persistence across lovelace-view switches: HA *destroys and recreates* the card element when
 * you switch views. To avoid tearing down the live LiveKit session (and losing the whole
 * conversation) on every view switch, the store + React root + mount node live in module scope
 * — a single persistent tree that is simply re-parented into whichever element HA currently has
 * connected. React is never unmounted, so the session and conversation survive; the page
 * unloading (which kills this JS context) is the only real teardown.
 */
let sharedStore: HassStore | null = null;
let sharedMount: HTMLDivElement | null = null;
let sharedRoot: ReactRoot | null = null;

function ensureTree(): { store: HassStore; mount: HTMLDivElement } {
  if (!sharedStore) sharedStore = new HassStore();
  if (!sharedMount) {
    sharedMount = document.createElement('div');
    sharedMount.className = 'lk-root';
  }
  if (!sharedRoot) {
    sharedRoot = createRoot(sharedMount);
    sharedRoot.render(<Root store={sharedStore} />);
    console.debug('[livekit-voice-card] created persistent tree');
  }
  return { store: sharedStore, mount: sharedMount };
}

class LivekitVoiceCard extends HTMLElement {
  setConfig(config: any): void {
    ensureTree().store.setConfig(config);
    if (config?.height) this.style.setProperty('--lk-h', `${config.height}px`);
    this._attach();
  }

  getGridOptions(): Record<string, unknown> {
    return { rows: 'auto', columns: 'full' };
  }

  set hass(hass: any) {
    ensureTree().store.setHass(hass);
    this._attach();
  }

  getCardSize(): number {
    return 8;
  }

  connectedCallback(): void {
    this._attach();
  }

  // No teardown on disconnect: a view switch detaches the element, but the shared tree lives on
  // and is re-parented into the next connected element (_attach). This preserves the session.

  /** Ensure this element's shadow root holds the styles + the shared, persistent mount node. */
  private _attach(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    if (!shadow.querySelector('style[data-lk]')) {
      const style = document.createElement('style');
      style.setAttribute('data-lk', '');
      style.textContent = CARD_STYLES;
      shadow.appendChild(style);
    }
    const { store, mount } = ensureTree();
    store.setHost(this);
    if (mount.parentNode !== shadow) {
      shadow.appendChild(mount); // adopt the persistent React tree into this element
      console.debug('[livekit-voice-card] re-attached persistent tree (session preserved)');
    }
  }
}

customElements.define('livekit-voice-card', LivekitVoiceCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'livekit-voice-card',
  name: 'LiveKit Voice Assistant',
  description: 'Talk to your Home Assistant voice agent and control devices from the dashboard.',
  preview: false,
});
