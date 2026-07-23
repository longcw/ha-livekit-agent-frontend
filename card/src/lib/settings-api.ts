import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHass } from '../hass/context';

// Card <-> integration settings proxy (forwards to the scheduler's /settings). A
// persistent_notification is ALWAYS raised by the worker; these are the extra notify.*
// services (e.g. a phone via the HA Companion app) it also pushes to.
const PATH = 'livekit_voice/settings';

export interface NotifyTarget {
  /** notify service name, e.g. "mobile_app_iphone" (stored value). */
  service: string;
  /** Friendly label for the chip. */
  label: string;
}

export interface NotifySettingsApi {
  available: NotifyTarget[];
  selected: string[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  toggle: (service: string) => void;
}

function labelFor(service: string): string {
  const base = service.startsWith('mobile_app_')
    ? service.slice('mobile_app_'.length)
    : service;
  return base.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The notify-target picker's state: the notify.* services HA exposes (minus the always-on
 * persistent_notification and the catch-all `notify`), the currently-selected targets loaded
 * from the scheduler, and an optimistic toggle that saves each change.
 */
export function useNotifySettings(): NotifySettingsApi {
  const hass = useHass();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaded = useRef(false);

  // The device list stays live: HA replaces `hass` on every registry change, so a device
  // added / removed (or a notify service appearing/disappearing) recomputes this memo.
  const available = useMemo<NotifyTarget[]>(() => {
    const svc = hass?.services?.notify;
    if (!svc) return [];
    // Exclude non-device services: the always-on persistent_notification (shown as its own
    // row), the legacy catch-all `notify`, and the generic `send_message` action (needs a
    // target entity, so it isn't a pickable destination on its own).
    const skip = new Set(['persistent_notification', 'notify', 'send_message']);
    return Object.keys(svc)
      .filter((s) => !skip.has(s))
      .sort()
      .map((s) => ({ service: s, label: labelFor(s) }));
  }, [hass]);

  // Load the saved selection once, when hass first becomes available — NOT on every hass
  // push (that would refetch constantly and could clobber an in-flight optimistic toggle).
  useEffect(() => {
    if (!hass || loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    setLoading(true);
    setError(null);
    hass
      .callApi<{ notify_targets?: string[] }>('GET', PATH)
      .then((d) => {
        if (!cancelled) setSelected(Array.isArray(d?.notify_targets) ? d.notify_targets : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load notification settings.');
          loaded.current = false; // allow a retry on the next hass update
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hass]);

  const toggle = useCallback(
    (service: string) => {
      if (!hass) return;
      const prev = selected;
      const next = prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service];
      setSelected(next);
      setSaving(true);
      setError(null);
      hass
        .callApi('PUT', PATH, { notify_targets: next })
        .catch(() => {
          setError('Could not save. Try again.');
          setSelected(prev); // roll back the optimistic toggle
        })
        .finally(() => setSaving(false));
    },
    [hass, selected],
  );

  return { available, selected, loading, saving, error, toggle };
}
