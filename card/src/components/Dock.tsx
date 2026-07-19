import { useEffect, useRef, useState } from 'react';
import type { TurnMode } from '../lib/turn-mode';

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
 * The bottom dock, floating over the conversation. The composer morphs in place:
 *  - manual, turn open  → a listening bar (Cancel · live meter · Send)
 *  - manual, idle       → text bar with a mic button that opens a turn
 *  - auto               → text bar with a pause/resume button (temporarily mutes input)
 * Presentational — all behaviour comes in via props.
 */
export interface DockProps {
  connected: boolean;
  mode: TurnMode;
  turnActive: boolean;
  autoPaused: boolean;
  onStart: () => void;
  onSend: (text: string) => Promise<void> | void;
  onTurnStart: () => void;
  onTurnEnd: () => void;
  onTurnCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  startLabel: string;
  /** Preview only: pre-fill the input to inspect the send-button state. */
  initialText?: string;
}

export function Dock(props: DockProps) {
  const { connected, mode, turnActive, autoPaused, onStart, onSend } = props;
  const { onTurnStart, onTurnEnd, onTurnCancel, onPause, onResume, startLabel } = props;
  const dockRef = useDockHeight();
  const [text, setText] = useState(props.initialText ?? '');
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

  // Manual turn in progress: the composer becomes a focused listening bar.
  if (mode === 'manual' && turnActive) {
    return (
      <div className="lk-dock" ref={dockRef}>
        <div className="lk-listen">
          <button className="lk-listen-cancel" title="Cancel" onClick={onTurnCancel}>
            <ha-icon icon="mdi:close" />
          </button>
          <div className="lk-listen-mid">
            <span className="lk-eq" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="lk-listen-label">Listening…</span>
          </div>
          <button className="lk-listen-send" title="Send to the agent" onClick={onTurnEnd}>
            <span>Send</span>
            <ha-icon icon="mdi:arrow-up" />
          </button>
        </div>
      </div>
    );
  }

  const paused = mode === 'auto' && autoPaused;
  const placeholder = paused ? 'Muted — tap the mic to resume' : 'Message…';

  return (
    <div className="lk-dock" ref={dockRef}>
      <div className="lk-bar" data-paused={paused ? '1' : '0'}>
        <input
          className="lk-input"
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <TrailingButton
          canSend={canSend}
          mode={mode}
          paused={paused}
          onSubmit={submit}
          onTurnStart={onTurnStart}
          onPause={onPause}
          onResume={onResume}
        />
      </div>
    </div>
  );
}

/** The right-hand button in the text bar: Send when typing, else the mode's voice action. */
function TrailingButton({
  canSend,
  mode,
  paused,
  onSubmit,
  onTurnStart,
  onPause,
  onResume,
}: {
  canSend: boolean;
  mode: TurnMode;
  paused: boolean;
  onSubmit: () => void;
  onTurnStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  if (canSend) {
    return (
      <button className="lk-send lk-send--accent" title="Send" onClick={onSubmit}>
        <ha-icon icon="mdi:arrow-up" />
      </button>
    );
  }
  if (mode === 'manual') {
    return (
      <button className="lk-send lk-send--accent" title="Tap to talk" onClick={onTurnStart}>
        <ha-icon icon="mdi:microphone" />
      </button>
    );
  }
  // auto mode: pause / resume listening
  if (paused) {
    return (
      <button className="lk-send lk-send--accent" title="Resume listening" onClick={onResume}>
        <ha-icon icon="mdi:microphone" />
      </button>
    );
  }
  return (
    <button className="lk-send" data-on="1" title="Pause listening" onClick={onPause}>
      <ha-icon icon="mdi:pause" />
    </button>
  );
}
