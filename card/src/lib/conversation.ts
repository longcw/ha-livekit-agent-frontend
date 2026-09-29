import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranscriptions } from '@livekit/components-react';
import { SCHEDULING_TOOLS } from './tasks';
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
  /** The tool's result, or its error text; possibly clipped. */
  output?: string | null;
  /** The full output length, present when `output` was clipped. */
  outputChars?: number;
}

export type ConvItem = ConvMessage | ConvAction;

// ---- display helpers -------------------------------------------------------

/** The user's latest message, which the device tiles rank against. */
export function lastUserText(items: ConvItem[]): string {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind === 'message' && it.role === 'user') return it.text;
  }
  return '';
}

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

/** Pretty-prints JSON for display; clipped JSON is re-indented as far as it goes, anything else stays as text. */
export function prettyJson(value: unknown, clipped = false): string {
  if (typeof value !== 'string') return JSON.stringify(value, null, 2);
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    if (!clipped || !/^\s*[[{]/.test(value)) return value;
  }
  // a clipped document never parses, so indent it token by token instead
  let out = '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  const nl = () => '\n' + '  '.repeat(depth);
  for (const ch of value) {
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === '{' || ch === '[') {
      depth++;
      out += ch + nl();
    } else if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      out += nl() + ch;
    } else if (ch === ',') out += ',' + nl();
    else if (ch === ':') out += ': ';
    else if (!/\s/.test(ch)) out += ch;
  }
  return out;
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
    // reads vs. actions differently. Each shows its live status via the status dot. Scheduling
    // tools are excluded — they render in the <ScheduledTasks> rail instead of as chips.
    const actions: ConvItem[] = toolCalls
      .filter((t) => !SCHEDULING_TOOLS.has(t.name))
      .map((t) => ({
        kind: 'action',
        id: t.callId,
        ts: t.startedAt,
        name: t.name,
        args: t.args,
        status: t.status,
        output: t.output,
      }));

    return [...messages, ...actions].sort((a, b) => a.ts - b.ts);
  }, [transcriptions, typed, toolCalls, localIdentity]);

  return { items, addTyped };
}
