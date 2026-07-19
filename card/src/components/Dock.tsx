import { useEffect, useRef, useState } from 'react';

/** Publishes the dock's height as `--lk-dock-h` on the card so the chat can pad past it. */
function useDockHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => el.parentElement?.style.setProperty('--lk-dock-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

/**
 * The bottom dock, floating over the conversation. When connected it shows a large,
 * separate push-to-talk button (in PTT mode) above a text input; otherwise the Start
 * button. Presentational — all behaviour comes in via props (so it can be previewed).
 */
export interface DockProps {
  connected: boolean;
  mode: 'ptt' | 'auto';
  micOn: boolean;
  onStart: () => void;
  onSend: (text: string) => Promise<void> | void;
  onMicToggle: () => void;
  onPttStart: () => void;
  onPttEnd: () => void;
  startLabel: string;
}

export function Dock(props: DockProps) {
  const { connected, mode, micOn, onStart, onSend, onMicToggle, onPttStart, onPttEnd, startLabel } = props;
  const dockRef = useDockHeight();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const canSend = !sending && text.trim().length > 0;

  const submit = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(message);
    } finally {
      setSending(false);
    }
  };

  if (!connected) {
    return (
      <div className="lk-dock" ref={dockRef}>
        <button className="lk-start" onClick={onStart}>
          <ha-icon icon="mdi:microphone" />
          {startLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="lk-dock" ref={dockRef}>
      {mode === 'ptt' && <PttButton onStart={onPttStart} onEnd={onPttEnd} />}
      <div className="lk-bar">
        <textarea
          className="lk-input"
          rows={1}
          value={text}
          placeholder={mode === 'ptt' ? 'Type a message…' : 'Message…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {canSend ? (
          <button className="lk-send lk-send--accent" title="Send" onClick={submit}>
            <ha-icon icon="mdi:arrow-up" />
          </button>
        ) : mode === 'auto' ? (
          <button
            className="lk-send"
            data-on={micOn ? '1' : '0'}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            onClick={onMicToggle}
          >
            <ha-icon icon={micOn ? 'mdi:microphone' : 'mdi:microphone-off'} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PttButton({ onStart, onEnd }: { onStart: () => void; onEnd: () => void }) {
  const holding = useRef(false);

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (holding.current) return;
    holding.current = true;
    e.currentTarget.dataset.holding = '1';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onStart();
  };
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!holding.current) return;
    holding.current = false;
    e.currentTarget.dataset.holding = '0';
    onEnd();
  };

  return (
    <div className="lk-ptt-wrap">
      <button
        className="lk-ptt"
        title="Hold to talk"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      >
        <ha-icon icon="mdi:microphone" />
      </button>
      <span className="lk-ptt-hint">Hold to talk</span>
    </div>
  );
}
