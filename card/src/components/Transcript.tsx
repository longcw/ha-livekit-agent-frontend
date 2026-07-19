import { useEffect, useRef } from 'react';
import type { TranscriptLine } from '../lib/sessions';

/**
 * Transcript renderer for both live and stored sessions. Lines are keyed by id, so live
 * interim segments are overwritten in place and only final text remains (no duplicates).
 */
export function Transcript({ lines }: { lines: TranscriptLine[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  if (!lines?.length) {
    return <div className="lk-hint">Ask about your home — e.g. “turn on the study light”.</div>;
  }

  return (
    <div className="lk-transcript" ref={ref}>
      {lines.map((l) => (
        <div key={l.id} className="lk-line" data-role={l.user ? 'user' : 'agent'}>
          <span className="lk-who">{l.user ? 'You' : 'AI'}</span>
          {l.text}
        </div>
      ))}
    </div>
  );
}
