import { useCallback, useEffect, useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import { useRoomDataTopic } from './room-data';

// Must match SUGGESTIONS_TOPIC in agent/src/config.py.
export const SUGGESTIONS_TOPIC = 'ha.suggestions';

/**
 * One-tap quick replies the agent offers for its current question (e.g. Yes/No when
 * confirming a schedule), broadcast on SUGGESTIONS_TOPIC. They're valid for exactly one
 * user response: `clear()` is called by the composer when the user answers (sends text,
 * taps a chip) or starts a voice turn, and they reset on disconnect. A new message
 * replaces the current set.
 */
export function useSuggestions(): { suggestions: string[]; clear: () => void } {
  const session = useSessionContext();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const onMessage = useCallback((data: any) => {
    const replies = Array.isArray(data?.replies)
      ? data.replies.filter((r: unknown) => typeof r === 'string')
      : [];
    setSuggestions(replies);
  }, []);
  useRoomDataTopic(session.room, SUGGESTIONS_TOPIC, onMessage);

  const clear = useCallback(() => setSuggestions([]), []);

  useEffect(() => {
    if (!session.isConnected) setSuggestions([]);
  }, [session.isConnected]);

  return { suggestions, clear };
}
