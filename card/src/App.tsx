import { useEffect, useMemo } from 'react';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
} from '@livekit/components-react';
import { ChatInput } from './components/ChatInput';
import { Controls } from './components/Controls';
import { DeviceTiles } from './components/DeviceTiles';
import { ToolCards } from './components/ToolCards';
import { Transcript } from './components/Transcript';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { useToolFeed } from './lib/tool-feed';

const PULSE_STATES = new Set(['listening', 'thinking', 'speaking']);

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

function CardShell() {
  const hass = useHass();
  const config = useCardConfig();
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const { toolCalls, agentAreas } = useToolFeed();

  const auto = config.input_mode !== 'push_to_talk';
  const localParticipant = session.room?.localParticipant;

  // Mic policy on connect: live in auto mode; muted in push-to-talk (the PTT button owns it).
  useEffect(() => {
    if (!session.isConnected || !localParticipant) return;
    localParticipant.setMicrophoneEnabled(auto);
  }, [auto, session.isConnected, localParticipant]);

  const connected = session.isConnected;
  const pulse = PULSE_STATES.has(agentState ?? '');
  const stateLabel = connected ? agentState || 'ready' : 'offline';

  return (
    <ha-card>
      <div className="lk-header">
        <span className="lk-title">{config.title || 'Voice Assistant'}</span>
        <span className="lk-state">
          <span className="lk-dot" data-active={connected ? '1' : '0'} data-pulse={pulse ? '1' : '0'} />
          {stateLabel}
        </span>
      </div>

      {/* Live, controllable device tiles — visible whether or not voice is connected. */}
      <DeviceTiles agentAreas={agentAreas} />

      {connected ? (
        <>
          <Transcript />
          <ToolCards toolCalls={toolCalls} />
          <ChatInput />
          <Controls />
        </>
      ) : (
        <button className="lk-btn" onClick={() => session.start?.()} disabled={!hass}>
          Start voice
        </button>
      )}
    </ha-card>
  );
}
