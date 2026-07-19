import { useRef, useState } from 'react';
import { ParticipantKind, Track } from 'livekit-client';
import { useChat, useSessionContext, useTrackToggle } from '@livekit/components-react';
import { useCardConfig } from '../hass/context';

function agentIdentity(room: any): string | null {
  if (!room) return null;
  for (const p of room.remoteParticipants.values()) {
    if (p.kind === ParticipantKind.AGENT || p.isAgent) return p.identity;
  }
  return null;
}

/** Text input + voice control (mic toggle or push-to-talk) + end call. */
export function Composer({ onTyped }: { onTyped: (text: string) => void }) {
  const config = useCardConfig();
  const session = useSessionContext();
  const { send } = useChat();
  const pushToTalk = config.input_mode === 'push_to_talk';
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const canSend = !sending && text.trim().length > 0;

  const submit = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    onTyped(message);
    setText('');
    try {
      await send(message);
    } catch (e) {
      console.error('chat send failed', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lk-composer">
      <div className="lk-input-row">
        <textarea
          className="lk-input"
          value={text}
          rows={1}
          placeholder={pushToTalk ? 'Message, or hold the mic…' : 'Message…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {canSend ? (
          <button className="lk-round lk-round--accent" title="Send" onClick={submit}>
            <ha-icon icon="mdi:arrow-up" />
          </button>
        ) : pushToTalk ? (
          <PushToTalk />
        ) : (
          <MicToggle />
        )}
      </div>
      <button className="lk-round lk-round--ghost lk-end" title="End" onClick={() => session.end?.()}>
        <ha-icon icon="mdi:close" />
      </button>
    </div>
  );
}

function MicToggle() {
  const { enabled, toggle } = useTrackToggle({ source: Track.Source.Microphone });
  return (
    <button
      className="lk-round"
      data-on={enabled ? '1' : '0'}
      title={enabled ? 'Mute microphone' : 'Unmute microphone'}
      onClick={() => toggle()}
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
      className="lk-round lk-ptt"
      title="Hold to talk"
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      <ha-icon icon="mdi:microphone" />
    </button>
  );
}
