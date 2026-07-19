import { useEffect, useMemo, useState } from 'react';
import { ParticipantKind, Track } from 'livekit-client';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useChat,
  useSession,
  useSessionContext,
  useTrackToggle,
} from '@livekit/components-react';
import { Conversation } from './components/Conversation';
import { DeviceTiles } from './components/DeviceTiles';
import { Dock } from './components/Dock';
import { Header } from './components/Header';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { type ConvItem, useConversation } from './lib/conversation';
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

function agentIdentity(room: any): string | null {
  if (!room) return null;
  for (const p of room.remoteParticipants.values()) {
    if (p.kind === ParticipantKind.AGENT || p.isAgent) return p.identity;
  }
  return null;
}

function CardShell() {
  const hass = useHass();
  const config = useCardConfig();
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const { toolCalls, agentAreas } = useToolFeed();
  const [epoch, setEpoch] = useState(0);

  const connected = session.isConnected;
  const localIdentity = session.room?.localParticipant?.identity;
  const { items, addTyped } = useConversation(localIdentity, toolCalls, epoch);
  const { send } = useChat();
  const mic = useTrackToggle({ source: Track.Source.Microphone });

  const auto = config.input_mode !== 'push_to_talk';
  const localParticipant = session.room?.localParticipant;
  useEffect(() => {
    if (!connected || !localParticipant) return;
    localParticipant.setMicrophoneEnabled(auto);
  }, [auto, connected, localParticipant]);

  const rpc = async (method: string) => {
    const room = session.room;
    const id = agentIdentity(room);
    if (!room || !id) return;
    try {
      await room.localParticipant.performRpc({ destinationIdentity: id, method, payload: '' });
    } catch (e) {
      console.error(`${method} failed`, e);
    }
  };

  const query = lastUserText(items);
  const orbState = !connected ? 'idle' : agentState || 'listening';
  const stateLabel = connected ? agentState || 'ready' : 'offline';

  const dock = connected ? (auto ? 'auto' : 'ptt') : 'off';

  return (
    <ha-card data-dock={dock}>
      <Header
        orbState={orbState}
        title={config.title || 'Home Voice'}
        connected={connected}
        stateLabel={stateLabel}
        onEnd={() => session.end?.()}
      />
      <DeviceTiles agentAreas={agentAreas} toolCalls={toolCalls} query={query} />
      <Conversation items={items} />
      <Dock
        connected={connected}
        mode={auto ? 'auto' : 'ptt'}
        micOn={mic.enabled}
        startLabel={items.length ? 'New conversation' : 'Start talking'}
        onStart={() => {
          setEpoch((e) => e + 1);
          session.start?.();
        }}
        onSend={async (text) => {
          addTyped(text);
          try {
            await send(text);
          } catch (e) {
            console.error('send failed', e);
          }
        }}
        onMicToggle={() => mic.toggle()}
        onPttStart={async () => {
          await localParticipant?.setMicrophoneEnabled(true);
          rpc('start_turn');
        }}
        onPttEnd={async () => {
          await rpc('end_turn');
          await localParticipant?.setMicrophoneEnabled(false);
        }}
      />
    </ha-card>
  );
}
