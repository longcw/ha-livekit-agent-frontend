import { useEffect, useRef } from 'react';
import {
  actionTarget,
  type ConvAction,
  type ConvItem,
  type ConvMessage,
  humanizeTool,
  isActionTool,
} from '../lib/conversation';

/**
 * The conversation timeline: speech + typed messages and the agent's tool actions,
 * interleaved chronologically. Works for both the live session and stored history.
 */
export function Conversation({ items, autoscroll = true }: { items: ConvItem[]; autoscroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoscroll) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, autoscroll]);

  if (!items.length) {
    return (
      <div className="lk-empty">
        <ha-icon icon="mdi:waveform" />
        <span>Ask about your home — “turn on the study light”, “what's the temperature?”</span>
      </div>
    );
  }

  return (
    <div className="lk-convo" ref={ref}>
      {items.map((item) =>
        item.kind === 'message' ? (
          <MessageRow key={item.id} item={item} />
        ) : (
          <ActionRow key={item.id} item={item} />
        )
      )}
    </div>
  );
}

function MessageRow({ item }: { item: ConvMessage }) {
  return (
    <div className="lk-msg" data-role={item.role}>
      <div className="lk-bubble">{item.text}</div>
    </div>
  );
}

function ActionRow({ item }: { item: ConvAction }) {
  const action = isActionTool(item.name);
  const target = actionTarget(item.args);
  return (
    <div className="lk-act" data-kind={action ? 'action' : 'read'} data-status={item.status}>
      <span className="lk-act-dot" />
      <ha-icon icon={action ? 'mdi:flash' : 'mdi:radar'} />
      <span className="lk-act-text">
        {humanizeTool(item.name)}
        {target && <span className="lk-act-target"> {target}</span>}
      </span>
    </div>
  );
}
