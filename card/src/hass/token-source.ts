import { TokenSourceConfigurable } from 'livekit-client';
import { loadTurnMode } from '../lib/turn-mode';
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
    // Boot the agent in the user's persisted mode so its turn detection matches the UI
    // from the first frame. The card also re-asserts the mode over RPC once connected.
    const inputMode = loadTurnMode(config) === 'manual' ? 'push_to_talk' : 'auto';
    return hass.callApi('POST', 'livekit_voice/token', { input_mode: inputMode });
  }
}
