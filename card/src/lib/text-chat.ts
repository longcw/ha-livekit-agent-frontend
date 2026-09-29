import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHass } from '../hass/context';
import type { ConvItem } from './conversation';
import { argAreas, type ToolCall, type ToolStatus } from './tool-feed';

const CHAT_PATH = 'livekit_voice/chat';
const HISTORY_PATH = 'livekit_voice/chat/history';
const CANCEL_PATH = 'livekit_voice/chat/cancel';
const WARM_PATH = 'livekit_voice/chat/warm';
const CONVERSATIONS_PATH = 'livekit_voice/chat/conversations';
const SWITCH_PATH = 'livekit_voice/chat/switch';
const DELETE_PATH = 'livekit_voice/chat/delete';

type HistoryItem = ConvItem & { call_id?: string; output_chars?: number };

interface History {
  conversation_id: string | null;
  busy: boolean;
  /** The running turn's task, once it has started. */
  task_id?: string | null;
  items: HistoryItem[];
  /** Quick replies the agent offered since the user last spoke. */
  suggestions?: string[];
}

/** One of the person's conversations, titled by its first message. */
export interface ConversationSummary {
  id: string;
  title: string;
  created: number;
  updated: number;
}

export interface ConversationList {
  current: string | null;
  conversations: ConversationSummary[];
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
  /** The running turn can be stopped: its task id is known. */
  canStop: boolean;
  /** A stop was sent for the running turn and it has not ended yet. */
  stopping: boolean;
  error: string | null;
  stop: () => Promise<void>;
  /** Load the conversation ahead of a message, so its first reply does not wait. */
  warm: () => void;
  send: (text: string) => Promise<void>;
  renew: () => Promise<void>;
  refresh: () => Promise<void>;
  /** The person's conversations, latest first. */
  listConversations: () => Promise<ConversationList>;
  /** A past conversation's items, read without making it current. */
  readConversation: (id: string) => Promise<ConvItem[]>;
  /** Make a past conversation the current one; false while a turn runs. */
  switchConversation: (id: string) => Promise<boolean>;
  /** Delete a past conversation; the current one is never deleted. */
  deleteConversation: (id: string) => Promise<boolean>;
}

// a call keeps its call_id from running to done, so its row (and whether it is expanded) survives the polls
function toConvItems(history: HistoryItem[]): ConvItem[] {
  return history.map<ConvItem>((i) =>
    i.kind === 'action' ? { ...i, id: i.call_id ?? i.id, outputChars: i.output_chars } : i,
  );
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
  const lastBody = useRef('');
  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  // the task a stop was sent for; a newer turn has another id, so it is never shown as stopping
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // our message, shown until the conversation has it
  const [pending, setPending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hass) return;
    try {
      const data = await hass.callApi<History>('GET', HISTORY_PATH);
      // a poll that brings nothing new keeps the same arrays: the device tiles read a
      // changed tool-call list as new agent activity and keep watching for state changes
      const body = JSON.stringify([data?.items, data?.suggestions]);
      if (body !== lastBody.current) {
        lastBody.current = body;
        setHistory(Array.isArray(data?.items) ? data.items : []);
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      }
      setBusy(Boolean(data?.busy));
      setTaskId(data?.busy && data.task_id ? data.task_id : null);
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

  // the stopped turn is over once history is idle and our own send has resolved
  useEffect(() => {
    if (!busy && pending === null) setStoppingId(null);
  }, [busy, pending]);

  // the worker loads a conversation it had unloaded only on a message, or when asked here;
  // a conversation already loaded makes it a no-op
  const warm = useCallback(() => {
    if (!hass) return;
    hass.callApi('POST', WARM_PATH, {}).catch(() => undefined);
  }, [hass]);

  useEffect(() => {
    if (active) warm();
  }, [active, warm]);

  const stop = useCallback(async () => {
    if (!hass || !taskId) return;
    setStoppingId(taskId);
    try {
      // the worker stops the turn only while this task is still the running one
      const res = await hass.callApi<{ cancelled?: boolean }>('POST', CANCEL_PATH, { task_id: taskId });
      if (!res?.cancelled) setStoppingId(null);
    } catch (e) {
      setStoppingId(null);
      setError(humanizeError(e));
    }
    await refresh();
  }, [hass, taskId, refresh]);

  const listConversations = useCallback(async () => {
    const data = await hass!.callApi<ConversationList>('GET', CONVERSATIONS_PATH);
    return { current: data?.current ?? null, conversations: data?.conversations ?? [] };
  }, [hass]);

  const readConversation = useCallback(
    async (id: string) => {
      const query = `?conversation_id=${encodeURIComponent(id)}`;
      const data = await hass!.callApi<History>('GET', HISTORY_PATH + query);
      return toConvItems(Array.isArray(data?.items) ? data.items : []);
    },
    [hass],
  );

  const switchConversation = useCallback(
    async (id: string) => {
      const res = await hass!.callApi<{ switched?: boolean }>('POST', SWITCH_PATH, { conversation_id: id });
      await refresh();
      return Boolean(res?.switched);
    },
    [hass, refresh],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      const res = await hass!.callApi<{ deleted?: boolean }>('POST', DELETE_PATH, { conversation_id: id });
      return Boolean(res?.deleted);
    },
    [hass],
  );

  const items = useMemo(() => {
    const conv = toConvItems(history);
    const last = [...history].reverse().find((i) => i.kind === 'message' && i.role === 'user');
    if (!pending || (last?.kind === 'message' && last.text === pending)) return conv;
    const mine: ConvItem = { kind: 'message', id: 'pending', role: 'user', text: pending, ts: Date.now() };
    return [...conv, mine];
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
    canStop: taskId !== null && stoppingId !== taskId,
    stopping: stoppingId !== null && (stoppingId === taskId || taskId === null),
    error,
    stop,
    warm,
    send,
    renew,
    refresh,
    listConversations,
    readConversation,
    switchConversation,
    deleteConversation,
  };
}
