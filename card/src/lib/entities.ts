import type { CardConfig, Hass, HassEntity } from '../hass/store';

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
  // numeric sensors aren't "on/off" — don't glow them
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
  // lock / climate / media_player / vacuum / sensors → open more-info (safer / richer)
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
  if (low === '' || low === 'unknown') return 'Unknown';
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

/** area id/name (case-insensitive) -> area_id */
function areaIdsForNames(hass: Hass, names: string[]): Set<string> {
  const wanted = new Set(names.map((n) => n.toLowerCase().trim()));
  const ids = new Set<string>();
  for (const [areaId, area] of Object.entries(hass.areas ?? {})) {
    const name = (area as any)?.name?.toLowerCase?.() ?? '';
    if (wanted.has(areaId.toLowerCase()) || wanted.has(name)) ids.add(areaId);
  }
  return ids;
}

/** Resolve all entity_ids that live in the given areas (by id or name). */
export function entitiesInAreas(hass: Hass, areaNames: string[]): string[] {
  if (!areaNames.length || !hass.entities) return [];
  const areaIds = areaIdsForNames(hass, areaNames);
  if (!areaIds.size) return [];
  const out: string[] = [];
  for (const [entityId, ent] of Object.entries(hass.entities)) {
    if ((ent as any)?.hidden || (ent as any)?.disabled_by) continue;
    let areaId = (ent as any)?.area_id;
    if (!areaId) {
      const deviceId = (ent as any)?.device_id;
      if (deviceId) areaId = hass.devices?.[deviceId]?.area_id;
    }
    if (areaId && areaIds.has(areaId) && hass.states[entityId]) out.push(entityId);
  }
  return out;
}

/** The full ordered, de-duplicated set of tiles to show. */
export function resolveTileEntities(
  hass: Hass,
  config: CardConfig,
  agentAreas: string[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id) && hass.states[id]) {
      seen.add(id);
      ids.push(id);
    }
  };
  (config.entities ?? []).forEach(add);
  entitiesInAreas(hass, config.areas ?? []).forEach(add);
  if (config.follow_agent !== false) entitiesInAreas(hass, agentAreas).forEach(add);
  return ids;
}

// Controllable domains float above ambient sensors in the tile grid.
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

export function sortTiles(hass: Hass, ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ra = DOMAIN_RANK[domainOf(a)] ?? 15;
    const rb = DOMAIN_RANK[domainOf(b)] ?? 15;
    if (ra !== rb) return ra - rb;
    const aa = Number(isActive(hass.states[b])) - Number(isActive(hass.states[a]));
    if (aa !== 0) return aa;
    return friendlyName(hass, a).localeCompare(friendlyName(hass, b));
  });
}
