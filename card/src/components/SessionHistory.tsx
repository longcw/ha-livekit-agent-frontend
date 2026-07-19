import { useState } from 'react';
import { clearSessions, loadSessions, type StoredSession } from '../lib/sessions';
import { ToolCards } from './ToolCards';
import { Transcript } from './Transcript';

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function summarize(s: StoredSession): string {
  const firstUser = s.lines.find((l) => l.user);
  if (firstUser?.text) return firstUser.text;
  if (s.lines[0]?.text) return s.lines[0].text;
  return `${s.toolCalls.length} action${s.toolCalls.length === 1 ? '' : 's'}`;
}

/** Browse past voice sessions (newest first) and open one to view its transcript + actions. */
export function SessionHistory({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadSessions());
  const [selected, setSelected] = useState<StoredSession | null>(null);

  if (selected) {
    return (
      <div className="lk-history">
        <div className="lk-history-head">
          <button className="lk-icon-btn lk-secondary" title="Back" onClick={() => setSelected(null)}>
            <ha-icon icon="mdi:arrow-left" />
          </button>
          <span className="lk-title">{fmtTime(selected.startedAt)}</span>
        </div>
        <Transcript lines={selected.lines} />
        <ToolCards toolCalls={selected.toolCalls} />
      </div>
    );
  }

  return (
    <div className="lk-history">
      <div className="lk-history-head">
        <span className="lk-title">Past sessions</span>
        <div className="lk-header-right">
          {sessions.length > 0 && (
            <button
              className="lk-history-btn"
              title="Clear all"
              onClick={() => {
                clearSessions();
                setSessions([]);
              }}
            >
              <ha-icon icon="mdi:delete-outline" />
            </button>
          )}
          <button className="lk-icon-btn lk-secondary" title="Close" onClick={onClose}>
            <ha-icon icon="mdi:close" />
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="lk-hint">No past sessions yet.</div>
      ) : (
        <div className="lk-session-list">
          {sessions.map((s) => (
            <button className="lk-session" key={s.id} onClick={() => setSelected(s)}>
              <span className="lk-session-time">{fmtTime(s.startedAt)}</span>
              <span className="lk-session-summary">{summarize(s)}</span>
              <span className="lk-session-meta">
                {s.lines.length} msg · {s.toolCalls.length} action{s.toolCalls.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
