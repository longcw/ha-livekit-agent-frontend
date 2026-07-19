import { useEffect, useRef } from 'react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';

/**
 * Live transcript. `useSessionMessages` returns SDK-managed messages keyed by id, so
 * interim segments are overwritten in place and only final text remains — no duplicates.
 */
export function Transcript() {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
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
