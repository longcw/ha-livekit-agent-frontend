import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantKind, type RemoteParticipant, Room, RoomEvent, Track } from 'livekit-client';
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
import { ScheduledTasks } from './components/ScheduledTasks';
import { SchedulesTab } from './components/SchedulesTab';
import { TaskEditor } from './components/TaskEditor';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { type ConvItem, useConversation } from './lib/conversation';
import { useSessionState } from './lib/session-state';
import type { Task } from './lib/tasks';
import { useTasks } from './lib/tasks-api';
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
  // Own the Room so we can set stopMicTrackOnMute: muting the mic (ending/cancelling a turn,
  // or pausing in auto mode) then stops the underlying MediaStreamTrack, releasing the device
  // so the browser/OS mic-recording indicator turns off between turns. It's re-acquired when
  // the next turn opens (setMicrophoneEnabled(true)).
  const room = useMemo(() => new Room({ publishDefaults: { stopMicTrackOnMute: true } }), []);
  const session = useSession(tokenSource, { room });
  return (
    <SessionProvider session={session}>
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

const isAgentParticipant = (p: RemoteParticipant): boolean =>
  p.kind === ParticipantKind.AGENT || p.isAgent;

function agentIdentity(room: Room | undefined): string | null {
  if (!room) return null;
  for (const p of room.remoteParticipants.values()) {
    if (isAgentParticipant(p)) return p.identity;
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
  if (connecting) return { orb: 'connecting', label: 'Connecting' };
  // Not connected is a normal, ready state now (the card connects lazily on the first
  // send/speak) — not an error. A calm idle orb, distinct from the active connected states.
  if (!connected) return { orb: 'idle', label: 'Ready' };
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
  const tasksApi = useTasks(toolCalls);
  const [epoch, setEpoch] = useState(0);
  const [tab, setTab] = useState<'chat' | 'schedules'>('chat');
  const [editing, setEditing] = useState<Task | null>(null);

  // Ref so effects/handlers always see the live session without re-subscribing.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const connected = session.isConnected;
  const localIdentity = session.room?.localParticipant?.identity;
  const { items, addTyped } = useConversation(localIdentity, toolCalls, epoch);
  const { send } = useChat();

  // Card-configured defaults. auto_connect defaults OFF: opening the card is static (chat UI,
  // no room connection) and it connects lazily on the first send/speak — so merely opening or
  // switching to the dashboard never touches the audio session or the user's music.
  const autoConnect = config.auto_connect === true;
  const audioOutputConfig = config.audio_output === true;
  const startOnConnect = config.start_on_connect === true;

  // --- turn mode (auto vs manual), persisted ---
  const [mode, setMode] = useState<TurnMode>(() => loadTurnMode(config));
  const [turnActive, setTurnActive] = useState(false); // manual: a turn is open (recording)
  // auto: mic NOT live (either never started this session, or paused). Starts true — even in
  // auto/continuous mode the mic only goes live once the user taps to talk, so a connected-for-
  // text card never captures audio.
  const [autoPaused, setAutoPaused] = useState(() => loadTurnMode(config) === 'auto');
  const [micStarting, setMicStarting] = useState(false); // mic acquisition in flight (cold-start)
  const [connecting, setConnecting] = useState(false);
  const didAutoStart = useRef(false); // kiosk: auto-open the first turn once per mount

  const setMic = useCallback(
    (on: boolean) => sessionRef.current.room?.localParticipant?.setMicrophoneEnabled(on),
    [],
  );

  // Fully release the mic (unpublish + stop the device), not just mute. Muting keeps the audio
  // transceiver on the connection; on iOS a lingering audio transceiver flips the shared session
  // into playAndRecord and interrupts background music. Unpublishing removes it, so no audio
  // session is held between turns. The next turn re-publishes fresh.
  const releaseMic = useCallback(async () => {
    const lp = sessionRef.current.room?.localParticipant;
    const pub = lp?.getTrackPublication(Track.Source.Microphone);
    if (lp && pub?.track) {
      try {
        await lp.unpublishTrack(pub.track, true);
      } catch (e) {
        console.error('releaseMic failed', e);
      }
    }
  }, []);

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

  const toggleAudioOutput = useCallback(() => {
    rpc('set_audio_output', audioOutput ? 'off' : 'on');
  }, [rpc, audioOutput]);

  // Connect to the room WITHOUT acquiring any audio (mic off, autoSubscribe off). Resolves once
  // connected (and the agent has joined). Called lazily on the first send/speak, or on open when
  // auto_connect is set. A no-op if already connected.
  const connectSession = useCallback(async () => {
    const s = sessionRef.current;
    if (s.isConnected) return;
    setConnecting(true);
    setEpoch((e) => e + 1); // a fresh connection starts a fresh conversation
    try {
      await s.start?.({
        tracks: { microphone: { enabled: false } },
        roomConnectOptions: { autoSubscribe: false },
      });
    } catch (e) {
      console.error('connect failed', e);
      setConnecting(false);
    }
  }, []);
  useEffect(() => {
    if (connected) setConnecting(false);
  }, [connected]);

  // Open the mic + start a turn — connecting first if needed. The FIRST mic acquisition on iOS
  // is slow (getUserMedia + the AVAudioSession switch, which is also what interrupts other apps'
  // audio, so it can't be pre-warmed). Callers flag `micStarting` so the tap shows "Starting…"
  // instead of feeling stuck, and so the user doesn't talk into a not-yet-live mic.
  const openTurn = useCallback(async () => {
    await connectSession();
    await setMic(true);
    await rpc('start_turn');
  }, [connectSession, setMic, rpc]);

  // Open the mic + start a turn, flagging `micStarting` for the cold-start UI and rolling back
  // via `onFail` if the mic never comes up. Shared by push-to-talk and auto-mode resume.
  const beginTurn = useCallback(
    (onFail: () => void) => {
      setMicStarting(true);
      openTurn()
        .catch((e) => {
          console.error('open turn failed', e);
          onFail();
        })
        .finally(() => setMicStarting(false));
    },
    [openTurn],
  );

  // Close the mic side of a turn: clear `micStarting`, tell the agent (commit or discard), and
  // release the mic device. Shared by End / Cancel / Pause.
  const stopTurn = useCallback(
    async (method: 'end_turn' | 'cancel_turn') => {
      setMicStarting(false);
      await rpc(method);
      await releaseMic();
    },
    [rpc, releaseMic],
  );

  // --- manual turn control ---
  const onTurnStart = useCallback(() => {
    setTurnActive(true); // show the listening bar immediately
    beginTurn(() => setTurnActive(false));
  }, [beginTurn]);

  const onTurnEnd = useCallback(async () => {
    setTurnActive(false);
    await stopTurn('end_turn'); // commit — the agent replies
  }, [stopTurn]);

  const onTurnCancel = useCallback(async () => {
    setTurnActive(false);
    await stopTurn('cancel_turn'); // discard
  }, [stopTurn]);

  // --- auto mode: start / pause continuous listening. Same RPCs so the agent actually stops
  // listening rather than just muting the client mic. ---
  const onPause = useCallback(async () => {
    setAutoPaused(true);
    await stopTurn('cancel_turn');
  }, [stopTurn]);

  const onResume = useCallback(() => {
    setAutoPaused(false); // go live immediately
    beginTurn(() => setAutoPaused(true));
  }, [beginTurn]);

  // Send a text message. Connects first if needed — but NEVER acquires audio (no mic, and
  // autoSubscribe/audio-output stay off), so texting leaves background music playing.
  const onSend = useCallback(
    async (text: string) => {
      await connectSession();
      addTyped(text);
      try {
        await send(text);
      } catch (e) {
        console.error('send failed', e);
      }
    },
    [connectSession, addTyped, send],
  );

  // Idle baseline whenever the card is NOT connected (static/offline). Deliberately does NOT
  // reset on connect — a connect is usually triggered by a speak tap, whose turn must survive.
  useEffect(() => {
    if (connected) return;
    setTurnActive(false);
    setMicStarting(false);
    setAutoPaused(mode === 'auto');
  }, [connected, mode]);

  // Mode flip: reset to the new mode's resting state, release any live mic, and tell the agent.
  // The mic is never enabled here — only an explicit speak/resume opens it — so this can't start
  // recording on its own.
  useEffect(() => {
    setTurnActive(false);
    setMicStarting(false);
    setAutoPaused(mode === 'auto');
    if (sessionRef.current.isConnected) {
      void releaseMic();
      void rpc('set_turn_mode', mode);
    }
  }, [mode, releaseMic, rpc]);

  // Once connected + agent ready: assert the mode and audio-output default. Auto-open a turn
  // only for a kiosk that BOTH auto-connects and opts into start_on_connect — never for a
  // lazily text-connected card, which must stay audio-free.
  const agentReady = agent.isConnected;
  useEffect(() => {
    if (!connected || !agentReady) return;
    let cancelled = false;
    (async () => {
      await rpc('set_turn_mode', mode);
      await rpc('set_audio_output', audioOutputConfig ? 'on' : 'off');
      if (cancelled) return;
      if (autoConnect && startOnConnect && !didAutoStart.current) {
        didAutoStart.current = true;
        if (mode === 'auto') onResume();
        else onTurnStart();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, agentReady, mode, autoConnect, startOnConnect, audioOutputConfig, rpc, onTurnStart, onResume]);

  // Subscribe to the agent's audio track only while spoken replies are on (we connect with
  // autoSubscribe:false). With no subscribed remote audio track there's nothing for iOS to
  // activate, so a text-only card never grabs the playback session. Turning audio output on
  // subscribes (the header toggle tap is a user gesture, unlocking iOS autoplay); off releases.
  useEffect(() => {
    const room = sessionRef.current.room;
    if (!connected || !room) return;

    const syncAgentAudio = () => {
      for (const p of room.remoteParticipants.values()) {
        if (!isAgentParticipant(p)) continue;
        for (const pub of p.audioTrackPublications.values()) pub.setSubscribed(audioOutput);
      }
    };

    syncAgentAudio();
    if (!audioOutput) return; // off: unsubscribed above, nothing to keep in sync

    room.on(RoomEvent.TrackPublished, syncAgentAudio);
    room.on(RoomEvent.ParticipantConnected, syncAgentAudio);
    return () => {
      room.off(RoomEvent.TrackPublished, syncAgentAudio);
      room.off(RoomEvent.ParticipantConnected, syncAgentAudio);
    };
  }, [connected, audioOutput]);

  // --- connection lifecycle ---
  // Connect on open only when auto_connect is set; otherwise the card stays static until the
  // first send/speak. The connection is media-free (no mic/subscribe until a turn), so it's
  // cheap to keep alive: we deliberately do NOT tear it down on background / tab-visibility
  // changes, on switching between our Chat/Schedules tabs, or on lovelace-view switches —
  // returning shows the same state, with no refresh. We only release it when the page is
  // actually unloaded (pagehide) or the card is removed (unmount).
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!autoConnect || autoTried || !hass || connected || document.hidden) return;
    setAutoTried(true);
    void connectSession();
  }, [autoConnect, autoTried, hass, connected, connectSession]);

  useEffect(() => {
    const onPageHide = () => sessionRef.current.end?.();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      sessionRef.current.end?.(); // card removed (view left / dashboard closed)
    };
  }, []);

  const query = lastUserText(items);
  const phase = agentPhase(connected, connecting, agentState);
  // The agent's own "listening" phase just means idle/ready — misleading when STT is off
  // (it isn't hearing anything). Only the idle phase is remapped to "Sleeping" when STT is
  // off; Thinking/Speaking always show so a text reply gives feedback, and "Listening"
  // only ever appears when STT is genuinely live.
  const dozing = connected && !sttEnabled && phase.orb === 'listening';
  const orbState = dozing ? 'dozing' : phase.orb;
  const stateLabel = dozing ? 'Sleeping' : phase.label;

  // The card is content-sized for chat (compact when idle). The Schedules list and the editor
  // sheet need a stable, roomy viewport instead — give the card a definite height for those.
  const tall = tab === 'schedules' || editing !== null;

  return (
    <ha-card data-dock={mode} data-tall={tall ? '1' : '0'}>
      {/* Only attach/play the agent's audio once spoken replies are on. Mounting the renderer
          plays remote audio through an <audio> element, which on iOS flips the shared session to
          playback — so a text-only card (audioOutput defaults off) must never mount it. */}
      {audioOutput && <RoomAudioRenderer />}
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
      <div className="lk-tabs" role="tablist">
        <button
          className="lk-tab"
          data-on={tab === 'chat' ? '1' : '0'}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          className="lk-tab"
          data-on={tab === 'schedules' ? '1' : '0'}
          onClick={() => setTab('schedules')}
        >
          Schedules
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          <DeviceTiles agentAreas={agentAreas} toolCalls={toolCalls} query={query} />
          <ScheduledTasks
            tasks={tasksApi.tasks}
            freshId={tasksApi.freshId}
            onOpen={setEditing}
            onSeeAll={() => setTab('schedules')}
          />
          {/* While disconnected (static/idle) show the initial empty view — don't leave a stale,
              partial transcript (typed messages linger in local state after the room-sourced
              items clear). The conversation belongs to a live session. */}
          <Conversation items={connected ? items : []} />
          <Dock
            connected={connected}
            connecting={connecting}
            mode={mode}
            turnActive={turnActive}
            autoPaused={autoPaused}
            micStarting={micStarting}
            onSend={onSend}
            onTurnStart={onTurnStart}
            onTurnEnd={onTurnEnd}
            onTurnCancel={onTurnCancel}
            onPause={onPause}
            onResume={onResume}
          />
        </>
      ) : (
        <SchedulesTab api={tasksApi} onOpen={setEditing} />
      )}

      {editing && (
        <TaskEditor
          task={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => tasksApi.save(editing.id, patch)}
          onDelete={() => tasksApi.remove(editing.id)}
        />
      )}
    </ha-card>
  );
}
