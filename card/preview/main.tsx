// Visual preview harness: mounts the REAL card components in a shadow root with mock data
// so `chrome --headless --screenshot` shows exactly what ships. Not part of the build.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Conversation } from '../src/components/Conversation';
import { DeviceTiles } from '../src/components/DeviceTiles';
import { Dock } from '../src/components/Dock';
import { Header } from '../src/components/Header';
import { ScheduledTasks } from '../src/components/ScheduledTasks';
import { SchedulesTab } from '../src/components/SchedulesTab';
import { SettingsTab } from '../src/components/SettingsTab';
import { TaskEditor } from '../src/components/TaskEditor';
import { HassStoreProvider } from '../src/hass/context';
import { HassStore } from '../src/hass/store';
import type { ConvItem } from '../src/lib/conversation';
import type { Task } from '../src/lib/tasks';
import type { TasksApi } from '../src/lib/tasks-api';
import { CARD_STYLES } from '../src/styles';

// ---- stub ha-icon (mdi paths) so icons render outside Home Assistant ----
const ICONS: Record<string, string> = {
  'mdi:microphone': 'M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z',
  'mdi:microphone-off': 'M19,11C19,12.19 18.66,13.3 18.1,14.28L16.87,13.05C17.14,12.43 17.3,11.74 17.3,11H19M15,11.16L9,5.18V5A3,3 0 0,1 12,2A3,3 0 0,1 15,5V11L15,11.16M4.27,3L21,19.73L19.73,21L15.54,16.81C14.77,17.27 13.91,17.58 13,17.72V21H11V17.72C7.72,17.23 5,14.41 5,11H6.7C6.7,14 9.24,16.1 12,16.1C12.81,16.1 13.6,15.91 14.31,15.58L12.65,13.92L12,14A3,3 0 0,1 9,11V10.28L3,4.27L4.27,3Z',
  'mdi:arrow-up': 'M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z',
  'mdi:arrow-down': 'M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z',
  'mdi:plus': 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z',
  'mdi:close': 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
  'mdi:check': 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  'mdi:pause': 'M14,19H18V5H14M6,19H10V5H6V19Z',
  'mdi:play': 'M8,5.14V19.14L19,12.14L8,5.14Z',
  'mdi:trash-can-outline': 'M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z',
  'mdi:lightbulb': 'M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z',
  'mdi:thermostat': 'M12,2A3,3 0 0,0 9,5V12.5C7.79,13.4 7,14.86 7,16.5A5,5 0 0,0 12,21.5A5,5 0 0,0 17,16.5C17,14.86 16.21,13.4 15,12.5V5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5V13.35L13.5,13.65C14.4,14.16 15,15.26 15,16.5A3,3 0 0,1 12,19.5A3,3 0 0,1 9,16.5C9,15.26 9.6,14.16 10.5,13.65L11,13.35V5A1,1 0 0,1 12,4Z',
  'mdi:gauge': 'M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12H19A7,7 0 0,1 12,19A7,7 0 0,1 5,12A7,7 0 0,1 12,5V7L15,4L12,1V3M12,12A2,2 0 0,0 10,14A2,2 0 0,0 12,16A2,2 0 0,0 14,14A2,2 0 0,0 12,12Z',
  'mdi:flash': 'M11,15H6L13,1V9H18L11,23V15Z',
  'mdi:radar': 'M19.07,4.93L17.66,6.34C19.1,7.79 20,9.79 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12C4,7.92 7.05,4.56 11,4.07V6.09C8.16,6.57 6,9.03 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12C18,10.34 17.33,8.84 16.24,7.76L14.83,9.17C15.55,9.9 16,10.9 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12C8,10.14 9.27,8.59 11,8.14V10.28C10.4,10.63 10,11.26 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.26 13.6,10.62 13,10.28V2H12A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,9.24 20.88,6.74 19.07,4.93Z',
  'mdi:waveform': 'M8,2C7.4,2 7,2.4 7,3V21C7,21.6 7.4,22 8,22C8.6,22 9,21.6 9,21V3C9,2.4 8.6,2 8,2M12,4C11.4,4 11,4.4 11,5V19C11,19.6 11.4,20 12,20C12.6,20 13,19.6 13,19V5C13,4.4 12.6,4 12,4M4,7C3.4,7 3,7.4 3,8V16C3,16.6 3.4,17 4,17C4.6,17 5,16.6 5,16V8C5,7.4 4.6,7 4,7M16,7C15.4,7 15,7.4 15,8V16C15,16.6 15.4,17 16,17C16.6,17 17,16.6 17,16V8C17,7.4 16.6,7 16,7M20,9C19.4,9 19,9.4 19,10V14C19,14.6 19.4,15 20,15C20.6,15 21,14.6 21,14V10C21,9.4 20.6,9 20,9Z',
  'mdi:creation': 'M19,1L17.74,3.75L15,5L17.74,6.26L19,9L20.26,6.26L23,5L20.26,3.75L19,1M9,4L6.5,9.5L1,12L6.5,14.5L9,20L11.5,14.5L17,12L11.5,9.5L9,4M19,15L17.74,17.75L15,19L17.74,20.25L19,23L20.26,20.25L23,19L20.26,17.75L19,15Z',
  'mdi:fan': 'M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.79,13.74 15.74,13.3 14.81,13.11C14.61,13.59 14.3,14 13.9,14.34C15.9,18.04 15.11,22 11.53,22C7.03,22 6.93,18.45 9.29,17.27C10.28,16.78 10.72,15.73 10.91,14.8C10.43,14.6 10.02,14.29 9.69,13.89C5.99,15.89 2,15.1 2,11.5C2,7 5.58,6.91 6.76,9.27C7.25,10.26 8.29,10.71 9.22,10.9C9.42,10.41 9.73,10 10.13,9.67C8.13,5.97 8.92,2 12.5,2Z',
  'mdi:toggle-switch-variant': 'M16,7A5,5 0 0,1 21,12A5,5 0 0,1 16,17H8A5,5 0 0,1 3,12A5,5 0 0,1 8,7H16M16,9A3,3 0 0,0 13,12A3,3 0 0,0 16,15A3,3 0 0,0 19,12A3,3 0 0,0 16,9Z',
  'mdi:magnify': 'M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z',
  'mdi:refresh': 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
  'mdi:calendar-clock': 'M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z',
  'mdi:repeat': 'M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z',
  'mdi:clock-outline': 'M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12.5,7H11V13L15.75,15.85L16.5,14.62L12.5,12.25V7Z',
  'mdi:check-circle-outline': 'M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.59,7.58L10,14.17L7.41,11.59L6,13L10,17L18,9L16.59,7.58Z',
  'mdi:cancel': 'M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M12,4C10.17,4 8.47,4.62 7.11,5.66L18.34,16.89C19.38,15.53 20,13.83 20,12C20,7.58 16.42,4 12,4M16.89,18.34L5.66,7.11C4.62,8.47 4,10.17 4,12C4,16.42 7.58,20 12,20C13.83,20 15.53,19.38 16.89,18.34Z',
  'mdi:alert-circle-outline': 'M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z',
  'mdi:calendar-blank-outline': 'M19,4H18V2H16V4H8V2H6V4H5A2,2 0 0,0 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V10H19V20M19,8H5V6H19V8Z',
  'mdi:bell-outline': 'M16,17H7V10.5C7,8 9,6 11.5,6C14,6 16,8 16,10.5M18,16V10.5C18,7.43 15.86,4.86 13,4.18V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V4.18C7.13,4.86 5,7.43 5,10.5V16L3,18V19H20V18M11.5,22A2,2 0 0,0 13.5,20H9.5A2,2 0 0,0 11.5,22Z',
  'mdi:cellphone': 'M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z',
  'mdi:send': 'M2,21L23,12L2,3V10L17,12L2,14V21Z',
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
// Study entities live in the configured area; the 客厅 (living-room) entities do NOT — they
// only appear as tiles if the agent acts on them, which is exactly what the new pop-up logic
// must surface (cross-area climate set, script fan-out).
const ENT_AREA: Record<string, string> = {
  'light.study_spot': 'study',
  'light.study_strip': 'study',
  'climate.study_ac': 'study',
  'fan.study_fan': 'study',
  'sensor.study_temp': 'study',
  'sensor.study_hum': 'study',
  'climate.living_ac': 'living',
  'script.movie': 'living',
  'light.living_main': 'living',
  'cover.living_curtain': 'living',
};
const STATES: Record<string, any> = {
  'light.study_spot': ent('light.study_spot', 'on', '书房 射灯'),
  'light.study_strip': ent('light.study_strip', 'on', '书房 灯带'),
  'climate.study_ac': ent('climate.study_ac', 'cool', '书房 空调'),
  'fan.study_fan': ent('fan.study_fan', 'off', '书房 循环扇'),
  'sensor.study_temp': ent('sensor.study_temp', '26.5', '书房 温湿度', '°C'),
  'sensor.study_hum': ent('sensor.study_hum', '57', '书房 湿度', '%'),
  'climate.living_ac': ent('climate.living_ac', 'cool', '客厅 空调'),
  'script.movie': ent('script.movie', 'off', '观影模式'),
  'light.living_main': ent('light.living_main', 'on', '客厅 主灯'),
  'cover.living_curtain': ent('cover.living_curtain', 'open', '客厅 窗帘'),
};
const ENTITIES: Record<string, any> = {};
for (const id of Object.keys(STATES)) ENTITIES[id] = { entity_id: id, area_id: ENT_AREA[id] ?? 'study' };
const mockHass: any = {
  states: STATES,
  entities: ENTITIES,
  devices: {},
  areas: { study: { name: '书房' }, living: { name: '客厅' } },
  services: {
    notify: {
      persistent_notification: {},
      notify: {},
      send_message: {},
      mobile_app_longs_iphone: {},
      mobile_app_ipad: {},
    },
  },
  callWS: async () => ({
    exposed_entities: Object.fromEntries(Object.keys(STATES).map((id) => [id, { conversation: true }])),
  }),
  callService: async () => {},
  callApi: async (method: string, path: string, params?: any) => {
    if (path.startsWith('livekit_voice/settings')) {
      return method === 'PUT'
        ? params
        : { notify_targets: ['persistent_notification', 'mobile_app_longs_iphone'] };
    }
    return {};
  },
};

const store = new HassStore();
store.setConfig({ type: 'livekit-voice-card', title: 'Home Voice', input_mode: 'auto', areas: ['书房'] });
store.setHass(mockHass);

// ?scenario=climate — agent sets 客厅空调 directly, no get_devices for that area.
// ?scenario=script  — agent runs 观影模式 (verb-less script tool); its fan-out is simulated
//                     below by mutating live state inside the state-diff window.
const SCENARIO = new URLSearchParams(location.search).get('scenario');
const SCENARIOS: Record<string, { toolCalls: any[]; agentAreas: string[]; query: string }> = {
  default: {
    toolCalls: [
      { callId: 'a1', name: 'get_devices', args: { area: '书房' }, status: 'done', startedAt: 1 },
      { callId: 'a2', name: 'HassTurnOn', args: { name: '书房 射灯' }, status: 'done', startedAt: 3 },
      // latest action targets the strip — only this tile should carry the highlight
      { callId: 'a3', name: 'HassTurnOn', args: { name: '书房 灯带' }, status: 'done', startedAt: 7 },
    ],
    agentAreas: ['书房'],
    query: '打开射灯',
  },
  climate: {
    toolCalls: [
      { callId: 'c1', name: 'HassClimateSetTemperature', args: { name: '客厅 空调' }, status: 'done', startedAt: 3 },
    ],
    agentAreas: [],
    query: '把客厅空调调到 24 度',
  },
  script: {
    toolCalls: [{ callId: 's1', name: '观影模式', args: {}, status: 'running', startedAt: 3 }],
    agentAreas: [],
    query: '进入观影模式',
  },
  // ?scenario=schedule — a function_call schedule targeting 书房 射灯; its tile should pin
  // to the front + highlight, just like an immediate action.
  schedule: {
    toolCalls: [
      { callId: 'sd1', name: 'get_devices', args: { area: '书房' }, status: 'done', startedAt: 1 },
      {
        callId: 'sd2',
        name: 'schedule_task',
        args: {
          description: '一小时后打开书房 射灯',
          schedule_type: 'once',
          steps: [{ tool: 'HassTurnOn', args: { name: '书房 射灯' } }],
        },
        status: 'done',
        startedAt: 5,
      },
    ],
    agentAreas: ['书房'],
    query: '一小时后打开书房射灯',
  },
};
const SCN = SCENARIOS[SCENARIO ?? 'default'] ?? SCENARIOS.default;
const toolCalls = SCN.toolCalls;

const items: ConvItem[] = [
  { kind: 'message', id: 'm1', role: 'user', text: '书房有什么设备？', ts: 1 },
  { kind: 'action', id: 'a1', ts: 2, name: 'get_devices', args: { area: '书房' }, status: 'done' },
  { kind: 'message', id: 'm2', role: 'agent', text: '书房有射灯、灯带、空调、循环扇，还有温湿度传感器。', ts: 3 },
  { kind: 'message', id: 'm3', role: 'user', text: '打开射灯', ts: 4 },
  { kind: 'action', id: 'a2', ts: 5, name: 'HassTurnOn', args: { name: '书房 射灯' }, status: 'done' },
  { kind: 'message', id: 'm4', role: 'agent', text: '好的，书房射灯已经为您打开了。', ts: 6 },
  { kind: 'action', id: 'a3', ts: 7, name: 'GetLiveContext', args: {}, status: 'running' },
];
if (location.search.includes('chips')) {
  items.push(
    { kind: 'message', id: 'm5', role: 'user', text: '一小时后关闭书房射灯', ts: 8 },
    { kind: 'message', id: 'm6', role: 'agent', text: '好的，我会在今晚 21:30 关闭书房射灯，确认吗？', ts: 9 },
  );
}

const OFF = location.search.includes('off');
const P = location.search;

// ?sched — show the scheduled-task rail in chat. ?tab=schedules — open the Schedules tab.
// ?editor — open the task editor over MOCK_TASKS[0].
const SHOW_SCHED = P.includes('sched') || P.includes('tab=schedules') || P.includes('editor');
const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    description: '打开循环扇并调到 50%',
    schedule_type: 'once',
    run_at: '2026-07-22T21:30:00+08:00',
    timezone: 'Asia/Shanghai',
    execution: {
      steps: [
        { tool: 'HassTurnOn', args: { name: '书房 循环扇' } },
        { tool: 'HassSetPosition', args: { name: '书房 循环扇', position: 50 } },
      ],
      instruction: '完成后告诉我风扇状态',
    },
    status: 'scheduled',
    enabled: true,
    created_at: '2026-07-22T20:30:00+08:00',
    next_run_at: '2026-07-22T21:30:00+08:00',
  },
  {
    id: 't2',
    description: '每天早上打开阳台灯',
    schedule_type: 'recurring',
    cron: '0 8 * * *',
    timezone: 'Asia/Shanghai',
    execution: { steps: [{ tool: 'HassTurnOn', args: { name: '阳台 灯' } }], instruction: null },
    status: 'scheduled',
    enabled: true,
    created_at: '2026-07-20T09:00:00+08:00',
    next_run_at: '2026-07-23T08:00:00+08:00',
  },
  {
    id: 't3',
    description: '工作日晚上关闭客厅灯',
    schedule_type: 'recurring',
    cron: '0 23 * * 1-5',
    timezone: 'Asia/Shanghai',
    execution: { steps: [], instruction: '关闭客厅所有灯' },
    status: 'scheduled',
    enabled: false,
    created_at: '2026-07-19T09:00:00+08:00',
    next_run_at: '2026-07-22T23:00:00+08:00',
  },
  {
    id: 't4',
    description: '早上告诉我天气',
    schedule_type: 'once',
    run_at: '2026-07-21T15:00:00+08:00',
    timezone: 'Asia/Shanghai',
    execution: { steps: [], instruction: '告诉我今天的天气' },
    status: 'completed',
    enabled: true,
    created_at: '2026-07-21T14:00:00+08:00',
    next_run_at: null,
  },
];

