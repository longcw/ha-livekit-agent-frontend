// External store bridging Home Assistant's imperative `hass`/`config` setters to React.
// HA sets `card.hass` on every state change; the store notifies React via
// useSyncExternalStore so tiles reflect live state.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface Hass {
  states: Record<string, HassEntity>;
  /** Entity registry: entity_id -> { area_id, device_id, ... } */
  entities?: Record<string, any>;
  /** Device registry: device_id -> { area_id, ... } */
  devices?: Record<string, any>;
  /** Area registry: area_id -> { name, ... } */
  areas?: Record<string, any>;
  language?: string;
  callService: (domain: string, service: string, data?: Record<string, any>) => Promise<any>;
  callApi: <T = any>(method: string, path: string, parameters?: any) => Promise<T>;
  callWS?: <T = any>(msg: any) => Promise<T>;
}

export interface CardConfig {
  type: string;
  title?: string;
  input_mode?: 'push_to_talk' | 'auto';
  /** Explicit entity_ids to always show as tiles. */
  entities?: string[];
  /** Area ids or names; all their entities become tiles. */
  areas?: string[];
  /** Also surface tiles for areas the agent looks at (get_devices). Default true. */
  follow_agent?: boolean;
  /** How many tiles to show before "Show more". Default 8. */
  max_tiles?: number;
  /** Fixed card height in px. Default 480. */
  height?: number;
  /** Connect automatically when the dashboard tab is open; disconnect on leave. Default true. */
  auto_connect?: boolean;
}

export interface Snapshot {
  hass: Hass | null;
  config: CardConfig;
}

const EMPTY_CONFIG: CardConfig = { type: 'livekit-voice-card' };

export class HassStore {
  private _snapshot: Snapshot = { hass: null, config: EMPTY_CONFIG };
  private _host: HTMLElement | null = null;
  private _listeners = new Set<() => void>();

  setHass(hass: Hass) {
    this._snapshot = { ...this._snapshot, hass };
    this._emit();
  }

  setConfig(config: CardConfig) {
    this._snapshot = { ...this._snapshot, config: config || EMPTY_CONFIG };
    this._emit();
  }

  setHost(host: HTMLElement) {
    this._host = host;
  }

  get host(): HTMLElement | null {
    return this._host;
  }

  subscribe = (cb: () => void): (() => void) => {
    this._listeners.add(cb);
    return () => {
      this._listeners.delete(cb);
    };
  };

  getSnapshot = (): Snapshot => this._snapshot;

  private _emit() {
    for (const l of this._listeners) l();
  }
}
