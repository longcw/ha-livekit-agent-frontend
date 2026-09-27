import { useState } from 'react';
import type { TextChatApi } from '../lib/text-chat';
import { Conversation } from './Conversation';
import { useDockHeight } from './Dock';

/** The Text tab: the persisted text conversation shared with the phone, and a composer
 *  that sends into it. Voice stays on the Chat tab, which is a separate live session. */
export function TextTab({ api }: { api: TextChatApi }) {
  const { items, busy, error, send, renew, refresh } = api;
  const dockRef = useDockHeight();
  const [text, setText] = useState('');
  const canSend = !busy && text.trim().length > 0;

  const submit = () => {
    const message = text.trim();
    if (!message || busy) return;
    setText('');
    void send(message);
  };

  return (
    <>
      <div className="lk-search">
        <span className="lk-texthead">
          {error ?? (busy ? 'Working…' : 'Shared with your phone')}
        </span>
        <button className="lk-iconbtn" onClick={() => void refresh()} aria-label="Refresh">
          <ha-icon icon="mdi:refresh" />
        </button>
        <button
          className="lk-iconbtn"
          onClick={() => void renew()}
          disabled={busy}
          aria-label="New conversation"
          title="New conversation"
        >
          <ha-icon icon="mdi:message-plus-outline" />
        </button>
      </div>
      <Conversation items={items} />
      <div className="lk-dock" ref={dockRef}>
        <div className="lk-bar">
          <input
            className="lk-input"
            type="text"
            value={text}
            placeholder="Message…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          {busy ? (
            <button className="lk-send lk-send--accent" title="Working…" disabled>
              <span className="lk-spin" aria-hidden="true" />
            </button>
          ) : (
            <button
              className="lk-send lk-send--accent"
              title="Send"
              onClick={submit}
              disabled={!canSend}
            >
              <ha-icon icon="mdi:arrow-up" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
