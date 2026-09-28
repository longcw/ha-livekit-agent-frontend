import { useMemo, useState } from 'react';
import { lastUserText } from '../lib/conversation';
import { SCHEDULING_TOOLS, type Task } from '../lib/tasks';
import type { TasksApi } from '../lib/tasks-api';
import type { TextChatApi } from '../lib/text-chat';
import { Conversation } from './Conversation';
import { DeviceTiles } from './DeviceTiles';
import { useDockHeight } from './Dock';
import { ScheduledTasks } from './ScheduledTasks';

// shown as the schedules rail and the chips instead of as inline action rows
const HIDDEN_TOOLS = new Set([...SCHEDULING_TOOLS, 'suggest_replies']);

/** The Text tab: the persisted text conversation shared with the phone, with the same
 *  device tiles, schedules rail and quick replies as the Chat tab, and a composer that
 *  sends into it. Voice stays on the Chat tab, which is a separate live session. */
export function TextTab({
  api,
  tasksApi,
  onOpenTask,
  onSeeAllTasks,
}: {
  api: TextChatApi;
  tasksApi: TasksApi;
  onOpenTask: (t: Task) => void;
  onSeeAllTasks: () => void;
}) {
  const { items, toolCalls, agentAreas, suggestions, busy, error, send, renew, refresh } = api;
  const dockRef = useDockHeight();
  const [text, setText] = useState('');
  const canSend = !busy && text.trim().length > 0;
  const shown = useMemo(
    () => items.filter((i) => i.kind !== 'action' || !HIDDEN_TOOLS.has(i.name)),
    [items],
  );

  const submit = (raw: string) => {
    const message = raw.trim();
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
      <DeviceTiles
        agentAreas={agentAreas}
        toolCalls={toolCalls}
        query={lastUserText(items)}
        showRecent
      />
      <ScheduledTasks
        tasks={tasksApi.tasks}
        freshId={tasksApi.freshId}
        onOpen={onOpenTask}
        onSeeAll={onSeeAllTasks}
      />
      <Conversation items={shown} startAtEnd reflowKey={suggestions.length} />
      <div className="lk-dock" ref={dockRef}>
        {suggestions.length > 0 && (
          <div className="lk-suggest">
            {suggestions.map((reply, i) => (
              <button key={`${i}-${reply}`} className="lk-chip" onClick={() => submit(reply)}>
                {reply}
              </button>
            ))}
          </div>
        )}
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
                submit(text);
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
              onClick={() => submit(text)}
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
