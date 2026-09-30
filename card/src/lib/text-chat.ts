import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHass, useStore } from '../hass/context';
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
  /** The reply was stopped but the turn still runs work in the background, so the next
   *  stop is a force stop, which cancels that work too. */
  forceStop: boolean;
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
  /** Make a past conversation the current one, showing `items` meanwhile; false while a turn runs. */
  switchConversation: (id: string, items?: ConvItem[]) => Promise<boolean>;
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
 * sent from elsewhere show up too. Starting or switching a conversation shows it at once and
 * runs the request in the background, ahead of any message sent after it.
 */
export function useTextChat(active: boolean): TextChatApi {
  // read at call time: HA replaces the hass object on every state change
  const store = useStore();
  const ready = useHass() !== null;
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const lastBody = useRef('');
  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  // the task a stop was sent for; a newer turn has another id, so it is never shown as stopping
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  // when the reply was stopped, and the task a force stop was sent for
  const [stoppedAt, setStoppedAt] = useState(0);
  const [forcingId, setForcingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // our message, shown until the conversation has it
  const [pending, setPending] = useState<string | null>(null);
  // the last message we sent: its row keeps this key once the conversation has it, so it is not remounted
  const sent = useRef({ text: '', key: '', from: 0, ts: 0 });
  const historyLen = useRef(0);
  // what a conversation change shows until the worker has made it
  const [shown, setShown] = useState<ConvItem[] | null>(null);
  // requests that change the conversation, and messages, go out in order
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // conversation changes in flight; `epoch` moves on each one, so a poll that
  // straddles one is dropped instead of showing the conversation it replaces
  const changing = useRef(0);
  const epoch = useRef(0);

  const enqueue = useCallback(<T,>(request: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(request, request);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const refresh = useCallback(async () => {
    const hass = store.getSnapshot().hass;
    if (!hass) return;
    const at = epoch.current;
    try {
      const data = await hass.callApi<History>('GET', HISTORY_PATH);
      if (changing.current || at !== epoch.current) return;
      // a poll that brings nothing new keeps the same arrays: the device tiles read a
      // changed tool-call list as new agent activity and keep watching for state changes
      const body = JSON.stringify([data?.items, data?.suggestions]);
      if (body !== lastBody.current) {
        lastBody.current = body;
        const next = Array.isArray(data?.items) ? data.items : [];
        historyLen.current = next.length;
        setHistory(next);
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      }
      setBusy(Boolean(data?.busy));
      setTaskId(data?.busy && data.task_id ? data.task_id : null);
      setError(null);
    } catch (e) {
      setError(humanizeError(e));
    }
  }, [store]);

  useEffect(() => {
    if (!active || !ready) return;
    void refresh();
    const timer = setInterval(() => void refresh(), busy || pending ? 1000 : 5000);
    return () => clearInterval(timer);
  }, [active, ready, busy, pending, refresh]);

  const send = useCallback(
    async (text: string) => {
      sent.current = { text, key: `sent-${Date.now()}`, from: historyLen.current, ts: Date.now() };
      setPending(text);
      try {
        // answered once the turn starts; the history poll shows the rest
        await enqueue(() => store.getSnapshot().hass!.callApi('POST', CHAT_PATH, { text, steps: false }));
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        // clearing our message before the conversation has it would blink it out for a round trip
        await refresh();
        setPending(null);
      }
    },
    [store, enqueue, refresh],
  );

  // the worker loads a conversation it had unloaded only on a message, or when asked here;
  // a conversation already loaded makes it a no-op
  const warm = useCallback(() => {
    store.getSnapshot().hass?.callApi('POST', WARM_PATH, {}).catch(() => undefined);
  }, [store]);

  /** Show `view` at once while `request` changes the conversation, then settle on the worker's. */
  const change = useCallback(
    async <T,>(view: ConvItem[], request: () => Promise<T>): Promise<T | undefined> => {
      changing.current++;
      epoch.current++;
      historyLen.current = view.length;
      setShown(view);
      // the conversation changed to has no turn of its own yet
      setBusy(false);
      setTaskId(null);
      setError(null);
      try {
        return await enqueue(request);
      } catch (e) {
        setError(humanizeError(e));
        return undefined;
      } finally {
        changing.current--;
        epoch.current++;
        await refresh();
        if (!changing.current) setShown(null);
        warm();
      }
    },
    [enqueue, refresh, warm],
  );

  const renew = useCallback(async () => {
    await change([], () => store.getSnapshot().hass!.callApi('POST', CHAT_PATH, { new: true }));
  }, [store, change]);

  // the stopped turn is over once history is idle and our own send has resolved
  useEffect(() => {
    if (!busy && pending === null) {
      setStoppingId(null);
      setForcingId(null);
    }
  }, [busy, pending]);

  useEffect(() => {
    if (active && ready) warm();
  }, [active, ready, warm]);

  const base = useMemo(() => shown ?? toConvItems(history), [shown, history]);

  // the agent has answered since the person last spoke, so a busy turn has only its
  // background work left, and the only stop that ends it is a force stop
  const lastUser = base.reduce((at, i, n) => (i.kind === 'message' && i.role === 'user' ? n : at), -1);
  const reply = base.slice(lastUser + 1).find((i) => i.kind === 'message' && i.role === 'agent');
  // a turn that is only finishing up after its reply is not running work yet
  const replied = reply !== undefined && Date.now() - reply.ts > 1500;
  // likewise a turn still busy this long after its reply was stopped
  const stoppedLong = stoppingId === taskId && Date.now() - stoppedAt > 1500;
  const forceStop =
    taskId !== null && pending === null && forcingId !== taskId && (replied || stoppedLong);

  const stop = useCallback(async () => {
    const hass = store.getSnapshot().hass;
    if (!hass || !taskId) return;
    const force = forceStop;
    const undo = force ? () => setForcingId(null) : () => setStoppingId(null);
    if (force) setForcingId(taskId);
    else {
      setStoppingId(taskId);
      setStoppedAt(Date.now());
    }
    try {
      // the worker stops the turn only while this task is still the running one
      const res = await hass.callApi<{ cancelled?: boolean }>('POST', CANCEL_PATH, { task_id: taskId, force });
      if (!res?.cancelled) undo();
    } catch (e) {
      undo();
      setError(humanizeError(e));
    }
    await refresh();
  }, [store, taskId, forceStop, refresh]);

  const listConversations = useCallback(async () => {
    const data = await store.getSnapshot().hass!.callApi<ConversationList>('GET', CONVERSATIONS_PATH);
    return { current: data?.current ?? null, conversations: data?.conversations ?? [] };
  }, [store]);

  const readConversation = useCallback(
    async (id: string) => {
      const query = `?conversation_id=${encodeURIComponent(id)}`;
      const data = await store.getSnapshot().hass!.callApi<History>('GET', HISTORY_PATH + query);
      return toConvItems(Array.isArray(data?.items) ? data.items : []);
    },
    [store],
  );

  const switchConversation = useCallback(
    async (id: string, items: ConvItem[] = []) => {
      const res = await change(items, () =>
        store.getSnapshot().hass!.callApi<{ switched?: boolean }>('POST', SWITCH_PATH, { conversation_id: id }),
      );
      const switched = Boolean(res?.switched);
      if (res && !switched) setError('A reply is still running; try again when it ends.');
      return switched;
    },
    [store, change],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      const res = await store.getSnapshot().hass!.callApi<{ deleted?: boolean }>('POST', DELETE_PATH, { conversation_id: id });
      return Boolean(res?.deleted);
    },
    [store],
  );

  const items = useMemo(() => {
    const conv = [...base];
    const { text, key, from, ts } = sent.current;
    const at = conv.findIndex((i, n) => n >= from && i.kind === 'message' && i.role === 'user' && i.text === text);
    if (at >= 0) conv[at] = { ...conv[at], id: key };
    else if (pending !== null) conv.push({ kind: 'message', id: key, role: 'user', text: pending, ts });
    return conv;
  }, [base, pending]);

  const { toolCalls, agentAreas } = useMemo(() => {
    const calls: ToolCall[] = [];
    const areas = new Set<string>();
    for (const i of base) {
      if (i.kind !== 'action') continue;
      calls.push({
        callId: i.id,
        name: i.name,
        args: i.args,
        status: i.status as ToolStatus,
        output: i.output ?? null,
        startedAt: i.ts,
      });
      for (const a of argAreas(i.args)) areas.add(a);
    }
    return { toolCalls: calls, agentAreas: [...areas] };
  }, [base]);

  return {
    items,
    toolCalls,
    agentAreas,
    // an answer in flight makes the last question's replies stale
    suggestions: busy || pending !== null ? [] : suggestions,
    busy: busy || pending !== null,
    canStop: taskId !== null && (stoppingId !== taskId || forceStop),
    stopping: !forceStop && stoppingId !== null && (stoppingId === taskId || taskId === null),
    forceStop,
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
