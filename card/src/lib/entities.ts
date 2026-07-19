import type { CardConfig, Hass, HassEntity } from '../hass/store';
import type { ToolCall } from './tool-feed';

export function domainOf(entityId: string): string {
  return entityId.split('.')[0];
}

export function friendlyName(hass: Hass, entityId: string): string {
  return hass.states[entityId]?.attributes?.friendly_name || entityId;
}

const INACTIVE_STATES = new Set([
  'off',
  'unavailable',
  'unknown',
  'idle',
  'closed',
  'locked',
  'standby',
  'not_home',
  '',
]);

export function isActive(entity: HassEntity | undefined): boolean {
  if (!entity) return false;
  const s = (entity.state ?? '').toString().toLowerCase();
  if (INACTIVE_STATES.has(s)) return false;
  const n = Number(s);
  if (s !== '' && !Number.isNaN(n)) return false;
  return true;
}

/** The service a tap should invoke, or null to open the more-info dialog instead. */
export function tapService(entityId: string): { domain: string; service: string } | null {
  const d = domainOf(entityId);
  if (['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'siren', 'automation', 'cover'].includes(d)) {
    return { domain: d, service: 'toggle' };
  }
  if (d === 'scene') return { domain: 'scene', service: 'turn_on' };
  if (d === 'script') return { domain: 'script', service: 'turn_on' };
  return null;
}

const DOMAIN_ICON: Record<string, string> = {
  light: 'mdi:lightbulb',
  switch: 'mdi:toggle-switch-variant',
  fan: 'mdi:fan',
  climate: 'mdi:thermostat',
  cover: 'mdi:window-shutter',
  lock: 'mdi:lock',
  media_player: 'mdi:cast',
  sensor: 'mdi:gauge',
  binary_sensor: 'mdi:checkbox-marked-circle-outline',
  scene: 'mdi:palette',
  script: 'mdi:script-text',
  vacuum: 'mdi:robot-vacuum',
  person: 'mdi:account',
  automation: 'mdi:robot',
  humidifier: 'mdi:air-humidifier',
  camera: 'mdi:cctv',
};

export function iconFor(hass: Hass, entityId: string): string {
  const e = hass.states[entityId];
  if (e?.attributes?.icon) return e.attributes.icon;
  return DOMAIN_ICON[domainOf(entityId)] || 'mdi:help-circle-outline';
}

export function formatState(entity: HassEntity): string {
  const raw = (entity.state ?? '').toString();
  const low = raw.toLowerCase();
  if (low === '' || low === 'unknown') return '—';
  if (low === 'unavailable') return 'N/A';
  if (low === 'on') return 'On';
  if (low === 'off') return 'Off';
  const unit = entity.attributes?.unit_of_measurement as string | undefined;
  const num = Number(raw);
  if (raw !== '' && !Number.isNaN(num)) {
    const rounded = Number.isInteger(num) ? num : Math.round(num * 10) / 10;
    if (unit) {
      const tight = unit === '%' || unit.startsWith('°');
      return `${rounded}${tight ? '' : ' '}${unit}`;
    }
    return String(rounded);
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ---- area resolution -------------------------------------------------------

function areaIdsForNames(hass: Hass, names: string[]): Set<string> {
  const wanted = new Set(names.map((n) => n.toLowerCase().trim()));
  const ids = new Set<string>();
  for (const [areaId, area] of Object.entries(hass.areas ?? {})) {
    const name = (area as any)?.name?.toLowerCase?.() ?? '';
    if (wanted.has(areaId.toLowerCase()) || wanted.has(name)) ids.add(areaId);
  }
  return ids;
}

export function entitiesInAreas(hass: Hass, areaNames: string[]): string[] {
  if (!areaNames.length || !hass.entities) return [];
  const areaIds = areaIdsForNames(hass, areaNames);
  if (!areaIds.size) return [];
  const out: string[] = [];
  for (const [entityId, ent] of Object.entries(hass.entities)) {
    let areaId = (ent as any)?.area_id;
    if (!areaId) {
      const deviceId = (ent as any)?.device_id;
      if (deviceId) areaId = hass.devices?.[deviceId]?.area_id;
    }
    if (areaId && areaIds.has(areaId) && hass.states[entityId]) out.push(entityId);
  }
  return out;
}

// ---- exposure / noise filtering -------------------------------------------

/** Diagnostic/config/hidden entities — the fallback filter when the expose list is absent. */
function isNoisy(hass: Hass, entityId: string): boolean {
  const ent = hass.entities?.[entityId] as any;
  if (!ent) return false;
  if (ent.hidden_by || ent.disabled_by) return true;
  if (ent.entity_category === 'diagnostic' || ent.entity_category === 'config') return true;
  return false;
}

function keep(hass: Hass, exposed: Set<string> | null, entityId: string): boolean {
  if (!hass.states[entityId]) return false;
  if (exposed && exposed.size) return exposed.has(entityId);
  return !isNoisy(hass, entityId); // fallback when expose list unavailable
}

// ---- action-target resolution (which device the agent just controlled) -----

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isActionTool(name: string): boolean {
  if (/^(get|list)/i.test(name)) return false;
  if (/livecontext|status|context|areas|domains|devices|info/i.test(name)) return false;
  return /(turn|set|toggle|open|close|lock|unlock|start|stop|play|pause|activate|press|select|increase|decrease|cancel|dim|brighten|boost)/i.test(
    name
  );
}

/** normalized friendly_name (and comma-alias parts) -> entity_id, over the tile-eligible set. */
function nameIndex(hass: Hass, ids: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const id of ids) {
    const fn = friendlyName(hass, id);
    for (const part of [fn, ...fn.split(',')]) {
      const key = normalizeName(part);
      if (key && !index.has(key)) index.set(key, id);
    }
  }
  return index;
}

function actionNames(args: ToolCall['args']): string[] {
  if (!args || typeof args === 'string') return [];
  const name = (args as Record<string, unknown>).name;
  if (typeof name === 'string') return [name];
  if (Array.isArray(name)) return name.map(String);
  return [];
}

/** Best-effort set of entity_ids the agent's action tools targeted, matched by name. */
export function resolveActionTargets(
  hass: Hass,
  candidateIds: string[],
  toolCalls: ToolCall[]
): Set<string> {
  const index = nameIndex(hass, candidateIds);
  const hits = new Set<string>();
  for (const t of toolCalls) {
    if (!isActionTool(t.name)) continue;
    for (const raw of actionNames(t.args)) {
      const norm = normalizeName(raw);
      if (!norm) continue;
      if (index.has(norm)) {
        hits.add(index.get(norm)!);
        continue;
      }
      // loose contains match within the small candidate set
      for (const [key, id] of index) {
        if (key.includes(norm) || norm.includes(key)) {
          hits.add(id);
          break;
        }
      }
    }
  }
  return hits;
}

// ---- relevance to the spoken request --------------------------------------

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  light: ['light', 'lamp', '灯', '照明'],
  climate: ['ac', 'air condition', 'aircon', 'climate', 'hvac', 'thermostat', '空调', '冷气', '暖气', '制冷', '制热'],
  media_player: ['tv', 'television', 'speaker', 'music', 'media', '电视', '音响', '音乐', '播放'],
  fan: ['fan', '风扇', '电扇', '换气'],
  cover: ['curtain', 'blind', 'shade', 'cover', '窗帘', '百叶', '卷帘'],
  lock: ['lock', 'door', '门锁', '锁', '门'],
  switch: ['switch', 'plug', 'outlet', 'socket', '开关', '插座'],
  vacuum: ['vacuum', 'robot', '扫地', '吸尘'],
  camera: ['camera', '摄像', '监控'],
};

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s,，、_\-/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function queryRelevance(hass: Hass, entityId: string, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  if (nameTokens(friendlyName(hass, entityId)).some((t) => q.includes(t))) score += 6;
  const kws = DOMAIN_KEYWORDS[domainOf(entityId)];
  if (kws && kws.some((k) => q.includes(k))) score += 4;
  return score;
}

const DOMAIN_RANK: Record<string, number> = {
  light: 0,
  climate: 1,
  media_player: 2,
  fan: 3,
  cover: 4,
  lock: 5,
  switch: 6,
  vacuum: 7,
  scene: 9,
  script: 10,
  automation: 10,
  binary_sensor: 20,
  sensor: 21,
};

// ---- public: the ordered tile set -----------------------------------------

export interface TileModel {
  entityId: string;
  touched: boolean;
}

/**
 * Build the ordered tiles: acted-on devices first (pinned + flagged), then by relevance to
 * the request, then controllable-before-ambient. Filtered to voice-exposed entities
 * (config.entities are always allowed through).
 */
export function buildTiles(
  hass: Hass,
  config: CardConfig,
  opts: { agentAreas: string[]; toolCalls: ToolCall[]; exposed: Set<string> | null; query: string }
): TileModel[] {
  const { agentAreas, toolCalls, exposed, query } = opts;

  const explicit = (config.entities ?? []).filter((id) => hass.states[id]);
  const areaPool = [
    ...entitiesInAreas(hass, config.areas ?? []),
    ...(config.follow_agent !== false ? entitiesInAreas(hass, agentAreas) : []),
  ].filter((id) => keep(hass, exposed, id));

  const candidates = Array.from(new Set([...explicit, ...areaPool]));
  const touched = resolveActionTargets(hass, candidates, toolCalls);

  const ordered = candidates.sort((a, b) => {
    const ta = Number(touched.has(b)) - Number(touched.has(a));
    if (ta !== 0) return ta;
    const qa = queryRelevance(hass, b, query) - queryRelevance(hass, a, query);
    if (qa !== 0) return qa;
    const ra = (DOMAIN_RANK[domainOf(a)] ?? 15) - (DOMAIN_RANK[domainOf(b)] ?? 15);
    if (ra !== 0) return ra;
    const aa = Number(isActive(hass.states[b])) - Number(isActive(hass.states[a]));
    if (aa !== 0) return aa;
    return friendlyName(hass, a).localeCompare(friendlyName(hass, b));
  });

  return ordered.map((entityId) => ({ entityId, touched: touched.has(entityId) }));
}
