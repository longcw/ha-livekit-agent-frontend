export function Header({
  orbState,
  title,
  connected,
  stateLabel,
  onEnd,
}: {
  orbState: string;
  title: string;
  connected: boolean;
  stateLabel: string;
  onEnd: () => void;
}) {
  return (
    <header className="lk-top">
      <span className="lk-orb" data-state={orbState} aria-hidden="true">
        <span className="lk-orb-core" />
      </span>
      <span className="lk-title">{title}</span>
      <span className="lk-status" data-live={connected ? '1' : '0'}>
        {stateLabel}
      </span>
      {connected && (
        <button className="lk-iconbtn" title="End conversation" onClick={onEnd}>
          <ha-icon icon="mdi:close" />
        </button>
      )}
    </header>
  );
}
