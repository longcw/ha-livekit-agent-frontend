// Visual preview harness: mounts the REAL card components in a shadow root with mock data
// so `chrome --headless --screenshot` shows exactly what ships. Not part of the build.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Conversation } from '../src/components/Conversation';
import { DeviceTiles } from '../src/components/DeviceTiles';
import { Dock } from '../src/components/Dock';
import { Header } from '../src/components/Header';
import { HassStoreProvider } from '../src/hass/context';
import { HassStore } from '../src/hass/store';
import type { ConvItem } from '../src/lib/conversation';
import { CARD_STYLES } from '../src/styles';

// ---- stub ha-icon (mdi paths) so icons render outside Home Assistant ----
const ICONS: Record<string, string> = {
  'mdi:microphone': 'M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z',
  'mdi:microphone-off': 'M19,11C19,12.19 18.66,13.3 18.1,14.28L16.87,13.05C17.14,12.43 17.3,11.74 17.3,11H19M15,11.16L9,5.18V5A3,3 0 0,1 12,2A3,3 0 0,1 15,5V11L15,11.16M4.27,3L21,19.73L19.73,21L15.54,16.81C14.77,17.27 13.91,17.58 13,17.72V21H11V17.72C7.72,17.23 5,14.41 5,11H6.7C6.7,14 9.24,16.1 12,16.1C12.81,16.1 13.6,15.91 14.31,15.58L12.65,13.92L12,14A3,3 0 0,1 9,11V10.28L3,4.27L4.27,3Z',
  'mdi:arrow-up': 'M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z',
  'mdi:close': 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
  'mdi:check': 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  'mdi:pause': 'M14,19H18V5H14M6,19H10V5H6V19Z',
  'mdi:lightbulb': 'M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z',
  'mdi:thermostat': 'M12,2A3,3 0 0,0 9,5V12.5C7.79,13.4 7,14.86 7,16.5A5,5 0 0,0 12,21.5A5,5 0 0,0 17,16.5C17,14.86 16.21,13.4 15,12.5V5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5V13.35L13.5,13.65C14.4,14.16 15,15.26 15,16.5A3,3 0 0,1 12,19.5A3,3 0 0,1 9,16.5C9,15.26 9.6,14.16 10.5,13.65L11,13.35V5A1,1 0 0,1 12,4Z',
  'mdi:gauge': 'M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12H19A7,7 0 0,1 12,19A7,7 0 0,1 5,12A7,7 0 0,1 12,5V7L15,4L12,1V3M12,12A2,2 0 0,0 10,14A2,2 0 0,0 12,16A2,2 0 0,0 14,14A2,2 0 0,0 12,12Z',
  'mdi:flash': 'M11,15H6L13,1V9H18L11,23V15Z',
  'mdi:radar': 'M19.07,4.93L17.66,6.34C19.1,7.79 20,9.79 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12C4,7.92 7.05,4.56 11,4.07V6.09C8.16,6.57 6,9.03 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12C18,10.34 17.33,8.84 16.24,7.76L14.83,9.17C15.55,9.9 16,10.9 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12C8,10.14 9.27,8.59 11,8.14V10.28C10.4,10.63 10,11.26 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.26 13.6,10.62 13,10.28V2H12A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,9.24 20.88,6.74 19.07,4.93Z',
  'mdi:waveform': 'M8,2C7.4,2 7,2.4 7,3V21C7,21.6 7.4,22 8,22C8.6,22 9,21.6 9,21V3C9,2.4 8.6,2 8,2M12,4C11.4,4 11,4.4 11,5V19C11,19.6 11.4,20 12,20C12.6,20 13,19.6 13,19V5C13,4.4 12.6,4 12,4M4,7C3.4,7 3,7.4 3,8V16C3,16.6 3.4,17 4,17C4.6,17 5,16.6 5,16V8C5,7.4 4.6,7 4,7M16,7C15.4,7 15,7.4 15,8V16C15,16.6 15.4,17 16,17C16.6,17 17,16.6 17,16V8C17,7.4 16.6,7 16,7M20,9C19.4,9 19,9.4 19,10V14C19,14.6 19.4,15 20,15C20.6,15 21,14.6 21,14V10C21,9.4 20.6,9 20,9Z',
  'mdi:fan': 'M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.79,13.74 15.74,13.3 14.81,13.11C14.61,13.59 14.3,14 13.9,14.34C15.9,18.04 15.11,22 11.53,22C7.03,22 6.93,18.45 9.29,17.27C10.28,16.78 10.72,15.73 10.91,14.8C10.43,14.6 10.02,14.29 9.69,13.89C5.99,15.89 2,15.1 2,11.5C2,7 5.58,6.91 6.76,9.27C7.25,10.26 8.29,10.71 9.22,10.9C9.42,10.41 9.73,10 10.13,9.67C8.13,5.97 8.92,2 12.5,2Z',
  'mdi:toggle-switch-variant': 'M16,7A5,5 0 0,1 21,12A5,5 0 0,1 16,17H8A5,5 0 0,1 3,12A5,5 0 0,1 8,7H16M16,9A3,3 0 0,0 13,12A3,3 0 0,0 16,15A3,3 0 0,0 19,12A3,3 0 0,0 16,9Z',
};
class HaIcon extends HTMLElement {
  static get observedAttributes() { return ['icon']; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const d = ICONS[this.getAttribute('icon') || ''] || 'M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z';
    this.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);display:block"><path d="${d}"/></svg>`;
  }
}
if (!customElements.get('ha-icon')) customElements.define('ha-icon', HaIcon);

