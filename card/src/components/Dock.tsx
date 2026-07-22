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
 * The bottom dock, floating over the conversation — always a chat composer (the card never
 * shows a separate "connect" gate; it connects lazily on the first send/speak). It morphs:
 *  - manual, turn open  → a listening bar (Cancel · live meter · Send)
 *  - manual, idle       → text bar with a mic button that opens a turn
 *  - auto               → text bar with a start/pause button for continuous listening
 * Presentational — all behaviour (including connecting) comes in via props.
 */
export interface DockProps {
  connected: boolean;
  /** A connect is in flight (lazy connect on first send/speak). */
  connecting: boolean;
  mode: TurnMode;
  turnActive: boolean;
  autoPaused: boolean;
  /** Mic is being acquired (cold-start) — show "Starting…" until it's actually capturing. */
  micStarting: boolean;
  onSend: (text: string) => Promise<void> | void;
  onTurnStart: () => void;
  onTurnEnd: () => void;
  onTurnCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  /** One-tap quick replies shown above the composer; tapping one sends it as the reply. */
  suggestions?: string[];
  /** Preview only: pre-fill the input to inspect the send-button state. */
  initialText?: string;
}

export function Dock(props: DockProps) {
  const { mode, turnActive, autoPaused, micStarting, connecting, onSend } = props;
  const { onTurnStart, onTurnEnd, onTurnCancel, onPause, onResume } = props;
  const suggestions = props.suggestions ?? [];
  const dockRef = useDockHeight();
  const [text, setText] = useState(props.initialText ?? '');
  const [sending, setSending] = useState(false);
  const canSend = !sending && text.trim().length > 0;

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(message);
    } finally {
      setSending(false);
    }
  };
  const submit = () => sendMessage(text);

  // Manual turn in progress: the composer becomes a focused listening bar. While the mic is
  // still warming up (cold-start), show "Starting…" with a spinner and hold the Send button —
  // there's no captured audio to commit yet, and the user shouldn't talk into a dead mic.
  if (mode === 'manual' && turnActive) {
    return (
      <div className="lk-dock" ref={dockRef}>
        <div className="lk-listen" data-starting={micStarting ? '1' : '0'}>
          <button className="lk-listen-cancel" title="Cancel" onClick={onTurnCancel}>
            <ha-icon icon="mdi:close" />
          </button>
          <div className="lk-listen-mid">
            {micStarting ? (
              <span className="lk-spin" aria-hidden="true" />
            ) : (
              <span className="lk-eq" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
            <span className="lk-listen-label">{micStarting ? 'Starting…' : 'Listening…'}</span>
          </div>
          <button
            className="lk-listen-send"
            title="Send to the agent"
            onClick={onTurnEnd}
            disabled={micStarting}
          >
            <span>Send</span>
            <ha-icon icon="mdi:arrow-up" />
          </button>
        </div>
      </div>
    );
  }

  const paused = mode === 'auto' && autoPaused;
  const placeholder = connecting ? 'Connecting…' : paused ? 'Message, or tap the mic to talk' : 'Message…';

  return (
    <div className="lk-dock" ref={dockRef}>
      {suggestions.length > 0 && (
        <div className="lk-suggest">
          {suggestions.map((reply, i) => (
            <button
              key={`${i}-${reply}`}
              className="lk-chip"
              onClick={() => sendMessage(reply)}
              disabled={sending}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
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
          busy={sending || micStarting}
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

/** The right-hand button in the text bar: Send when typing, a spinner while connecting/warming,
 *  else the mode's voice action (manual: tap-to-talk; auto: start/pause continuous listening). */
function TrailingButton({
  canSend,
  busy,
  mode,
  paused,
  onSubmit,
  onTurnStart,
  onPause,
  onResume,
}: {
  canSend: boolean;
  busy: boolean;
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
  // Sending a text (connecting first) or warming the mic — hold the button with a spinner.
  if (busy) {
    return (
      <button className="lk-send lk-send--accent" title="Working…" disabled>
        <span className="lk-spin" aria-hidden="true" />
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
  // auto mode: start / pause continuous listening
  if (paused) {
    return (
      <button className="lk-send lk-send--accent" title="Start listening" onClick={onResume}>
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
