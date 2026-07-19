import { useEffect, useRef } from 'react';
import type { ReceivedMessage } from '@livekit/components-react';

/**
 * Live transcript. Messages are SDK-managed (keyed by id), so interim segments are
 * overwritten in place and only final text remains — no duplicates.
 */
export function Transcript({ messages }: { messages: ReceivedMessage[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!messages?.length) {
    return <div className="lk-hint">Ask about your home — e.g. “turn on the study light”.</div>;
  }

  return (
    <div className="lk-transcript" ref={ref}>
      {messages.map((m) => {
        const user = m.from?.isLocal;
        return (
          <div key={m.id} className="lk-line" data-role={user ? 'user' : 'agent'}>
            <span className="lk-who">{user ? 'You' : 'AI'}</span>
            {m.message}
          </div>
        );
      })}
    </div>
  );
}
