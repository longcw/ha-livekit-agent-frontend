// Card styles, injected into the shadow root. Uses Home Assistant theme variables so the
// card matches the active dashboard theme in light and dark.
export const CARD_STYLES = `
  :host { display: block; }
  * { box-sizing: border-box; }

  ha-card {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lk-header { display: flex; align-items: center; gap: 8px; }
  .lk-title {
    font-size: 1rem; font-weight: 600; color: var(--primary-text-color);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lk-header-right { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
  .lk-history-btn {
    font: inherit; cursor: pointer; --mdc-icon-size: 18px;
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 8px; border: none;
    background: transparent; color: var(--secondary-text-color);
  }
  .lk-history-btn:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
  .lk-state {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--secondary-text-color); text-transform: capitalize;
  }
  .lk-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-text-color, #9e9e9e); }
  .lk-dot[data-active="1"] { background: var(--primary-color); }
  .lk-dot[data-pulse="1"] { animation: lk-pulse 1.4s ease-in-out infinite; }
  @keyframes lk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  /* Device tiles */
  .lk-devices { display: flex; flex-direction: column; gap: 8px; }
  .lk-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
  .lk-tile {
    position: relative; font: inherit; text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 7px;
    border: 1px solid var(--divider-color); border-radius: 16px; padding: 12px 11px;
    background: var(--card-background-color); color: var(--primary-text-color);
    transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease, transform .06s ease;
    min-width: 0; overflow: hidden;
  }
  .lk-tile:hover { border-color: var(--primary-text-color); border-color: color-mix(in srgb, var(--primary-text-color) 25%, var(--divider-color)); }
  .lk-tile:active { transform: scale(0.97); }
  .lk-tile[data-active="1"] {
    border-color: transparent;
    background: color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 38%, transparent);
  }
  .lk-tile[data-touched="1"] {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--primary-color), 0 6px 18px -10px color-mix(in srgb, var(--primary-color) 80%, transparent);
  }
  .lk-tile-icon {
    --mdc-icon-size: 20px; width: 36px; height: 36px; border-radius: 11px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--secondary-background-color); color: var(--secondary-text-color);
    transition: background-color .15s ease, color .15s ease;
  }
  .lk-tile[data-active="1"] .lk-tile-icon { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .lk-tile-state {
    font-size: 1.05rem; font-weight: 650; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lk-tile-name {
    font-size: 0.74rem; color: var(--secondary-text-color); line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .lk-more {
    font: inherit; cursor: pointer; align-self: center;
    display: inline-flex; align-items: center; gap: 4px;
    background: transparent; border: none; padding: 4px 10px; border-radius: 999px;
    color: var(--secondary-text-color); font-size: 0.8rem; font-weight: 600;
    --mdc-icon-size: 16px;
  }
  .lk-more:hover { color: var(--primary-text-color); background: var(--secondary-background-color); }

  /* Transcript */
  .lk-transcript {
    display: flex; flex-direction: column; gap: 6px;
    max-height: 220px; overflow-y: auto; font-size: 0.9rem; line-height: 1.35;
  }
  .lk-line { color: var(--primary-text-color); }
  .lk-line[data-role="user"] { color: var(--secondary-text-color); }
  .lk-who {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--secondary-text-color); margin-right: 6px;
  }

  /* Tool cards */
  .lk-tools { display: flex; flex-direction: column; gap: 6px; }
  .lk-tool {
    border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px 10px;
    font-size: 0.82rem; display: flex; align-items: center; gap: 8px;
  }
  .lk-tool-name { font-weight: 600; color: var(--primary-text-color); }
  .lk-tool-args { color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lk-tool-badge { margin-left: auto; font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; }
  .lk-tool-badge[data-s="running"] { background: color-mix(in srgb, var(--primary-color) 18%, transparent); color: var(--primary-color); }
  .lk-tool-badge[data-s="done"] { background: color-mix(in srgb, var(--success-color, #2e7d32) 18%, transparent); color: var(--success-color, #2e7d32); }
  .lk-tool-badge[data-s="error"], .lk-tool-badge[data-s="cancelled"] { background: color-mix(in srgb, var(--error-color, #db4437) 18%, transparent); color: var(--error-color, #db4437); }

  /* Controls / input */
  .lk-hint { color: var(--secondary-text-color); font-size: 0.85rem; text-align: center; padding: 4px 0; }
  .lk-controls { display: flex; align-items: center; gap: 8px; }
  .lk-input { display: flex; align-items: flex-end; gap: 8px; flex: 1; }
  .lk-input textarea {
    font: inherit; flex: 1; resize: none; min-height: 38px; max-height: 96px;
    border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px 10px;
    background: var(--card-background-color); color: var(--primary-text-color);
  }
  .lk-input textarea:focus { outline: none; border-color: var(--primary-color); }

  button.lk-btn {
    font: inherit; cursor: pointer; border: none; border-radius: 999px;
    padding: 10px 18px; font-weight: 600;
    color: var(--text-primary-color, #fff); background: var(--primary-color);
    transition: opacity .2s ease, transform .05s ease; -webkit-user-select: none; user-select: none;
  }
  button.lk-btn:active { transform: scale(0.98); }
  button.lk-btn:disabled { opacity: .5; cursor: default; }
  button.lk-icon-btn {
    font: inherit; cursor: pointer; width: 40px; height: 40px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);
  }
  button.lk-icon-btn[data-on="1"] { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: transparent; }
  button.lk-secondary { background: transparent; color: var(--secondary-text-color); border: 1px solid var(--divider-color); }
  button.lk-danger { background: color-mix(in srgb, var(--error-color, #db4437) 14%, transparent); color: var(--error-color, #db4437); }
  button.lk-talk[data-holding="1"] { background: var(--error-color, #db4437); }

  .lk-error { color: var(--error-color, #db4437); font-size: 0.85rem; text-align: center; }

  /* Session history */
  .lk-history { display: flex; flex-direction: column; gap: 10px; }
  .lk-history-head { display: flex; align-items: center; gap: 8px; }
  .lk-session-list { display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; }
  .lk-session {
    font: inherit; text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 2px;
    border: 1px solid var(--divider-color); border-radius: 12px; padding: 10px 12px;
    background: var(--card-background-color); color: var(--primary-text-color);
  }
  .lk-session:hover { border-color: color-mix(in srgb, var(--primary-text-color) 25%, var(--divider-color)); }
  .lk-session-time { font-size: 0.72rem; color: var(--secondary-text-color); }
  .lk-session-summary { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-session-meta { font-size: 0.7rem; color: var(--secondary-text-color); }
`;
