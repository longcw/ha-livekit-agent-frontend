import { useEffect, useRef, useState } from 'react';
import type { ReceivedMessage } from '@livekit/components-react';
import type { TranscriptLine } from './sessions';
import type { ToolCall } from './tool-feed';

/**
 * Accumulates the current session's transcript + tool calls into a log that SURVIVES
 * disconnect (so the last conversation stays on screen). It resets only when `epoch`
 * changes — which the app bumps when the user starts a new connection. The live SDK
 * hooks are merge-only sources here; they never clear the log.
 */
export interface SessionLog {
  startedAt: number;
  lines: TranscriptLine[];
  toolCalls: ToolCall[];
  agentAreas: string[];
}

function toLine(m: ReceivedMessage): TranscriptLine {
  return { id: m.id, user: !!m.from?.isLocal, text: m.message };
}

export function useSessionLog(
  liveMessages: ReceivedMessage[],
  liveToolCalls: ToolCall[],
  liveAgentAreas: string[],
  epoch: number
): SessionLog {
  const lineMap = useRef(new Map<string, TranscriptLine>());
  const toolMap = useRef(new Map<string, ToolCall>());
  const areaSet = useRef(new Set<string>());
  const startedAt = useRef<number>(Date.now());
  const lastEpoch = useRef(epoch);
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);

  // Reset for a new session (during render — refs only, so no extra paint).
  if (lastEpoch.current !== epoch) {
    lastEpoch.current = epoch;
    lineMap.current = new Map();
    toolMap.current = new Map();
    areaSet.current = new Set();
    startedAt.current = Date.now();
  }

  useEffect(() => {
    if (!liveMessages?.length) return;
    let changed = false;
    for (const m of liveMessages) {
      const prev = lineMap.current.get(m.id);
      const line = toLine(m);
      if (!prev || prev.text !== line.text || prev.user !== line.user) {
        lineMap.current.set(m.id, line);
        changed = true;
      }
    }
    if (changed) bump();
  }, [liveMessages]);

  useEffect(() => {
    if (!liveToolCalls?.length) return;
    let changed = false;
    for (const t of liveToolCalls) {
      const prev = toolMap.current.get(t.callId);
      if (!prev || prev.status !== t.status || prev.output !== t.output) {
        toolMap.current.set(t.callId, t);
        changed = true;
      }
    }
    if (changed) bump();
  }, [liveToolCalls]);

  useEffect(() => {
    let changed = false;
    for (const a of liveAgentAreas) {
      if (!areaSet.current.has(a)) {
        areaSet.current.add(a);
        changed = true;
      }
    }
    if (changed) bump();
  }, [liveAgentAreas]);

  return {
    startedAt: startedAt.current,
    lines: [...lineMap.current.values()],
    toolCalls: [...toolMap.current.values()],
    agentAreas: [...areaSet.current],
  };
}
