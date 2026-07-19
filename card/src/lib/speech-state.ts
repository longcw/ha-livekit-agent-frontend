import { useEffect, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useSessionContext } from '@livekit/components-react';

// Must match SPEECH_STATE_TOPIC in agent/agent.py.
export const SPEECH_STATE_TOPIC = 'ha.speech_state';

/**
 * Whether the agent's speech-to-text pipeline is currently live.
 *
 * To save cost, the agent tears STT down after the user has been away for a while and
 * brings it back on the next turn (a push-to-talk press in manual mode, or the VAD
 * hearing speech in auto mode). It broadcasts that state on SPEECH_STATE_TOPIC; the UI
 * uses it to show a "sleeping" indicator. Assumed active until the agent says otherwise.
 */
export function useSpeechState(): boolean {
  const session = useSessionContext();
  const room = session.room;
  const [sttActive, setSttActive] = useState(true);

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();

    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== SPEECH_STATE_TOPIC) return;
      try {
        const data = JSON.parse(decoder.decode(payload));
        if (typeof data.stt_active === 'boolean') setSttActive(data.stt_active);
      } catch {
        // ignore malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // A fresh connection starts optimistic; the agent re-asserts the real state on connect.
  useEffect(() => {
    if (!session.isConnected) setSttActive(true);
  }, [session.isConnected]);

  return sttActive;
}
