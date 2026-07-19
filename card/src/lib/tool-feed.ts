import { useEffect, useMemo, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useSessionContext } from '@livekit/components-react';

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
  const room = session.room;
  const [tools, setTools] = useState<Record<string, ToolCall>>({});

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();

    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== TOOL_CALL_TOPIC) return;
      let data: any;
      try {
        data = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
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
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

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
