import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHass } from '../hass/context';
import type { ConvItem } from './conversation';

const CHAT_PATH = 'livekit_voice/chat';
const HISTORY_PATH = 'livekit_voice/chat/history';

interface History {
  conversation_id: string | null;
  busy: boolean;
  items: ConvItem[];
}

export interface TextChatApi {
  items: ConvItem[];
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
  const [history, setHistory] = useState<ConvItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // our message, shown until the conversation has it
  const [pending, setPending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hass) return;
    try {
      const data = await hass.callApi<History>('GET', HISTORY_PATH);
      setHistory(Array.isArray(data?.items) ? data.items : []);
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

  return { items, busy: busy || pending !== null, error, send, renew, refresh };
}
