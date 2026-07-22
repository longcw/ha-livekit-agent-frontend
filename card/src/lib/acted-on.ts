import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hass, HassEntity } from '../hass/store';
import { domainOf, friendlyName, keep } from './entities';
import { SCHEDULE_TASK } from './tasks';
import type { ToolCall } from './tool-feed';

// How long after an agent action we keep watching live Home Assistant state for changes
// caused by that action (script fan-out, climate set-points, …). Short, so only changes
// that plausibly resulted from the action get attributed to it.
const STATE_DIFF_WINDOW_MS = 6000;

// Domains a user *actuates* with discrete, quiet state. Only these are considered when
// attributing a live state change to an agent action, so ambient/read-only domains (sensor,
// binary_sensor, person, weather, sun, …) never masquerade as "the agent did this". Also
// excluded: media_player, which self-updates volume/track/position frequently and would
// false-positive during any action's watch window (it's still resolvable by name when
// controlled directly). Scripts/scenes are surfaced by name, so they're absent here too.
const ACTUATOR_DOMAINS = new Set([
  'light',
  'switch',
  'fan',
  'climate',
  'cover',
  'lock',
  'humidifier',
  'vacuum',
  'water_heater',
  'valve',
  'siren',
  'input_boolean',
  'lawn_mower',
]);

export interface ActedOn {
  /** Acted-on entity_ids, most-recent action first (deduped) — pinned to the front. */
  ordered: string[];
  /** Entity_ids from the single most-recent resolving action — the highlight. */
  latest: Set<string>;
}

// ---- tool classification ---------------------------------------------------

/**
 * A tool call that only *reads* state (get_devices, GetLiveContext, get_areas, …). Everything
 * else is treated as an action, so verb-less tools still count — Home Assistant exposes each
 * script/scene as a tool named after the entity, with no action verb. This is deliberately
 * broader than conversation.ts's isActionTool, which gates the timeline display.
 */
function isQueryTool(name: string): boolean {
  if (/^(get|list)/i.test(name)) return true;
  return /livecontext|status|state|context|areas|domains|devices|info/i.test(name);
}

// ---- name matching ---------------------------------------------------------

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** normalized friendly_name (and comma-alias parts) -> entity_id, over the given id set. */
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

/** Target device name(s) from an action's `name` argument (HassTurnOn, HassLightSet, …). */
function argNames(args: ToolCall['args']): string[] {
  if (!args || typeof args === 'string') return [];
  const name = (args as Record<string, unknown>).name;
  if (typeof name === 'string') return [name];
  if (Array.isArray(name)) return name.map(String);
  return [];
}

/** Device name(s) a `schedule_task` call targets, so a scheduled device pins like an action:
 *  the explicit `name` inside its tool_args_json (function_call), plus its free-text
 *  description / instruction (which usually embeds the exact device name) for a loose match. */
function scheduleNames(args: ToolCall['args']): string[] {
  if (!args || typeof args === 'string') return [];
  const a = args as Record<string, unknown>;
  const names: string[] = [];
  if (typeof a.tool_args_json === 'string') {
    try {
      const n = (JSON.parse(a.tool_args_json) as Record<string, unknown>)?.name;
      if (typeof n === 'string') names.push(n);
      else if (Array.isArray(n)) names.push(...n.map(String));
    } catch {
      // ignore malformed JSON
    }
  }
  for (const key of ['instruction', 'command_text', 'text', 'description']) {
    const v = a[key];
    if (typeof v === 'string' && v.trim()) names.push(v);
  }
  return names;
}

// ---- resolution ------------------------------------------------------------

/**
 * Entity_ids the agent has acted on, matched three ways and unioned per call:
 *   1. the action's `name` argument (exact, then loose contains) — the primary target;
 *   2. the tool's own name, matched exactly — HA exposes each script/scene as a tool named
 *      after the entity with no `name` arg, so this pins the script/scene tile itself;
 *   3. `callChanges` — devices whose live state changed during the call's window (script
 *      fan-out, and any target names 1–2 missed).
 * Walks newest → oldest so `ordered` is most-recent-first (pinned to the front of the rail)
 * and `latest` is the newest resolving action's targets (the moving highlight). Matching runs
 * over `universeIds` (the voice-exposed set), so a target is resolvable even when the agent
 * never queried its area first.
 */
export function resolveActedOn(
  hass: Hass,
  universeIds: string[],
  toolCalls: ToolCall[],
  callChanges: Map<string, Set<string>>
): ActedOn {
  const index = nameIndex(hass, universeIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  let latest: Set<string> | null = null;

  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i];
    if (call.status === 'error' || call.status === 'cancelled') continue;
    if (isQueryTool(call.name)) continue;

    const hits = new Set<string>();

    // 1. `name` argument — exact, then a loose contains match within the id set. A
    //    schedule_task also contributes its scheduled device so it pins like an action.
    const rawNames = argNames(call.args);
    if (call.name === SCHEDULE_TASK) rawNames.push(...scheduleNames(call.args));
    for (const raw of rawNames) {
      const norm = normalizeName(raw);
      if (!norm) continue;
      const exact = index.get(norm);
      if (exact) {
        hits.add(exact);
        continue;
      }
      for (const [key, id] of index) {
        if (key.includes(norm) || norm.includes(key)) {
          hits.add(id);
          break;
        }
      }
    }

    // 2. tool's own name — exact only (so a verb tool like "HassTurnOn" can't loosely match
    //    an entity that merely contains "on").
    const own = normalizeName(call.name);
    if (own && index.has(own)) hits.add(index.get(own)!);

    // 3. devices the action actually changed (live state-diff).
    const changed = callChanges.get(call.callId);
    if (changed) for (const id of changed) hits.add(id);

    if (!hits.size) continue;
    if (latest === null) latest = hits; // newest resolving action = highlight
    for (const id of hits) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return { ordered, latest: latest ?? new Set() };
}

