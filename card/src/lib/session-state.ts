import { useEffect, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useSessionContext } from '@livekit/components-react';

// Must match SESSION_STATE_TOPIC in agent/agent.py.
export const SESSION_STATE_TOPIC = 'ha.speech_state';

export interface SessionState {
  /**
   * Whether the agent's speech-to-text is currently live. STT follows the mic: the agent
   * boots with it off and tears it down again a while after the mic is gated, bringing it
   * back when a turn opens (push-to-talk, or the mic going live in auto mode). Text chat
   * never enables STT.
   */
  sttEnabled: boolean;
  /** Whether the agent speaks replies aloud (TTS). When off, replies are text-only. */
  audioOutput: boolean;
}

/**
 * Mirrors the agent's session state, which it broadcasts on SESSION_STATE_TOPIC whenever
 * STT or audio output changes (and on connect). Defaults match the agent's dormant boot
 * (STT off, no TTS) so the UI doesn't flash a misleading "listening" before the first
 * message arrives.
 */
export function useSessionState(): SessionState {
  const session = useSessionContext();
  const room = session.room;
  const [state, setState] = useState<SessionState>({ sttEnabled: false, audioOutput: false });

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();

    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== SESSION_STATE_TOPIC) return;
      try {
        const data = JSON.parse(decoder.decode(payload));
        setState((prev) => ({
          sttEnabled: typeof data.stt_enabled === 'boolean' ? data.stt_enabled : prev.sttEnabled,
          audioOutput:
            typeof data.audio_output === 'boolean' ? data.audio_output : prev.audioOutput,
        }));
      } catch {
        // ignore malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // Reset to the dormant baseline on disconnect; the agent re-asserts on connect.
  useEffect(() => {
    if (!session.isConnected) setState({ sttEnabled: false, audioOutput: false });
  }, [session.isConnected]);

  return state;
}
