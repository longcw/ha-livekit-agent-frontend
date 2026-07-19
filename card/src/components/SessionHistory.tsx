import { useState } from 'react';
import { clearHistory, loadHistory, type StoredSession } from '../lib/session-store';
import { Conversation } from './Conversation';

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function summarize(s: StoredSession): string {
  const firstUser = s.items.find((i) => i.kind === 'message' && i.role === 'user');
  if (firstUser && firstUser.kind === 'message') return firstUser.text;
  const firstMsg = s.items.find((i) => i.kind === 'message');
  if (firstMsg && firstMsg.kind === 'message') return firstMsg.text;
  return 'No transcript';
}

function counts(s: StoredSession): string {
  const msgs = s.items.filter((i) => i.kind === 'message').length;
  const acts = s.items.filter((i) => i.kind === 'action').length;
  return `${msgs} message${msgs === 1 ? '' : 's'} · ${acts} action${acts === 1 ? '' : 's'}`;
}

/** Browse past voice sessions and open one to read its full conversation. */
export function SessionHistory({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadHistory());
  const [selected, setSelected] = useState<StoredSession | null>(null);

  if (selected) {
    return (
      <div className="lk-history">
        <div className="lk-history-head">
          <button className="lk-round lk-round--ghost" title="Back" onClick={() => setSelected(null)}>
            <ha-icon icon="mdi:arrow-left" />
          </button>
          <span className="lk-h2">{fmtTime(selected.startedAt)}</span>
        </div>
        <Conversation items={selected.items} autoscroll={false} />
      </div>
    );
  }

  return (
    <div className="lk-history">
      <div className="lk-history-head">
        <span className="lk-h2">Past sessions</span>
        <div className="lk-spacer" />
        {sessions.length > 0 && (
          <button
            className="lk-round lk-round--ghost"
            title="Clear all"
            onClick={() => {
              clearHistory();
              setSessions([]);
            }}
          >
            <ha-icon icon="mdi:delete-outline" />
          </button>
        )}
        <button className="lk-round lk-round--ghost" title="Close" onClick={onClose}>
          <ha-icon icon="mdi:close" />
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="lk-empty">
          <ha-icon icon="mdi:history" />
          <span>No past sessions yet.</span>
        </div>
      ) : (
        <div className="lk-session-list">
          {sessions.map((s) => (
            <button className="lk-session" key={s.id} onClick={() => setSelected(s)}>
              <span className="lk-session-summary">{summarize(s)}</span>
              <span className="lk-session-meta">
                <span>{fmtTime(s.startedAt)}</span>
                <span>{counts(s)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
