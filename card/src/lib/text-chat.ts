import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHass } from '../hass/context';
import type { ConvItem } from './conversation';
import { argAreas, type ToolCall, type ToolStatus } from './tool-feed';

const CHAT_PATH = 'livekit_voice/chat';
const HISTORY_PATH = 'livekit_voice/chat/history';

type HistoryItem = ConvItem & { call_id?: string; output?: string };

interface History {
  conversation_id: string | null;
  busy: boolean;
  items: HistoryItem[];
  /** Quick replies the agent offered since the user last spoke. */
  suggestions?: string[];
}

export interface TextChatApi {
  items: ConvItem[];
  /** The conversation's tool calls, shaped like the live tool feed's. */
  toolCalls: ToolCall[];
  /** Areas the agent looked at, for the device tiles. */
  agentAreas: string[];
  /** Quick replies for the agent's last question. */
  suggestions: string[];
  /** A turn is running — this card's, or one sent from elsewhere (e.g. an iPhone Shortcut). */
  busy: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  renew: () => Promise<void>;
  refresh: () => Promise<void>;
}

function humanizeError(e: unknown): string {
  const s = typeof e === 'string' ? e : (e as Error)?.message || String(e);
  if (/503/.test(s) || /not configured/i.test(s)) {
    return 'Text chat not configured — set the agent chat URL in the integration settings.';
  }
  return 'Could not reach the agent. Check the integration settings.';
}

/**
 * The worker's persisted text conversation, through the Home Assistant chat proxy — the same
 * conversation an iPhone Shortcut posts into. Polls while `active`: every second while a turn
 * runs, so its tool calls appear as they happen, and every few seconds otherwise, so turns
 * sent from elsewhere show up too.
 */
export function useTextChat(active: boolean): TextChatApi {
  const hass = useHass();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // our message, shown until the conversation has it
  const [pending, setPending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hass) return;
    try {
      const data = await hass.callApi<History>('GET', HISTORY_PATH);
      setHistory(Array.isArray(data?.items) ? data.items : []);
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setBusy(Boolean(data?.busy));
      setError(null);
    } catch (e) {
      setError(humanizeError(e));
    }
  }, [hass]);

  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = setInterval(() => void refresh(), busy || pending ? 1000 : 5000);
    return () => clearInterval(timer);
  }, [active, busy, pending, refresh]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      if (!hass) return;
      setBusy(true);
      try {
        // the reply is the whole turn as text; the history poll already rendered it
        await hass.callApi('POST', CHAT_PATH, body);
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        setPending(null);
        await refresh();
      }
    },
    [hass, refresh],
  );

  const send = useCallback(
    async (text: string) => {
      setPending(text);
      await post({ text, steps: false });
    },
    [post],
  );

  const renew = useCallback(() => post({ new: true }), [post]);

  const items = useMemo(() => {
    const last = [...history].reverse().find((i) => i.kind === 'message' && i.role === 'user');
    if (!pending || (last?.kind === 'message' && last.text === pending)) return history;
    const mine: ConvItem = { kind: 'message', id: 'pending', role: 'user', text: pending, ts: Date.now() };
    return [...history, mine];
  }, [history, pending]);

  const { toolCalls, agentAreas } = useMemo(() => {
    const calls: ToolCall[] = [];
    const areas = new Set<string>();
    for (const i of history) {
      if (i.kind !== 'action') continue;
      calls.push({
        callId: i.call_id ?? i.id,
        name: i.name,
        args: i.args,
        status: i.status as ToolStatus,
        output: i.output ?? null,
        startedAt: i.ts,
      });
      for (const a of argAreas(i.args)) areas.add(a);
    }
    return { toolCalls: calls, agentAreas: [...areas] };
  }, [history]);

  return {
    items,
    toolCalls,
    agentAreas,
    // an answer in flight makes the last question's replies stale
    suggestions: busy || pending !== null ? [] : suggestions,
    busy: busy || pending !== null,
    error,
    send,
    renew,
    refresh,
  };
}
