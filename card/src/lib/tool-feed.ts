import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import { useRoomDataTopic } from './room-data';

// Must match TOOL_CALL_TOPIC in agent/agent.py.
export const TOOL_CALL_TOPIC = 'ha.tool_call';

export type ToolStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface ToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown> | string | null;
  status: ToolStatus;
  output?: string | null;
  startedAt: number;
  endedAt?: number;
}

/** Areas referenced by an agent tool call (e.g. get_devices(area=...)). */
function argAreas(args: ToolCall['args']): string[] {
  if (!args || typeof args === 'string') return [];
  const area = (args as Record<string, unknown>).area;
  if (typeof area === 'string') return [area];
  if (Array.isArray(area)) return area.map(String);
  return [];
}

export interface ToolFeed {
  toolCalls: ToolCall[];
  /** Distinct areas the agent has looked at this session (for follow-agent tiles). */
  agentAreas: string[];
}

/**
 * Subscribes to the agent's tool-execution data channel and exposes the ordered tool
 * calls plus the areas the agent has touched (used to surface device tiles).
 */
export function useToolFeed(): ToolFeed {
  const session = useSessionContext();
  const [tools, setTools] = useState<Record<string, ToolCall>>({});

  const onMessage = useCallback((data: any) => {
    const update = data.update;
    if (!update) return;
    const at = typeof data.created_at === 'number' ? data.created_at * 1000 : Date.now();

    if (update.type === 'tool_call_started') {
      const fc = update.function_call ?? {};
      const callId = String(fc.call_id);
      let args: ToolCall['args'] = null;
      if (typeof fc.arguments === 'string' && fc.arguments) {
        try {
          args = JSON.parse(fc.arguments);
        } catch {
          args = fc.arguments;
        }
      }
      setTools((s) => ({
        ...s,
        [callId]: { callId, name: String(fc.name), args, status: 'running', startedAt: at },
      }));
    } else if (update.type === 'tool_call_ended') {
      const callId = String(update.call_id);
      setTools((s) => {
        const prev =
          s[callId] ??
          ({ callId, name: 'tool', args: null, status: 'running', startedAt: at } as ToolCall);
        return {
          ...s,
          [callId]: {
            ...prev,
            status: (update.status as ToolStatus) ?? 'done',
            output: (update.message as string | null) ?? prev.output ?? null,
            endedAt: at,
          },
        };
      });
    } else if (update.type === 'tool_call_updated') {
      const callId = String(update.call_id);
      setTools((s) => {
        const prev = s[callId];
        if (!prev) return s;
        return { ...s, [callId]: { ...prev, output: (update.message as string) ?? prev.output } };
      });
    }
  }, []);
  useRoomDataTopic(session.room, TOOL_CALL_TOPIC, onMessage);

  useEffect(() => {
    if (!session.isConnected) setTools({});
  }, [session.isConnected]);

  return useMemo(() => {
    const toolCalls = Object.values(tools).sort((a, b) => a.startedAt - b.startedAt);
    const areas = new Set<string>();
    for (const t of toolCalls) for (const a of argAreas(t.args)) areas.add(a);
    return { toolCalls, agentAreas: [...areas] };
  }, [tools]);
}
