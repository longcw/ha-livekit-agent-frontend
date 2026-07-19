import { useEffect, useState } from 'react';
import type { Hass } from '../hass/store';

// Which entities are exposed to Home Assistant's voice assistant (Assist). This is the
// same set the worker's GetLiveContext sees, and it excludes diagnostic/config/helper
// entities — so it's the right, self-contained filter for what to show as tiles.
// Cached at module scope so it survives card re-mounts (refreshed on a full page reload).

let cache: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;

async function fetchExposed(hass: Hass): Promise<Set<string>> {
  if (!hass.callWS) return new Set();
  try {
    const res: any = await hass.callWS({ type: 'homeassistant/expose_entity/list' });
    const exposed = (res?.exposed_entities ?? res ?? {}) as Record<string, any>;
    const set = new Set<string>();
    for (const [entityId, assistants] of Object.entries(exposed)) {
      if (assistants && assistants.conversation) set.add(entityId);
    }
    return set;
  } catch {
    return new Set();
  }
}

/**
 * Returns the set of voice-exposed entity_ids, or null while loading. An empty (non-null)
 * set means the query ran but nothing is exposed / the command is unsupported — callers
 * should then fall back to a category-based filter.
 */
export function useExposedEntities(hass: Hass | null): Set<string> | null {
  const [set, setSet] = useState<Set<string> | null>(cache);
  useEffect(() => {
    if (!hass || set) return;
    if (!inFlight) inFlight = fetchExposed(hass);
    let alive = true;
    inFlight.then((s) => {
      cache = s;
      if (alive) setSet(s);
    });
    return () => {
      alive = false;
    };
  }, [hass, set]);
  return set;
}
