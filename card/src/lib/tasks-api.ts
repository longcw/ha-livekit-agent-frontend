import { useCallback, useEffect, useRef, useState } from 'react';
import { useHass } from '../hass/context';
import {
  SCHEDULE_TASK,
  SCHEDULING_TOOLS,
  type Task,
  UPDATE_SCHEDULED_TASK,
} from './tasks';
import type { ToolCall } from './tool-feed';

const LIST_PATH = 'livekit_voice/tasks?active_only=false';
const path = (id: string) => `livekit_voice/tasks/${encodeURIComponent(id)}`;

export interface TasksApi {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  freshId: string | null;
  refresh: () => Promise<void>;
  save: (id: string, patch: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function humanizeError(e: unknown): string {
  const s = typeof e === 'string' ? e : (e as Error)?.message || String(e);
  if (/503/.test(s) || /not configured/i.test(s)) {
    return 'Scheduler not configured — set its URL in the integration settings.';
  }
  return 'Could not reach the scheduler. Check the integration settings.';
}

/**
 * Live task list, fetched from the Home Assistant scheduler proxy (works with no LiveKit
 * connection). Auto-refreshes whenever the agent schedules/cancels/updates a task over the
 * tool feed, and marks the freshly-scheduled one so the UI can highlight it.
 */
export function useTasks(toolCalls: ToolCall[]): TasksApi {
  const hass = useHass();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!hass) return;
    setLoading(true);
    setError(null);
    try {
      const data = await hass.callApi<Task[]>('GET', LIST_PATH);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }, [hass]);

  const save = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!hass) return;
      await hass.callApi('PATCH', path(id), patch);
      await refresh();
    },
    [hass, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!hass) return;
      await hass.callApi('DELETE', path(id));
      await refresh();
    },
    [hass, refresh],
  );

  // Initial load once hass is available.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The agent scheduled/changed something via voice/chat → refresh + mark the fresh task.
  useEffect(() => {
    let changed = false;
    let fresh: string | null = null;
    for (const tc of toolCalls) {
      if (tc.status !== 'done' || !SCHEDULING_TOOLS.has(tc.name)) continue;
      if (seen.current.has(tc.callId)) continue;
      seen.current.add(tc.callId);
      changed = true;
      if (tc.name === SCHEDULE_TASK || tc.name === UPDATE_SCHEDULED_TASK) {
        try {
          const t = JSON.parse(tc.output ?? '');
          if (t?.id) fresh = t.id as string;
        } catch {
          /* error strings aren't JSON */
        }
      }
    }
    if (changed) {
      void refresh();
      if (fresh) setFreshId(fresh);
    }
  }, [toolCalls, refresh]);

  return { tasks, loading, error, freshId, refresh, save, remove };
}
