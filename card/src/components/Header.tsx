import type { TurnMode } from '../lib/turn-mode';

export function Header({
  orbState,
  title,
  connected,
  mode,
  onModeChange,
  stateLabel,
  onEnd,
}: {
  orbState: string;
  title: string;
  connected: boolean;
  mode: TurnMode;
  onModeChange: (mode: TurnMode) => void;
  stateLabel: string;
  onEnd: () => void;
}) {
  return (
    <header className="lk-top">
      <span className="lk-orb" data-state={orbState} aria-hidden="true">
        <span className="lk-orb-core" />
      </span>
      <div className="lk-titlewrap">
        <span className="lk-title">{title}</span>
        <span className="lk-state" data-state={orbState}>
          {stateLabel}
        </span>
      </div>
      {connected && <ModeSwitch mode={mode} onChange={onModeChange} />}
      {connected && (
        <button className="lk-iconbtn" title="End conversation" onClick={onEnd}>
          <ha-icon icon="mdi:close" />
        </button>
      )}
    </header>
  );
}

/** Segmented Auto | Manual toggle for the turn-detection mode. */
function ModeSwitch({ mode, onChange }: { mode: TurnMode; onChange: (mode: TurnMode) => void }) {
  return (
    <div className="lk-modeswitch" role="group" aria-label="Turn mode">
      <button
        type="button"
        data-on={mode === 'auto' ? '1' : '0'}
        title="Hands-free: talk continuously, the agent detects when you stop"
        onClick={() => onChange('auto')}
      >
        Auto
      </button>
      <button
        type="button"
        data-on={mode === 'manual' ? '1' : '0'}
        title="Push-to-talk: tap to start a turn, End to send or Cancel to discard"
        onClick={() => onChange('manual')}
      >
        Manual
      </button>
    </div>
  );
}
