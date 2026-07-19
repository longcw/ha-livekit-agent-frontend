import { useEffect, useMemo, useState } from 'react';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
} from '@livekit/components-react';
import { ChatInput } from './components/ChatInput';
import { Controls } from './components/Controls';
import { DeviceTiles } from './components/DeviceTiles';
import { SessionHistory } from './components/SessionHistory';
import { ToolCards } from './components/ToolCards';
import { Transcript } from './components/Transcript';
import { HassStoreProvider, useCardConfig, useHass, useStore } from './hass/context';
import type { HassStore } from './hass/store';
import { HassTokenSource } from './hass/token-source';
import { useSessionLog } from './lib/session-log';
import { saveSession, type TranscriptLine } from './lib/sessions';
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

function lastUserText(lines: TranscriptLine[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].user) return lines[i].text;
  }
  return '';
}

function CardShell() {
  const hass = useHass();
  const config = useCardConfig();
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const { messages: liveMessages } = useSessionMessages(session);
  const live = useToolFeed();
  const [epoch, setEpoch] = useState(0);
  const log = useSessionLog(liveMessages, live.toolCalls, live.agentAreas, epoch);
  const [historyOpen, setHistoryOpen] = useState(false);

  const auto = config.input_mode !== 'push_to_talk';
  const localParticipant = session.room?.localParticipant;
  useEffect(() => {
    if (!session.isConnected || !localParticipant) return;
    localParticipant.setMicrophoneEnabled(auto);
  }, [auto, session.isConnected, localParticipant]);

  const connected = session.isConnected;
  const query = lastUserText(log.lines);
  const hasLog = log.lines.length > 0 || log.toolCalls.length > 0;

  // Start a fresh session: archive the previous one (if any), reset the log, connect.
  const handleStart = () => {
    saveSession({
      id: `s-${log.startedAt}`,
      startedAt: log.startedAt,
      endedAt: Date.now(),
      lines: log.lines,
      toolCalls: log.toolCalls,
    });
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

  const pulse = PULSE_STATES.has(agentState ?? '');
  const stateLabel = connected ? agentState || 'ready' : hasLog ? 'ended' : 'offline';

  return (
    <ha-card>
      <div className="lk-header">
        <span className="lk-title">{config.title || 'Voice Assistant'}</span>
        <div className="lk-header-right">
          <button className="lk-history-btn" title="Session history" onClick={() => setHistoryOpen(true)}>
            <ha-icon icon="mdi:history" />
          </button>
          <span className="lk-state">
            <span className="lk-dot" data-active={connected ? '1' : '0'} data-pulse={pulse ? '1' : '0'} />
            {stateLabel}
          </span>
        </div>
      </div>

      {/* Live, controllable device tiles — persist across disconnect until a new session. */}
      <DeviceTiles agentAreas={log.agentAreas} toolCalls={log.toolCalls} query={query} />

      {(connected || hasLog) && <Transcript lines={log.lines} />}
      {(connected || hasLog) && <ToolCards toolCalls={log.toolCalls} />}

      {connected ? (
        <>
          <ChatInput />
          <Controls />
        </>
      ) : (
        <div className="lk-controls">
          <button className="lk-btn" style={{ flex: 1 }} onClick={handleStart} disabled={!hass}>
            {hasLog ? 'New session' : 'Start voice'}
          </button>
        </div>
      )}
    </ha-card>
  );
}