// ---- mock hass ----
function ent(entity_id: string, state: string, friendly_name: string, unit?: string) {
  return { entity_id, state, attributes: unit ? { friendly_name, unit_of_measurement: unit } : { friendly_name } };
}
const STATES: Record<string, any> = {
  'light.study_spot': ent('light.study_spot', 'on', '书房 射灯'),
  'light.study_strip': ent('light.study_strip', 'on', '书房 灯带'),
  'climate.study_ac': ent('climate.study_ac', 'cool', '书房 空调'),
  'fan.study_fan': ent('fan.study_fan', 'off', '书房 循环扇'),
  'sensor.study_temp': ent('sensor.study_temp', '26.5', '书房 温湿度', '°C'),
  'sensor.study_hum': ent('sensor.study_hum', '57', '书房 湿度', '%'),
};
const ENTITIES: Record<string, any> = {};
for (const id of Object.keys(STATES)) ENTITIES[id] = { entity_id: id, area_id: 'study' };
const mockHass: any = {
  states: STATES,
  entities: ENTITIES,
  devices: {},
  areas: { study: { name: '书房' } },
  callWS: async () => ({
    exposed_entities: Object.fromEntries(Object.keys(STATES).map((id) => [id, { conversation: true }])),
  }),
  callService: async () => {},
};

const store = new HassStore();
store.setConfig({ type: 'livekit-voice-card', title: 'Home Voice', input_mode: 'auto', areas: ['书房'] });
store.setHass(mockHass);

const toolCalls = [
  { callId: 'a1', name: 'get_devices', args: { area: '书房' }, status: 'done' as const, startedAt: 1 },
  { callId: 'a2', name: 'HassTurnOn', args: { name: '书房 射灯' }, status: 'done' as const, startedAt: 3 },
  // latest action targets the strip — only this tile should carry the highlight
  { callId: 'a3', name: 'HassTurnOn', args: { name: '书房 灯带' }, status: 'done' as const, startedAt: 7 },
];

const items: ConvItem[] = [
  { kind: 'message', id: 'm1', role: 'user', text: '书房有什么设备？', ts: 1 },
  { kind: 'message', id: 'm2', role: 'agent', text: '书房有射灯、灯带、空调、循环扇，还有温湿度传感器。', ts: 3 },
  { kind: 'message', id: 'm3', role: 'user', text: '打开射灯', ts: 4 },
  { kind: 'action', id: 'a2', ts: 5, name: 'HassTurnOn', args: { name: '书房 射灯' }, status: 'done' },
  { kind: 'message', id: 'm4', role: 'agent', text: '好的，书房射灯已经为您打开了。', ts: 6 },
];

const OFF = location.search.includes('off');
const P = location.search;

// URL params drive the reviewable states: ?off (disconnected), ?auto (auto mode),
// ?active (manual turn in progress), ?paused (auto input muted). Default: manual, idle.
function Preview() {
  const [mode, setMode] = useState<'auto' | 'manual'>(
    P.includes('auto') || P.includes('paused') ? 'auto' : 'manual',
  );
  const [turnActive, setTurnActive] = useState(P.includes('active'));
  const [autoPaused, setAutoPaused] = useState(P.includes('paused'));
  return (
    <HassStoreProvider value={store}>
      <ha-card data-dock={OFF ? 'off' : mode}>
        <Header
          orbState={OFF ? 'idle' : 'listening'}
          title="Home Voice"
          connected={!OFF}
          mode={mode}
          onModeChange={setMode}
          stateLabel={OFF ? 'offline' : 'listening'}
          onEnd={() => {}}
        />
        <DeviceTiles agentAreas={['书房']} toolCalls={toolCalls as any} query="打开射灯" />
        <Conversation items={OFF ? [] : items} />
        <Dock
          connected={!OFF}
          mode={mode}
          turnActive={turnActive}
          autoPaused={autoPaused}
          startLabel=""
          onStart={() => {}}
          onSend={async () => {}}
          onTurnStart={() => setTurnActive(true)}
          onTurnEnd={() => setTurnActive(false)}
          onTurnCancel={() => setTurnActive(false)}
          onPause={() => setAutoPaused(true)}
          onResume={() => setAutoPaused(false)}
        />
      </ha-card>
    </HassStoreProvider>
  );
}

const LIGHT = location.search.includes('light');
const THEME = LIGHT
  ? '--primary-color:#2b6fff;--text-primary-color:#fff;--primary-text-color:#1f2023;--secondary-text-color:#5f6368;--card-background-color:#ffffff;--secondary-background-color:#eef0f3;--divider-color:rgba(0,0,0,0.12);--error-color:#d93025;--success-color:#1e8e3e;'
  : '--primary-color:#4c8dff;--text-primary-color:#fff;--primary-text-color:#e9eaee;--secondary-text-color:#9aa1ac;--card-background-color:#16181d;--secondary-background-color:rgba(255,255,255,0.055);--divider-color:rgba(255,255,255,0.09);--error-color:#f0483e;--success-color:#21b573;';

document.body.style.background = LIGHT ? '#f2f3f5' : '#0b0c0f';

// Simulate Home Assistant's real ha-card chrome (background + border/shadow) so the
// preview shows any overlap between our content and the card border.
const HA_CARD = LIGHT
  ? 'background:var(--card-background-color);border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 10px rgba(0,0,0,0.10);'
  : 'background:var(--card-background-color);border:1px solid rgba(255,255,255,0.06);box-shadow:0 2px 12px rgba(0,0,0,0.5);';

const host = document.getElementById('frame')!;
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent =
  CARD_STYLES + `\n:host{${THEME}} :host,.lk-root{height:100%} ha-card{height:100% !important;${HA_CARD}}`;
const mount = document.createElement('div');
mount.className = 'lk-root';
shadow.append(style, mount);
createRoot(mount).render(<Preview />);
