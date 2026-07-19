import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantKind } from 'livekit-client';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useChat,
  useSession,
  useSessionContext,
} from '@livekit/components-react';
import { Conversation } from './components/Conversation';
import { DeviceTiles } from './components/DeviceTiles';
import { Dock } from './components/Dock';
import { Header } from './components/Header';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { type ConvItem, useConversation } from './lib/conversation';
import { useSessionState } from './lib/session-state';
import { useToolFeed } from './lib/tool-feed';
import { loadTurnMode, saveTurnMode, type TurnMode } from './lib/turn-mode';

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

/** Session + agent state → the header's orb animation and status label. */
const AGENT_PHASES: Record<string, { orb: string; label: string }> = {
  listening: { orb: 'listening', label: 'Listening' },
  thinking: { orb: 'thinking', label: 'Thinking' },
  speaking: { orb: 'speaking', label: 'Speaking' },
  idle: { orb: 'listening', label: 'Connected' },
  initializing: { orb: 'connecting', label: 'Connecting' },
  'pre-connect-buffering': { orb: 'connecting', label: 'Connecting' },
  connecting: { orb: 'connecting', label: 'Connecting' },
  disconnected: { orb: 'connecting', label: 'Connecting' },
  failed: { orb: 'idle', label: 'Offline' },
};

function agentPhase(connected: boolean, connecting: boolean, agentState: string | undefined) {
  if (!connected) {
    return connecting ? { orb: 'connecting', label: 'Connecting' } : { orb: 'idle', label: 'Offline' };
  }
  return AGENT_PHASES[agentState ?? ''] ?? { orb: 'listening', label: 'Connected' };
}