const mockApi: TasksApi = {
  tasks: MOCK_TASKS,
  loading: false,
  error: null,
  freshId: 't1',
  refresh: async () => {},
  save: async () => {},
  remove: async () => {},
};

// URL params drive the reviewable states: ?off (disconnected), ?auto (auto mode),
// ?active (manual turn in progress), ?paused (auto input muted), ?starting (mic cold-start).
// Default: manual, idle.
function Preview() {
  const [mode, setMode] = useState<'auto' | 'manual'>(
    P.includes('auto') || P.includes('paused') ? 'auto' : 'manual',
  );
  const [turnActive, setTurnActive] = useState(P.includes('active') || P.includes('starting'));
  const [autoPaused, setAutoPaused] = useState(P.includes('paused'));
  const [micStarting, setMicStarting] = useState(P.includes('starting'));
  const [audioOutput, setAudioOutput] = useState(P.includes('audio'));
  const [tab, setTab] = useState<'chat' | 'schedules' | 'settings'>(
    P.includes('tab=settings') ? 'settings' : P.includes('tab=schedules') ? 'schedules' : 'chat',
  );
  const [editing, setEditing] = useState<Task | null>(P.includes('editor') ? MOCK_TASKS[0] : null);
  const orbState = new URLSearchParams(location.search).get('state') || (OFF ? 'idle' : 'listening');
  const STATE_LABELS: Record<string, string> = {
    idle: 'Ready', connecting: 'Connecting', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking',
    dozing: 'Sleeping',
  };
  return (
    <HassStoreProvider value={store}>
      <ha-card data-dock={OFF ? 'off' : mode} data-tall={tab !== 'chat' || editing ? '1' : '0'}>
        <Header
          orbState={orbState}
          title="Home Voice"
          connected={!OFF}
          mode={mode}
          onModeChange={setMode}
          stateLabel={STATE_LABELS[orbState] ?? 'Connected'}
          audioOutput={audioOutput}
          onToggleAudioOutput={() => setAudioOutput((v) => !v)}
          onEnd={() => {}}
        />
        <div className="lk-tabs" role="tablist">
          <button className="lk-tab" data-on={tab === 'chat' ? '1' : '0'} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button
            className="lk-tab"
            data-on={tab === 'schedules' ? '1' : '0'}
            onClick={() => setTab('schedules')}
          >
            Schedules
          </button>
          <button
            className="lk-tab"
            data-on={tab === 'settings' ? '1' : '0'}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
        </div>
        {tab === 'chat' ? (
          <>
            {!P.includes('notiles') && (
              <DeviceTiles agentAreas={SCN.agentAreas} toolCalls={toolCalls as any} query={SCN.query} />
            )}
            {SHOW_SCHED && (
              <ScheduledTasks
                tasks={MOCK_TASKS}
                freshId="t1"
                onOpen={setEditing}
                onSeeAll={() => setTab('schedules')}
              />
            )}
            <Conversation items={OFF ? [] : items} reflowKey={P.includes('chips')} />
            <Dock
              connected={!OFF}
              connecting={false}
              mode={mode}
              turnActive={turnActive}
              autoPaused={autoPaused}
              micStarting={micStarting}
              onSend={async () => {}}
              onTurnStart={() => {
                setTurnActive(true);
                setMicStarting(true);
                setTimeout(() => setMicStarting(false), 1200);
              }}
              onTurnEnd={() => {
                setTurnActive(false);
                setMicStarting(false);
              }}
              onTurnCancel={() => {
                setTurnActive(false);
                setMicStarting(false);
              }}
              onPause={() => setAutoPaused(true)}
              onResume={() => {
                setAutoPaused(false);
                setMicStarting(true);
                setTimeout(() => setMicStarting(false), 1200);
              }}
              suggestions={P.includes('chips') ? ['确认', '取消'] : undefined}
            />
          </>
        ) : tab === 'schedules' ? (
          <SchedulesTab api={mockApi} onOpen={setEditing} />
        ) : (
          <SettingsTab />
        )}
        {editing && (
          <TaskEditor
            task={editing}
            onClose={() => setEditing(null)}
            onSave={async () => {}}
            onDelete={async () => {}}
          />
        )}
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
// Match production sizing: the card is content-sized (capped via max-height in CARD_STYLES),
// so we DON'T force ha-card to fill the frame — we only apply the HA card chrome.
style.textContent = CARD_STYLES + `\n:host{${THEME}} ha-card{${HA_CARD}}`;
const mount = document.createElement('div');
mount.className = 'lk-root';
shadow.append(style, mount);
createRoot(mount).render(<Preview />);

// Preview-only: the timeline lands at the top by design, so scroll it to the bottom when
// reviewing the quick-reply chips (?chips) to check the tail isn't hidden behind them.
if (location.search.includes('chips')) {
  setTimeout(() => {
    const convo = shadow.querySelector('.lk-convo') as HTMLElement | null;
    if (convo) convo.scrollTop = convo.scrollHeight;
  }, 400);
}

// Simulate the 观影模式 script's fan-out: shortly after mount (inside the state-diff window),
// the curtain closes and the living-room light turns off. The card should detect these live
// changes and pop them up alongside the script tile.
if (SCENARIO === 'script') {
  setTimeout(() => {
    store.setHass({
      ...mockHass,
      states: {
        ...STATES,
        'cover.living_curtain': ent('cover.living_curtain', 'closed', '客厅 窗帘'),
        'light.living_main': ent('light.living_main', 'off', '客厅 主灯'),
      },
    });
  }, 500);
}
