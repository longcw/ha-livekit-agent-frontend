import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
} from '@livekit/components-react';
import { Composer } from './components/Composer';
import { Conversation } from './components/Conversation';
import { DeviceTiles } from './components/DeviceTiles';
import { SessionHistory } from './components/SessionHistory';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { useConversation } from './lib/conversation';
import type { ConvItem } from './lib/session-store';
import { finalizeCurrent, loadHistory, saveCurrent } from './lib/session-store';
import { useToolFeed } from './lib/tool-feed';

export function Root({ store }: { store: HassStore }) {
  return (
    <HassStoreProvider value={store}>
      <SessionRoot />
    </HassStoreProvider>
  );
}

function SessionRoot() {
  const store = useStore();
  const tokenSource = useMemo(() => new HassTokenSource(store), [store]);
  const session = useSession(tokenSource, {});
  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer />
      <CardShell />
    </SessionProvider>
  );
}

function lastUserText(items: ConvItem[]): string {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind === 'message' && it.role === 'user') return it.text;
  }
  return '';
}

function VoiceOrb({ state }: { state: string }) {
  return (
    <span className="lk-orb" data-state={state} aria-hidden="true">
      <span className="lk-orb-core" />
    </span>
  );
}

function CardShell() {
  const hass = useHass();
  const config = useCardConfig();
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const { toolCalls, agentAreas } = useToolFeed();
  const [epoch, setEpoch] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());

  const connected = session.isConnected;
  const localIdentity = session.room?.localParticipant?.identity;
  const { items, addTyped } = useConversation(localIdentity, toolCalls, epoch);

  const startedAt = useRef(Date.now());
  const itemsRef = useRef<ConvItem[]>(items);
  itemsRef.current = items;
  const wasConnected = useRef(false);

  // New session boundary → fresh timestamp.
  useEffect(() => {
    startedAt.current = Date.now();
  }, [epoch]);

  // On mount, finalize any session interrupted by a refresh, and load history.
  useEffect(() => {
    finalizeCurrent();
    setHistory(loadHistory());
  }, []);

  // Persist the live session continuously so a refresh never loses it.
  useEffect(() => {
    if (!connected || !items.length) return;
    const t = window.setTimeout(() => {
      saveCurrent({ id: `s-${startedAt.current}`, startedAt: startedAt.current, endedAt: Date.now(), items });
    }, 400);
    return () => window.clearTimeout(t);
  }, [items, connected]);

  // On disconnect, flush + roll the session into history.
  useEffect(() => {
    if (wasConnected.current && !connected) {
      if (itemsRef.current.length) {
        saveCurrent({
          id: `s-${startedAt.current}`,
          startedAt: startedAt.current,
          endedAt: Date.now(),
          items: itemsRef.current,
        });
      }
      finalizeCurrent();
      setHistory(loadHistory());
    }
    wasConnected.current = connected;
  }, [connected]);

  // Mic policy on connect: live in auto; muted in push-to-talk (PTT button owns it).
  const auto = config.input_mode !== 'push_to_talk';
  const localParticipant = session.room?.localParticipant;
  useEffect(() => {
    if (!connected || !localParticipant) return;
    localParticipant.setMicrophoneEnabled(auto);
  }, [auto, connected, localParticipant]);

  const handleStart = () => {
    setEpoch((e) => e + 1);
    session.start?.();
  };

  if (historyOpen) {
    return (
      <ha-card>
        <SessionHistory onClose={() => setHistoryOpen(false)} />
      </ha-card>
    );
  }

  // Show the live session; when offline show the most recent past session (restored on refresh).
  const displayItems = connected || items.length ? items : history[0]?.items ?? [];
  const query = lastUserText(displayItems);
  const orbState = !connected ? 'idle' : agentState || 'listening';
  const stateLabel = connected ? agentState || 'ready' : displayItems.length ? 'ended' : 'offline';

  return (
    <ha-card>
      <header className="lk-top">
        <VoiceOrb state={orbState} />
        <span className="lk-title">{config.title || 'Home Voice'}</span>
        <span className="lk-status" data-live={connected ? '1' : '0'}>
          {stateLabel}
        </span>
        <button className="lk-round lk-round--ghost" title="Session history" onClick={() => setHistoryOpen(true)}>
          <ha-icon icon="mdi:history" />
        </button>
      </header>

      <DeviceTiles agentAreas={agentAreas} toolCalls={toolCalls} query={query} />

      <Conversation items={displayItems} />

      {connected ? (
        <Composer onTyped={addTyped} />
      ) : (
        <button className="lk-start" onClick={handleStart} disabled={!hass}>
          <ha-icon icon="mdi:microphone" />
          {displayItems.length ? 'New conversation' : 'Start talking'}
        </button>
      )}
    </ha-card>
  );
}
