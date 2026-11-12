import { useCallback, useEffect, useState } from 'react';
import { useHass } from '../hass/context';

const PATH = 'livekit_voice/memories';
const path = (id: number) => `${PATH}/${id}`;

/** Something the agent remembers: the viewer's own, or the household's when shared. */
export interface Memory {
  id: number;
  text: string;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoriesApi {
  memories: Memory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (text: string, shared: boolean) => Promise<void>;
  save: (id: number, patch: Partial<Pick<Memory, 'text' | 'shared'>>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

function detail(e: unknown): string {
  const body = (e as { body?: { detail?: unknown } })?.body?.detail;
  if (typeof body === 'string') return body;
  const s = typeof e === 'string' ? e : (e as Error)?.message || String(e);
  return /503|not configured/i.test(s)
    ? 'Scheduler not configured — set its URL in the integration settings.'
    : 'Could not reach the scheduler.';
}

/** The memories the agent loads into each new conversation, with edits that save at once. */
export function useMemories(): MemoriesApi {
  const hass = useHass();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hass) return;
    setLoading(true);
    setError(null);
    try {
      const data = await hass.callApi<Memory[]>('GET', PATH);
      setMemories(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(detail(e));
    } finally {
      setLoading(false);
    }
  }, [hass]);

  // each edit reports its failure and reloads, so the list always shows what is stored
  const run = useCallback(
    async (call: () => Promise<unknown>) => {
      setError(null);
      try {
        await call();
      } catch (e) {
        setError(detail(e));
      }
      await refresh();
    },
    [refresh],
  );

  const add = useCallback(
    (text: string, shared: boolean) => run(() => hass!.callApi('POST', PATH, { text, shared })),
    [hass, run],
  );
  const save = useCallback(
    (id: number, patch: Partial<Pick<Memory, 'text' | 'shared'>>) =>
      run(() => hass!.callApi('PATCH', path(id), patch)),
    [hass, run],
  );
  const remove = useCallback(
    (id: number) => run(() => hass!.callApi('DELETE', path(id))),
    [hass, run],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { memories, loading, error, refresh, add, save, remove };
}
