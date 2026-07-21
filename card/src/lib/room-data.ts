import { useEffect } from 'react';
import { type Room, RoomEvent } from 'livekit-client';

/**
 * Subscribe to JSON messages the agent publishes on a single data-channel `topic`.
 * Decodes each matching packet and hands the parsed value to `onMessage`; malformed
 * payloads and other topics are ignored. `onMessage` must be stable (wrap in
 * useCallback) — it's an effect dependency, so an unstable reference re-subscribes.
 */
export function useRoomDataTopic(
  room: Room | undefined,
  topic: string,
  onMessage: (data: any) => void,
): void {
  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();

    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, msgTopic?: string) => {
      if (msgTopic !== topic) return;
      let data: unknown;
      try {
        data = JSON.parse(decoder.decode(payload));
      } catch {
        return; // ignore malformed payloads
      }
      onMessage(data);
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, topic, onMessage]);
}
