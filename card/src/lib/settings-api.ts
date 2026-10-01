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

/** A family member with their own memory, conversation and notification devices. */
export interface Person {
  /** Fixed once set; every service knows the person by it. The scheduler fills it in. */
  id?: string;
  name: string;
  /** The HA account that resolves to this person on the card and in voice sessions. */
  ha_user_id: string | null;
  notify_targets: string[];
  /** Restricted MCP servers the agent may use for this person; not edited here. */
  servers?: string[];
}

/** An HA login that can be linked to a person. */
export interface HaAccount {
  id: string;
  name: string;
}

export interface NotifySettingsApi {
  available: NotifyTarget[];
  users: Person[];
  /** HA logins for the account picker; null when the viewer cannot list them. */
  accounts: HaAccount[] | null;
  saving: boolean;
  error: string | null;
  /** Add a person; returns an error message when the name is empty or taken. */
  addUser: (name: string) => string | null;
  removeUser: (name: string) => void;
  updateUser: (name: string, patch: Partial<Omit<Person, 'name'>>) => void;
}

function labelFor(service: string): string {
  const base = service.startsWith('mobile_app_')
    ? service.slice('mobile_app_'.length)
    : service;
  return base.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function toPeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u) => u && typeof u.name === 'string')
    .map((u) => ({
      // fields this tab does not edit, such as id and servers, are saved back as they came
      ...u,
      name: u.name,
      ha_user_id: typeof u.ha_user_id === 'string' && u.ha_user_id ? u.ha_user_id : null,
      notify_targets: Array.isArray(u.notify_targets) ? u.notify_targets : [],
    }));
}

/**
 * The Settings tab's state: the notify.* services HA exposes (minus the always-on
 * persistent_notification and the catch-all `notify`), the people loaded from the scheduler,
 * and optimistic edits that save each change.
 */
export function useNotifySettings(): NotifySettingsApi {
  const hass = useHass();
  const [users, setUsers] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<HaAccount[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaded = useRef(false);
  const accountsLoaded = useRef(false);
  // the latest people list, so quick successive edits build on each other
  const usersRef = useRef<Person[]>([]);

  // The device list stays live: HA replaces `hass` on every registry change, so a device
  // added / removed (or a notify service appearing/disappearing) recomputes this memo.
  // phones by the name they have in HA now; their service ids keep the registered name
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const available = useMemo<NotifyTarget[]>(() => {
    const svc = hass?.services?.notify;
    if (!svc) return [];
    // Exclude non-device services: the always-on persistent_notification (shown as its own
    // row), the legacy catch-all `notify`, and the generic `send_message` action (needs a
    // target entity, so it isn't a pickable destination on its own).
    const skip = new Set(['persistent_notification', 'notify', 'send_message']);
    return Object.keys(svc)
      .filter((s) => !skip.has(s))
      .map((s) => ({ service: s, label: deviceNames[s] ?? labelFor(s) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [hass, deviceNames]);

  // Load the saved settings once, when hass first becomes available — NOT on every hass
  // push (that would refetch constantly and could clobber an in-flight optimistic edit).
  useEffect(() => {
    if (!hass || loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    setError(null);
    hass
      .callApi<{
        users?: unknown;
        device_names?: Record<string, string>;
      }>('GET', PATH)
      .then((d) => {
        if (cancelled) return;
        if (d?.device_names && typeof d.device_names === 'object') {
          setDeviceNames(d.device_names);
        }
        usersRef.current = toPeople(d?.users);
        setUsers(usersRef.current);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load notification settings.');
          loaded.current = false; // allow a retry on the next hass update
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hass]);

  // HA lets only admins list logins; anyone else sees linked accounts read-only.
  useEffect(() => {
    if (!hass?.user?.is_admin || !hass.callWS || accountsLoaded.current) return;
    accountsLoaded.current = true;
    hass
      .callWS<any[]>({ type: 'config/auth/list' })
      .then((list) =>
        setAccounts(
          (Array.isArray(list) ? list : [])
            .filter((u) => u && !u.system_generated)
            .map((u) => ({ id: u.id, name: u.name || u.username || u.id }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => setAccounts(null));
  }, [hass]);

  const saveUsers = useCallback(
    (next: Person[]) => {
      if (!hass) return;
      const prev = usersRef.current;
      usersRef.current = next;
      setUsers(next);
      setSaving(true);
      setError(null);
      hass
        .callApi('PUT', PATH, { users: next })
        .catch(() => {
          setError('Could not save. Try again.');
          // roll back only when no newer edit replaced this one meanwhile
          if (usersRef.current === next) {
            usersRef.current = prev;
            setUsers(prev);
          }
        })
        .finally(() => setSaving(false));
    },
    [hass],
  );

  const addUser = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return 'Enter a name.';
      if (usersRef.current.some((u) => sameName(u.name, name))) return `${name} is already listed.`;
      saveUsers([...usersRef.current, { name, ha_user_id: null, notify_targets: [] }]);
      return null;
    },
    [saveUsers],
  );

  const removeUser = useCallback(
    (name: string) => saveUsers(usersRef.current.filter((u) => !sameName(u.name, name))),
    [saveUsers],
  );

  const updateUser = useCallback(
    (name: string, patch: Partial<Omit<Person, 'name'>>) =>
      saveUsers(usersRef.current.map((u) => (sameName(u.name, name) ? { ...u, ...patch } : u))),
    [saveUsers],
  );

  return {
    available,
    users,
    accounts,
    saving,
    error,
    addUser,
    removeUser,
    updateUser,
  };
}
