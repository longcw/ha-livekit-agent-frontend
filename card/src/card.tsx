import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { Root } from './App';
import { HassStore } from './hass/store';
import { CARD_STYLES } from './styles';

/**
 * The Lovelace custom card. Home Assistant calls `setConfig` once and `set hass` on every
 * state change; both feed the HassStore, which drives the React tree (mounted in a shadow
 * root) via useSyncExternalStore so tiles reflect live state.
 */
class LivekitVoiceCard extends HTMLElement {
  private _store = new HassStore();
  private _root: ReactRoot | null = null;
  private _mount: HTMLElement | null = null;

  setConfig(config: any): void {
    this._store.setConfig(config);
    if (config?.height) this.style.setProperty('--lk-h', `${config.height}px`);
    this._render();
  }

  getGridOptions(): Record<string, unknown> {
    return { rows: 'auto', columns: 'full' };
  }

  set hass(hass: any) {
    this._store.setHass(hass);
    this._render();
  }

  getCardSize(): number {
    return 8;
  }

  connectedCallback(): void {
    this._render();
  }

  disconnectedCallback(): void {
    // Leaving the dashboard tab removes the card. Tear down React (its effects end the
    // LiveKit session) once we're sure this isn't a transient DOM move. A fresh element
    // is created when the tab is reopened, which reconnects.
    setTimeout(() => {
      if (this.isConnected) return;
      this._root?.unmount();
      this._root = null;
      this._mount = null;
    }, 80);
  }

  private _render(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    if (!this._mount) {
      shadow.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = CARD_STYLES;
      const mount = document.createElement('div');
      shadow.append(style, mount);
      this._store.setHost(this);
      this._mount = mount;
      this._root = null;
    }
    if (!this._root) this._root = createRoot(this._mount);
    this._root.render(<Root store={this._store} />);
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
