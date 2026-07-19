import { TokenSourceConfigurable } from 'livekit-client';
import type { HassStore } from './store';

/**
 * Mints a LiveKit token by calling the integration's authenticated endpoint via
 * `hass.callApi` (which attaches the logged-in user's HA auth). The integration builds
 * the room config + agent dispatch server-side, so the client only forwards the desired
 * input mode. Mirrors the frontend's EndpointTokenSource, but auth is HA's.
 */
export class HassTokenSource extends TokenSourceConfigurable {
  constructor(private readonly store: HassStore) {
    super();
  }

  async fetch() {
    const { hass, config } = this.store.getSnapshot();
    if (!hass) throw new Error('Home Assistant not ready');
    const inputMode = config.input_mode === 'auto' ? 'auto' : 'push_to_talk';
    return hass.callApi('POST', 'livekit_voice/token', { input_mode: inputMode });
  }
}
