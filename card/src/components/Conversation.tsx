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
export function Conversation({
  items,
  autoscroll = true,
  reflowKey,
}: {
  items: ConvItem[];
  autoscroll?: boolean;
  /** Bump to re-pin to the bottom when something other than `items` changes the
   *  dock height (e.g. quick-reply chips appearing), so the tail isn't occluded. */
  reflowKey?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Follow new messages only while the user is already at the bottom. This lands the view
  // at the top on load (showing the start, not the tail) and never yanks away from earlier
  // messages you've scrolled up to read.
  const stick = useRef(false);

  const onScroll = () => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const pin = () => {
    const el = ref.current;
    if (el && autoscroll && stick.current) el.scrollTop = el.scrollHeight;
  };

  // Keep the tail visible as the timeline grows: a streaming reply mutates the last
  // bubble's text (no `items` reference change), so an items-only effect pins once —
  // before the final line lays out — and the tail slides under the floating dock. A
  // MutationObserver re-pins on every content change (tokens + new rows) while the
  // user is at the bottom. onScroll keeps `stick` current so it never yanks.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mo = new MutationObserver(() => pin());
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoscroll]);

  // Explicit re-pin on new items and on dock-height changes (reflowKey, e.g. chips):
  // the rAF runs the frame after --lk-dock-h updates so the padding is right first.
  useEffect(() => {
    pin();
    const raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, autoscroll, reflowKey]);

  // The empty hint lives inside the scroll container (not in place of it) so the
  // conversation's dock-clearance padding applies and the floating dock never overlaps it.
  return (
    <div className="lk-convo" ref={ref} onScroll={onScroll}>
      {items.length ? (
        items.map((item) =>
          item.kind === 'message' ? (
            <MessageRow key={item.id} item={item} />
          ) : (
            <ActionRow key={item.id} item={item} />
          )
        )
      ) : (
        <div className="lk-empty">
          <ha-icon icon="mdi:creation" />
          <span>Ask about your home — “turn on the study light”, “what's the temperature?”</span>
        </div>
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
