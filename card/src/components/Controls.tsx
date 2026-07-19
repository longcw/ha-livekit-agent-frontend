import { useRef } from 'react';
import { ParticipantKind, Track } from 'livekit-client';
import { useSessionContext, useTrackToggle } from '@livekit/components-react';
import { useCardConfig } from '../hass/context';

function agentIdentity(room: any): string | null {
  if (!room) return null;
  for (const p of room.remoteParticipants.values()) {
    if (p.kind === ParticipantKind.AGENT || p.isAgent) return p.identity;
  }
  return null;
}

export function Controls() {
  const config = useCardConfig();
  const session = useSessionContext();
  const pushToTalk = config.input_mode === 'push_to_talk';

  return (
    <div className="lk-controls">
      {pushToTalk ? <PushToTalk /> : <MicToggle />}
      <button className="lk-icon-btn lk-danger" title="End" onClick={() => session.end?.()}>
        <ha-icon icon="mdi:phone-hangup" />
      </button>
    </div>
  );
}

function MicToggle() {
  const { enabled, toggle } = useTrackToggle({ source: Track.Source.Microphone });
  return (
    <button
      className="lk-icon-btn"
      data-on={enabled ? '1' : '0'}
      title={enabled ? 'Mute microphone' : 'Unmute microphone'}
      onClick={() => toggle()}
      style={{ flex: 1, borderRadius: 999 }}
    >
      <ha-icon icon={enabled ? 'mdi:microphone' : 'mdi:microphone-off'} />
    </button>
  );
}

function PushToTalk() {
  const session = useSessionContext();
  const holding = useRef(false);

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

  const start = async (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (holding.current) return;
    holding.current = true;
    e.currentTarget.dataset.holding = '1';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    await session.room?.localParticipant.setMicrophoneEnabled(true);
    rpc('start_turn');
  };

  const end = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!holding.current) return;
    holding.current = false;
    e.currentTarget.dataset.holding = '0';
    await rpc('end_turn');
    await session.room?.localParticipant.setMicrophoneEnabled(false);
  };

  return (
    <button
      className="lk-btn lk-talk"
      style={{ flex: 1 }}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      Hold to talk
    </button>
  );
}
