import { useEffect, useId, useRef, useState } from 'react';
import {
  actionTarget,
  type ConvAction,
  type ConvItem,
  type ConvMessage,
  humanizeTool,
  isActionTool,
  prettyJson,
} from '../lib/conversation';
import { Markdown } from './Markdown';

/**
 * The conversation timeline: speech + typed messages and the agent's tool actions,
 * interleaved chronologically. Works for both the live session and stored history.
 */
export function Conversation({
  items,
  autoscroll = true,
  startAtEnd = false,
  reflowKey,
}: {
  items: ConvItem[];
  autoscroll?: boolean;
  /** Open on the latest message rather than the first, e.g. for a stored conversation. */
  startAtEnd?: boolean;
  /** Bump to re-pin to the bottom when something other than `items` changes the
   *  dock height (e.g. quick-reply chips appearing), so the tail isn't occluded. */
  reflowKey?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Follow new messages only while the user is already at the bottom. Unless startAtEnd,
  // this lands the view at the top on load (showing the start, not the tail), and it never
  // yanks away from earlier messages you've scrolled up to read.
  const stick = useRef(startAtEnd);
  // where the user left the view, restored when the browser resets it
  const savedTop = useRef(0);

  const onScroll = () => {
    const el = ref.current;
    // a detached or hidden timeline has no size, so its scroll events aren't the user's
    if (!el || !el.clientHeight) return;
    savedTop.current = el.scrollTop;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // a row the user expands grows in place: hold the view for that frame instead of pinning
  const holding = useRef(false);
  const hold = () => {
    holding.current = true;
    requestAnimationFrame(() => {
      holding.current = false;
      onScroll();
    });
  };

  const pin = () => {
    const el = ref.current;
    if (el && autoscroll && stick.current && !holding.current) el.scrollTop = el.scrollHeight;
  };

  // Keep the tail visible as the timeline grows: a streaming reply mutates the last
  // bubble's text (no `items` reference change), so an items-only effect pins once —
  // before the final line lays out — and the tail slides under the floating dock. A
  // MutationObserver re-pins on every content change (tokens + new rows) while the
  // user is at the bottom. onScroll keeps `stick` current so it never yanks.
  // The ResizeObserver covers what changes the view without touching the items: the card
  // re-parenting into a new element on a view switch (which resets scrollTop to 0), the view
  // being shown after loading hidden, and the rails above growing or collapsing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mo = new MutationObserver(() => pin());
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(() => {
      if (!el.clientHeight) return;
      if (autoscroll && stick.current) pin();
      else el.scrollTop = savedTop.current;
    });
    ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
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
            <ActionRow key={item.id} item={item} onToggle={hold} />
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
      {/* the agent's replies are Markdown; the user's own text stays literal */}
      {item.role === 'agent' ? (
        <div className="lk-bubble lk-md">
          <Markdown text={item.text} />
        </div>
      ) : (
        <div className="lk-bubble">{item.text}</div>
      )}
    </div>
  );
}

const STATUS_WORDS: Record<ConvAction['status'], string> = {
  running: 'Running…',
  done: 'Done',
  error: 'Failed',
  cancelled: 'Cancelled',
};

function ActionRow({ item, onToggle }: { item: ConvAction; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const action = isActionTool(item.name);
  // an MCP server's update, which the worker shows as a row: its text is all there is to see
  const update = item.name === 'update_from';
  const target = actionTarget(item.args);
  const failed = item.status === 'error';
  const output = item.output;
  const clipped = output != null && item.outputChars != null && item.outputChars > output.length;
  const hasArgs = item.args != null && !(typeof item.args === 'object' && !Object.keys(item.args).length);
  return (
    <div className="lk-act-row" data-open={open ? '1' : '0'}>
      <button
        type="button"
        className="lk-act"
        data-kind={action ? 'action' : 'read'}
        data-status={item.status}
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => {
          onToggle();
          setOpen((v) => !v);
        }}
      >
        <span className="lk-act-dot" />
        <ha-icon icon={update ? 'mdi:bell-outline' : action ? 'mdi:flash' : 'mdi:radar'} />
        <span className="lk-act-text">
          {humanizeTool(item.name)}
          {target && <span className="lk-act-target"> {target}</span>}
        </span>
        <ha-icon className="lk-act-chev" icon="mdi:chevron-down" />
      </button>
      {open && update && (
        <div className="lk-act-details" id={detailsId}>
          <div className="lk-act-update">{output}</div>
        </div>
      )}
      {open && !update && (
        <div className="lk-act-details" id={detailsId}>
          <div className="lk-act-status" data-status={item.status}>
            <span className="lk-act-dot" />
            {STATUS_WORDS[item.status]}
            <span className="lk-act-name">{item.name}</span>
          </div>
          <div className="lk-act-label">Arguments</div>
          {hasArgs ? (
            <pre className="lk-act-code">{prettyJson(item.args)}</pre>
          ) : (
            <div className="lk-act-none">None</div>
          )}
          {item.status !== 'running' && (
            <>
              <div className="lk-act-label">
                {failed ? 'Error' : 'Output'}
                {clipped && (
                  <span className="lk-act-note">
                    {' '}
                    · first {output.replace(/…$/, '').length.toLocaleString('en-US')} of{' '}
                    {item.outputChars!.toLocaleString('en-US')} characters
                  </span>
                )}
              </div>
              {output ? (
                <pre className="lk-act-code" data-error={failed ? '1' : '0'}>
                  {prettyJson(output, clipped)}
                </pre>
              ) : (
                <div className="lk-act-none">{output === '' ? 'Empty' : 'Not recorded'}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