function CardShell() {
  const hass = useHass();
  const config = useCardConfig();
  const session = useSessionContext();
  const agent = useAgent();
  const agentState = agent.state;
  const { sttEnabled, audioOutput } = useSessionState();
  const { toolCalls, agentAreas } = useToolFeed();
  const [epoch, setEpoch] = useState(0);

  // Refs so effects/handlers always see the live session + hass without re-subscribing.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const hassRef = useRef(hass);
  hassRef.current = hass;

  const connected = session.isConnected;
  const localIdentity = session.room?.localParticipant?.identity;
  const { items, addTyped } = useConversation(localIdentity, toolCalls, epoch);
  const { send } = useChat();

  // --- turn mode (auto vs manual), persisted across reconnects ---
  const [mode, setMode] = useState<TurnMode>(() => loadTurnMode(config));
  const [turnActive, setTurnActive] = useState(false); // manual: a turn is open (recording)
  const [autoPaused, setAutoPaused] = useState(false); // auto: input temporarily disabled
  const didAutoStart = useRef(false); // manual: auto-open the first turn once per mount

  const setMic = useCallback(
    (on: boolean) => sessionRef.current.room?.localParticipant?.setMicrophoneEnabled(on),
    [],
  );

  const rpc = useCallback(async (method: string, payload = '') => {
    const room = sessionRef.current.room;
    const id = agentIdentity(room);
    if (!room || !id) return;
    try {
      await room.localParticipant.performRpc({ destinationIdentity: id, method, payload });
    } catch (e) {
      console.error(`${method} failed`, e);
    }
  }, []);

  const changeMode = useCallback((next: TurnMode) => {
    setMode((prev) => {
      if (prev !== next) saveTurnMode(next);
      return next;
    });
  }, []);

  // Card-configured defaults (optional). Defaults keep an embedded card zero-cost: no
  // spoken replies and dormant (STT off) until the user opens a turn.
  const startOnConnect = config.start_on_connect === true;
  const audioOutputConfig = config.audio_output === true;

  // Spoken replies (TTS) on/off. The agent owns the truth and broadcasts it, so the
  // toggle just reflects `audioOutput` and asks the agent to flip.
  const toggleAudioOutput = useCallback(() => {
    rpc('set_audio_output', audioOutput ? 'off' : 'on');
  }, [rpc, audioOutput]);

  // Open the mic + turn on the agent. Shared by manual "start turn" and auto "resume".
  const openTurn = useCallback(async () => {
    await setMic(true);
    await rpc('start_turn');
  }, [rpc, setMic]);

  // --- manual turn control ---
  const onTurnStart = useCallback(async () => {
    await openTurn();
    setTurnActive(true);
  }, [openTurn]);

  const onTurnEnd = useCallback(async () => {
    await rpc('end_turn'); // commit — the agent replies
    await setMic(false);
    setTurnActive(false);
  }, [rpc, setMic]);

  const onTurnCancel = useCallback(async () => {
    await rpc('cancel_turn'); // discard
    await setMic(false);
    setTurnActive(false);
  }, [rpc, setMic]);

  // --- auto mode: pause / resume input via the same RPCs, so the agent actually stops
  // listening rather than just muting the client mic ---
  const onPause = useCallback(async () => {
    await rpc('cancel_turn');
    await setMic(false);
    setAutoPaused(true);
  }, [rpc, setMic]);

  const onResume = useCallback(async () => {
    await openTurn();
    setAutoPaused(false);
  }, [openTurn]);

  // Baseline per mode, applied immediately on connect and whenever the mode flips: auto
  // keeps the mic live (hands-free), manual mutes it until a turn is opened.
  useEffect(() => {
    if (!connected) return;
    setTurnActive(false);
    setAutoPaused(false);
    setMic(mode === 'auto');
  }, [connected, mode, setMic]);

  // Once the agent is ready (its state reached listening/…, so the turn RPCs are
  // registered): assert the mode and the configured audio-output default. In manual,
  // only auto-open the first turn when start_on_connect is set — otherwise the card stays
  // dormant (no STT) until the user taps to talk.
  const agentReady = agent.isConnected;
  useEffect(() => {
    if (!connected || !agentReady) return;
    let cancelled = false;
    (async () => {
      await rpc('set_turn_mode', mode);
      await rpc('set_audio_output', audioOutputConfig ? 'on' : 'off');
      if (cancelled) return;
      if (mode === 'manual' && startOnConnect && !didAutoStart.current) {
        didAutoStart.current = true;
        await onTurnStart();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, agentReady, mode, startOnConnect, audioOutputConfig, rpc, onTurnStart]);

  // --- auto-connect while the dashboard tab is open ---
  const autoConnect = config.auto_connect !== false;
  const [connecting, setConnecting] = useState(false);

  const startSession = useCallback(() => {
    setConnecting(true);
    setEpoch((e) => e + 1);
    sessionRef.current.start?.();
  }, []);

  useEffect(() => {
    if (connected) setConnecting(false);
  }, [connected]);

  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!autoConnect || autoTried || !hass || connected || document.hidden) return;
    setAutoTried(true);
    startSession();
  }, [autoConnect, autoTried, hass, connected, startSession]);

  useEffect(() => {
    if (!autoConnect) return;
    const onVisibility = () => {
      if (document.hidden) sessionRef.current.end?.();
      else if (!sessionRef.current.isConnected && hassRef.current) startSession();
    };
    const onPageHide = () => sessionRef.current.end?.();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      sessionRef.current.end?.(); // card removed (tab left)
    };
  }, [autoConnect, startSession]);

  const query = lastUserText(items);
  const phase = agentPhase(connected, connecting, agentState);
  // The agent's own "listening" phase just means idle/ready — misleading when STT is off
  // (it isn't hearing anything). Only the idle phase is remapped to "Sleeping" when STT is
  // off; Thinking/Speaking always show so a text reply gives feedback, and "Listening"
  // only ever appears when STT is genuinely live.
  const dozing = connected && !sttEnabled && phase.orb === 'listening';
  const orbState = dozing ? 'dozing' : phase.orb;
  const stateLabel = dozing ? 'Sleeping' : phase.label;

  return (
    <ha-card data-dock={connected ? mode : 'off'}>
      <Header
        orbState={orbState}
        title={config.title || 'Home Voice'}
        connected={connected}
        mode={mode}
        onModeChange={changeMode}
        stateLabel={stateLabel}
        audioOutput={audioOutput}
        onToggleAudioOutput={toggleAudioOutput}
        onEnd={() => session.end?.()}
      />
      <DeviceTiles agentAreas={agentAreas} toolCalls={toolCalls} query={query} />
      <Conversation items={items} />
      <Dock
        connected={connected}
        mode={mode}
        turnActive={turnActive}
        autoPaused={autoPaused}
        startLabel={connecting ? 'Connecting…' : items.length ? 'New conversation' : 'Start talking'}
        onStart={startSession}
        onSend={async (text) => {
          addTyped(text);
          try {
            await send(text);
          } catch (e) {
            console.error('send failed', e);
          }
        }}
        onTurnStart={onTurnStart}
        onTurnEnd={onTurnEnd}
        onTurnCancel={onTurnCancel}
        onPause={onPause}
        onResume={onResume}
      />
    </ha-card>
  );
}
