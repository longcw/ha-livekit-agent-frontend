import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranscriptions } from '@livekit/components-react';
import type { ToolCall } from './tool-feed';

// ---- conversation model ----------------------------------------------------

export type Role = 'user' | 'agent';

export interface ConvMessage {
  kind: 'message';
  id: string;
  role: Role;
  text: string;
  ts: number;
}

export interface ConvAction {
  kind: 'action';
  id: string;
  ts: number;
  name: string;
  args: Record<string, unknown> | string | null;
  status: 'running' | 'done' | 'error' | 'cancelled';
}

export type ConvItem = ConvMessage | ConvAction;

// ---- display helpers -------------------------------------------------------

export function humanizeTool(name: string): string {
  const s = name
    .replace(/^Hass/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : name;
}

export function isActionTool(name: string): boolean {
  if (/^(get|list)/i.test(name)) return false;
  if (/livecontext|status|context|areas|domains|devices|info/i.test(name)) return false;
  return /(turn|set|toggle|open|close|lock|unlock|start|stop|play|pause|activate|press|select|increase|decrease|cancel|dim|brighten|boost)/i.test(
    name
  );
}

export function actionTarget(args: Record<string, unknown> | string | null): string {
  if (!args) return '';
  if (typeof args === 'string') return args;
  const name = args.name ?? args.area ?? args.domain;
  if (Array.isArray(name)) return name.map(String).join(', ');
  return name != null ? String(name) : '';
}

// ---- the live conversation -------------------------------------------------

const FINAL_ATTR = 'lk.transcription_final';
const SEGMENT_ATTR = 'lk.segment_id';

/**
 * Builds the chronological conversation from three live sources:
 *  - transcription segments (deduped by segment id; interim replaced by final),
 *  - typed messages the user sends, and
 *  - the agent's tool calls (inline action items).
 * Resets when `epoch` changes (a new conversation). Nothing is persisted.
 */
export function useConversation(
  localIdentity: string | undefined,
  toolCalls: ToolCall[],
  epoch: number
): { items: ConvItem[]; addTyped: (text: string) => void } {
  const transcriptions = useTranscriptions();
  const [typed, setTyped] = useState<ConvMessage[]>([]);

  useEffect(() => {
    setTyped([]);
  }, [epoch]);

  const addTyped = useCallback((text: string) => {
    setTyped((prev) => [
      ...prev,
      { kind: 'message', id: `typed-${prev.length}-${text.slice(0, 12)}`, role: 'user', text, ts: Date.now() },
    ]);
  }, []);

  const items = useMemo<ConvItem[]>(() => {
    const bySegment = new Map<string, { msg: ConvMessage; final: boolean }>();
    for (const td of transcriptions) {
      const attrs = (td.streamInfo?.attributes ?? {}) as Record<string, string>;
      const segId = attrs[SEGMENT_ATTR] || td.streamInfo?.id;
      if (!segId || !td.text) continue;
      const final = attrs[FINAL_ATTR] === 'true';
      const prev = bySegment.get(segId);
      if (prev && prev.final && !final) continue; // never let interim clobber a final
      const role: Role =
        td.participantInfo?.identity && td.participantInfo.identity === localIdentity ? 'user' : 'agent';
      bySegment.set(segId, {
        final,
        msg: { kind: 'message', id: segId, role, text: td.text, ts: td.streamInfo?.timestamp ?? Date.now() },
      });
    }

    const messages: ConvItem[] = [...[...bySegment.values()].map((v) => v.msg), ...typed];
    // Surface every tool call inline (reads and control actions alike); ActionRow styles
    // reads vs. actions differently. Each shows its live status via the status dot.
    const actions: ConvItem[] = toolCalls.map((t) => ({
      kind: 'action',
      id: t.callId,
      ts: t.startedAt,
      name: t.name,
      args: t.args,
      status: t.status,
    }));

    return [...messages, ...actions].sort((a, b) => a.ts - b.ts);
  }, [transcriptions, typed, toolCalls, localIdentity]);

  return { items, addTyped };
}
