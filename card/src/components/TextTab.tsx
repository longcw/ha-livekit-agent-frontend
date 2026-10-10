import { useMemo, useState } from 'react';
import { lastUserText } from '../lib/conversation';
import { SCHEDULING_TOOLS, type Task } from '../lib/tasks';
import type { TasksApi } from '../lib/tasks-api';
import type { TextChatApi, TokenUsage } from '../lib/text-chat';
import { Conversation } from './Conversation';
import { DeviceTiles } from './DeviceTiles';
import { Composer, useDockHeight } from './Dock';
import { ScheduledTasks } from './ScheduledTasks';
import { TextHistory } from './TextHistory';

// shown as the schedules rail and the chips instead of as inline action rows
const HIDDEN_TOOLS = new Set([...SCHEDULING_TOOLS, 'suggest_replies']);

// 950, 12.3k, 1.2M
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function UsageLabel({ usage }: { usage: TokenUsage }) {
  const full = (n: number) => n.toLocaleString('en');
  return (
    <span
      className="lk-usage"
      title={`LLM tokens in this conversation: ${full(usage.input)} input (${full(usage.cached)} cached), ${full(usage.output)} output`}
    >
      {compact.format(usage.input)} in · {compact.format(usage.cached)} cached · {compact.format(usage.output)} out
    </span>
  );
}

/** The Text tab: the persisted text conversation shared with the phone, with the same
 *  device tiles, schedules rail and quick replies as the Chat tab, and a composer that
 *  sends into it. Voice stays on the Chat tab, which is a separate live session. */
export function TextTab({
  api,
  tasksApi,
  showTiles,
  onOpenTask,
  onSeeAllTasks,
}: {
  api: TextChatApi;
  tasksApi: TasksApi;
  showTiles: boolean;
  onOpenTask: (t: Task) => void;
  onSeeAllTasks: () => void;
}) {
  const { items, toolCalls, agentAreas, suggestions, commands, usage, busy, canStop, stopping, forceStop, error, stop, send, renew, refresh } = api;
  const dockRef = useDockHeight();
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const canSend = !busy && text.trim().length > 0;
  // a leading `/name` with no space yet offers the commands it could start
  const slash = /^\/([\w-]*)$/.exec(text);
  const offered = slash ? commands.filter((c) => c.name.startsWith(slash[1])) : [];
  const complete = (name: string) => setText(`/${name} `);
  const shown = useMemo(
    () => items.filter((i) => i.kind !== 'action' || !HIDDEN_TOOLS.has(i.name)),
    [items],
  );

  if (history) return <TextHistory api={api} onClose={() => setHistory(false)} />;

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
          <span className="lk-textstatus">
            {error ?? (stopping ? 'Stopping…' : forceStop ? 'Still working in the background' : busy ? 'Working…' : '')}
          </span>
          {usage && <UsageLabel usage={usage} />}
        </span>
        <button className="lk-iconbtn" onClick={() => void refresh()} aria-label="Refresh">
          <ha-icon icon="mdi:refresh" />
        </button>
        <button
          className="lk-iconbtn"
          onClick={() => setHistory(true)}
          aria-label="Conversations"
          title="Conversations"
        >
          <ha-icon icon="mdi:history" />
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
        hidden={!showTiles}
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
        {offered.length > 0 && (
          <div className="lk-slash" role="listbox" aria-label="Commands">
            {offered.map((c) => (
              <button key={c.name} className="lk-slash-item" role="option" onClick={() => complete(c.name)}>
                <span className="lk-slash-name">/{c.name}</span>
                {c.argument_hint && <span className="lk-slash-hint">{c.argument_hint}</span>}
                <span className="lk-slash-desc">{c.description.split(/(?<=\.)\s/)[0]}</span>
              </button>
            ))}
          </div>
        )}
        {offered.length === 0 && suggestions.length > 0 && (
          <div className="lk-suggest">
            {suggestions.map((reply, i) => (
              <button key={`${i}-${reply}`} className="lk-chip" onClick={() => submit(reply)}>
                {reply}
              </button>
            ))}
          </div>
        )}
        <div className="lk-bar">
          <Composer
            value={text}
            placeholder={commands.length ? 'Message, or / for commands…' : 'Message…'}
            onChange={setText}
            onSubmit={() => submit(text)}
            onFocus={api.warm}
            onKey={(e) => {
              if (!offered.length || (e.key !== 'Tab' && e.key !== 'Enter') || e.shiftKey) return false;
              e.preventDefault();
              complete(offered[0].name);
              return true;
            }}
          />
          {busy ? (
            <button
              className="lk-send lk-send--accent lk-stop"
              title={stopping ? 'Stopping…' : forceStop ? 'Force stop: also cancel background work' : 'Stop'}
              aria-label={stopping ? 'Stopping' : forceStop ? 'Force stop' : 'Stop'}
              data-stopping={stopping ? '1' : '0'}
              data-force={forceStop ? '1' : '0'}
              onClick={() => void stop()}
              disabled={!canStop}
            >
              {stopping ? <span className="lk-spin" aria-hidden="true" /> : <span className="lk-stop-sq" aria-hidden="true" />}
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
