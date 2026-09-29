import { useCallback, useEffect, useState } from 'react';
import type { ConvItem } from '../lib/conversation';
import type { ConversationSummary, TextChatApi } from '../lib/text-chat';
import { Conversation } from './Conversation';
import { useDockHeight } from './Dock';

function when(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

/** The person's past text conversations: open one to read it, continue it to make it the
 *  current one, or delete it. The current conversation is listed but never deleted. */
export function TextHistory({ api, onClose }: { api: TextChatApi; onClose: () => void }) {
  const { listConversations, readConversation, switchConversation, deleteConversation, busy } = api;
  const [rows, setRows] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // the one row whose delete is armed (two-tap confirm)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [open, setOpen] = useState<ConversationSummary | null>(null);
  const [items, setItems] = useState<ConvItem[] | null>(null);
  const [switching, setSwitching] = useState(false);
  const dockRef = useDockHeight();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConversations();
      setRows(data.conversations);
      setCurrent(data.current);
      setError(null);
    } catch {
      setError('Could not load conversations.');
    } finally {
      setLoading(false);
    }
  }, [listConversations]);

  useEffect(() => void load(), [load]);

  const view = async (row: ConversationSummary) => {
    setConfirmId(null);
    if (row.id === current) {
      onClose();
      return;
    }
    setOpen(row);
    setItems(null);
    try {
      setItems(await readConversation(row.id));
    } catch {
      setItems([]);
      setError('Could not load this conversation.');
    }
  };

  const onDelete = async (row: ConversationSummary) => {
    if (confirmId !== row.id) {
      setConfirmId(row.id);
      return;
    }
    setConfirmId(null);
    try {
      if (!(await deleteConversation(row.id))) setError('This conversation is in use; try again shortly.');
    } catch {
      setError('Could not delete the conversation.');
    }
    await load();
  };

  const resume = async () => {
    if (!open) return;
    setSwitching(true);
    try {
      if (await switchConversation(open.id)) {
        onClose();
        return;
      }
      setError('A reply is still running; try again when it ends.');
    } catch {
      setError('Could not switch conversations.');
    } finally {
      setSwitching(false);
    }
  };

  if (open) {
    return (
      <>
        <div className="lk-search">
          <button className="lk-iconbtn" onClick={() => setOpen(null)} aria-label="Back to conversations">
            <ha-icon icon="mdi:arrow-left" />
          </button>
          <span className="lk-texthead">{error ?? (open.title || 'New conversation')}</span>
        </div>
        {items === null ? (
          <div className="lk-tasks-empty">
            <span>Loading…</span>
          </div>
        ) : (
          <Conversation items={items} startAtEnd />
        )}
        <div className="lk-dock" ref={dockRef}>
          <button className="lk-listen-send lk-resume" onClick={() => void resume()} disabled={busy || switching}>
            <ha-icon icon="mdi:message-reply-text-outline" />
            Continue this conversation
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="lk-schedtab">
      <div className="lk-search">
        <button className="lk-iconbtn" onClick={onClose} aria-label="Back to the conversation">
          <ha-icon icon="mdi:arrow-left" />
        </button>
        <span className="lk-texthead">{error ?? 'Conversations'}</span>
        <button className="lk-iconbtn" onClick={() => void load()} aria-label="Refresh">
          <ha-icon icon="mdi:refresh" />
        </button>
      </div>
      <div className="lk-tasklist">
        {rows.length === 0 ? (
          <div className="lk-tasks-empty">
            <ha-icon icon="mdi:message-text-outline" />
            <span>{loading ? 'Loading…' : 'No conversations yet'}</span>
          </div>
        ) : (
          rows.map((row) => {
            const isCurrent = row.id === current;
            return (
              <div key={row.id} className="lk-taskrow" data-status={isCurrent ? 'scheduled' : 'past'}>
                <button className="lk-taskrow-main" onClick={() => void view(row)}>
                  <span className="lk-taskrow-icon">
                    <ha-icon icon="mdi:message-text-outline" />
                  </span>
                  <span className="lk-taskrow-body">
                    <span className="lk-taskrow-desc">{row.title || 'New conversation'}</span>
                    <span className="lk-taskrow-when">{when(row.updated)}</span>
                  </span>
                  {isCurrent && (
                    <span className="lk-taskrow-tags">
                      <span className="lk-tag">current</span>
                    </span>
                  )}
                </button>
                {!isCurrent && (
                  <div className="lk-taskrow-acts">
                    <button
                      className="lk-iconbtn lk-taskrow-del"
                      data-armed={row.id === confirmId ? '1' : '0'}
                      onClick={() => void onDelete(row)}
                      aria-label={row.id === confirmId ? 'Confirm delete' : 'Delete conversation'}
                    >
                      <ha-icon icon={row.id === confirmId ? 'mdi:check' : 'mdi:trash-can-outline'} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