// ---- live state-diff -------------------------------------------------------

/** Change token: last_updated so attribute-only edits (a climate set-point, a light's
 *  brightness) count too, not just on/off transitions. */
function changeToken(e: HassEntity): string {
  return e.last_updated ?? e.last_changed ?? e.state ?? '';
}

/** Voice-exposed actuator entities — the set the state-diff watches. */
function actuatorIds(hass: Hass, exposed: Set<string> | null): string[] {
  return Object.keys(hass.states).filter(
    (id) => ACTUATOR_DOMAINS.has(domainOf(id)) && keep(hass, exposed, id)
  );
}

function snapshot(hass: Hass, ids: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const id of ids) {
    const e = hass.states[id];
    if (e) m.set(id, changeToken(e));
  }
  return m;
}

/** Actuator entity_ids whose change token differs from the baseline snapshot. */
export function detectChanges(baseline: Map<string, string>, hass: Hass, ids: string[]): string[] {
  const changed: string[] = [];
  for (const id of ids) {
    const before = baseline.get(id);
    const e = hass.states[id];
    if (before === undefined || !e) continue;
    if (changeToken(e) !== before) changed.push(id);
  }
  return changed;
}

function newestActionCall(toolCalls: ToolCall[]): ToolCall | null {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const c = toolCalls[i];
    if (c.status === 'error' || c.status === 'cancelled') continue;
    if (isQueryTool(c.name)) continue;
    return c;
  }
  return null;
}

interface DiffWindow {
  baseline: Map<string, string>;
  activeCallId: string;
  until: number;
}

/**
 * Resolves which entities the agent has acted on, combining name matching with a live
 * state-diff: when an action call appears it snapshots actuator state and, for a few seconds,
 * attributes any changed actuator to that call. Returns { ordered, latest } for tile pinning.
 */
export function useActedOnEntities(
  hass: Hass | null,
  exposed: Set<string> | null,
  toolCalls: ToolCall[]
): ActedOn {
  const [callChanges, setCallChanges] = useState<Map<string, Set<string>>>(() => new Map());

  const windowRef = useRef<DiffWindow | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const hassRef = useRef(hass);
  hassRef.current = hass;
  const exposedRef = useRef(exposed);
  exposedRef.current = exposed;

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  // Open / extend the state-diff window when an action call arrives; reset when the tool feed
  // clears (a new session).
  useEffect(() => {
    if (toolCalls.length === 0) {
      windowRef.current = null;
      clearTimer();
      setCallChanges((m) => (m.size ? new Map() : m));
      return;
    }
    const h = hassRef.current;
    if (!h) return;
    const newest = newestActionCall(toolCalls);
    if (!newest) return;

    const now = Date.now();
    if (!windowRef.current) {
      windowRef.current = {
        baseline: snapshot(h, actuatorIds(h, exposedRef.current)),
        activeCallId: newest.callId,
        until: now + STATE_DIFF_WINDOW_MS,
      };
    } else {
      // Keep the baseline across a burst (so no change is lost) but attribute new changes to
      // the newest action and extend the watch window.
      windowRef.current.activeCallId = newest.callId;
      windowRef.current.until = now + STATE_DIFF_WINDOW_MS;
    }
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      windowRef.current = null;
      timerRef.current = undefined;
    }, STATE_DIFF_WINDOW_MS);
  }, [toolCalls]);

  // While the window is open, attribute changed actuators to the active call.
  useEffect(() => {
    const w = windowRef.current;
    if (!hass || !w || Date.now() >= w.until) return;
    const changed = detectChanges(w.baseline, hass, actuatorIds(hass, exposedRef.current));
    if (!changed.length) return;
    setCallChanges((prev) => {
      const next = new Set(prev.get(w.activeCallId) ?? []);
      let added = false;
      for (const id of changed) {
        if (!next.has(id)) {
          next.add(id);
          added = true;
        }
      }
      if (!added) return prev;
      const m = new Map(prev);
      m.set(w.activeCallId, next);
      return m;
    });
  }, [hass]);

  useEffect(() => () => clearTimer(), []);

  const universe = useMemo(
    () => (hass ? Object.keys(hass.states).filter((id) => keep(hass, exposed, id)) : []),
    [hass, exposed]
  );

  return useMemo(
    () =>
      hass
        ? resolveActedOn(hass, universe, toolCalls, callChanges)
        : { ordered: [], latest: new Set<string>() },
    [hass, universe, toolCalls, callChanges]
  );
}
