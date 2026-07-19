// Visual system for the card. Everything derives from Home Assistant theme variables so
// the card belongs in any theme (light/dark), with one signature accent treatment (the
// voice orb + active glow) and a monospace utility face for device data.
export const CARD_STYLES = `
  :host {
    --lk-accent: var(--primary-color, #3d7eff);
    --lk-on-accent: var(--text-primary-color, #fff);
    --lk-fg: var(--primary-text-color, #e6e6e6);
    --lk-muted: var(--secondary-text-color, #9aa0a6);
    --lk-surface: var(--card-background-color, var(--ha-card-background, #1b1c1f));
    --lk-elevated: var(--secondary-background-color, rgba(128,128,128,0.10));
    --lk-line: var(--divider-color, rgba(128,128,128,0.22));
    --lk-danger: var(--error-color, #f0483e);
    --lk-ok: var(--success-color, #21b573);
    --lk-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    --lk-r: 18px;
    display: block;
  }
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; }

  ha-card {
    padding: 14px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }

  /* ---- header ---- */
  .lk-top { display: flex; align-items: center; gap: 10px; }
  .lk-title {
    font-size: 0.95rem; font-weight: 650; letter-spacing: -0.01em; color: var(--lk-fg);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lk-status {
    margin-left: auto;
    font-family: var(--lk-mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--lk-muted); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--lk-line);
  }
  .lk-status[data-live="1"] { color: var(--lk-accent); border-color: color-mix(in srgb, var(--lk-accent) 40%, transparent); }

  /* ---- signature voice orb ---- */
  .lk-orb { position: relative; width: 24px; height: 24px; flex: none; display: inline-grid; place-items: center; }
  .lk-orb::before {
    content: ""; position: absolute; inset: -3px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--lk-accent) 45%, transparent), transparent 68%);
    opacity: 0;
  }
  .lk-orb-core {
    width: 12px; height: 12px; border-radius: 50%;
    background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--lk-accent) 55%, #fff), var(--lk-accent));
    box-shadow: 0 0 10px -1px color-mix(in srgb, var(--lk-accent) 70%, transparent);
  }
  .lk-orb[data-state="idle"] .lk-orb-core { background: var(--lk-muted); box-shadow: none; }
  .lk-orb[data-state="connecting"] .lk-orb-core { animation: lk-breathe 1.1s ease-in-out infinite; }
  .lk-orb[data-state="listening"] .lk-orb-core { animation: lk-breathe 2.4s ease-in-out infinite; }
  .lk-orb[data-state="listening"]::before { opacity: .7; animation: lk-halo 2.4s ease-in-out infinite; }
  .lk-orb[data-state="thinking"] .lk-orb-core { animation: lk-breathe .8s ease-in-out infinite; }
  .lk-orb[data-state="thinking"]::before { opacity: .5; animation: lk-halo .8s ease-in-out infinite; }
  .lk-orb[data-state="speaking"] .lk-orb-core { animation: lk-speak .5s ease-in-out infinite; }
  .lk-orb[data-state="speaking"]::before { opacity: .9; }
  @keyframes lk-breathe { 0%,100% { transform: scale(.85); } 50% { transform: scale(1.15); } }
  @keyframes lk-speak { 0%,100% { transform: scale(.8); } 50% { transform: scale(1.28); } }
  @keyframes lk-halo { 0%,100% { transform: scale(.9); opacity: .35; } 50% { transform: scale(1.3); opacity: .8; } }

  /* ---- device tiles ---- */
  .lk-devices { display: flex; flex-direction: column; gap: 9px; }
  .lk-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(94px, 1fr)); gap: 8px; }
  .lk-tile {
    position: relative; text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 9px;
    padding: 12px 11px; border-radius: 16px; min-width: 0; overflow: hidden;
    border: 1px solid var(--lk-line); background: var(--lk-surface); color: var(--lk-fg);
    transition: border-color .18s, background-color .18s, box-shadow .18s, transform .06s;
  }
  .lk-tile:hover { border-color: color-mix(in srgb, var(--lk-fg) 28%, var(--lk-line)); }
  .lk-tile:active { transform: scale(.97); }
  .lk-tile[data-active="1"] {
    border-color: transparent;
    background: color-mix(in srgb, var(--lk-accent) 13%, var(--lk-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lk-accent) 42%, transparent);
  }
  .lk-tile[data-touched="1"] {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--lk-accent), 0 10px 24px -14px color-mix(in srgb, var(--lk-accent) 90%, transparent);
  }
  .lk-tile-icon {
    --mdc-icon-size: 20px; width: 36px; height: 36px; border-radius: 11px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--lk-elevated); color: var(--lk-muted);
    transition: background-color .18s, color .18s;
  }
  .lk-tile[data-active="1"] .lk-tile-icon { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-tile-state {
    font-family: var(--lk-mono); font-size: 1.02rem; font-weight: 600; line-height: 1.05; letter-spacing: -0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lk-tile-name {
    font-size: 0.73rem; line-height: 1.25; color: var(--lk-muted);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .lk-more {
    align-self: center; cursor: pointer; --mdc-icon-size: 15px;
    display: inline-flex; align-items: center; gap: 3px;
    background: transparent; border: none; padding: 3px 10px; border-radius: 999px;
    color: var(--lk-muted); font-size: 0.76rem; font-weight: 600;
  }
  .lk-more:hover { color: var(--lk-fg); background: var(--lk-elevated); }

  /* ---- conversation ---- */
  .lk-convo {
    display: flex; flex-direction: column; gap: 9px;
    min-height: 60px; max-height: 320px; overflow-y: auto; padding-right: 2px;
    scrollbar-width: thin;
  }
  .lk-empty {
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    color: var(--lk-muted); font-size: 0.85rem; padding: 22px 12px; --mdc-icon-size: 22px;
  }
  .lk-msg { display: flex; animation: lk-rise .22s ease both; }
  .lk-msg[data-role="user"] { justify-content: flex-end; }
  .lk-bubble {
    max-width: 82%; padding: 8px 12px; border-radius: 15px; font-size: 0.9rem; line-height: 1.4;
    white-space: pre-wrap; word-break: break-word;
  }
  .lk-msg[data-role="user"] .lk-bubble {
    background: var(--lk-accent); color: var(--lk-on-accent); border-bottom-right-radius: 5px;
  }
  .lk-msg[data-role="agent"] .lk-bubble {
    background: var(--lk-elevated); color: var(--lk-fg); border-bottom-left-radius: 5px;
  }
  .lk-act {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 7px;
    padding: 4px 11px 4px 9px; border-radius: 999px; font-size: 0.78rem;
    border: 1px solid var(--lk-line); color: var(--lk-muted); background: var(--lk-surface);
    animation: lk-rise .22s ease both; --mdc-icon-size: 14px; max-width: 100%;
  }
  .lk-act[data-kind="action"] {
    color: var(--lk-fg);
    border-color: color-mix(in srgb, var(--lk-accent) 35%, transparent);
    background: color-mix(in srgb, var(--lk-accent) 9%, var(--lk-surface));
  }
  .lk-act-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-act-target { color: var(--lk-muted); }
  .lk-act[data-kind="action"] .lk-act-target { color: var(--lk-fg); font-weight: 600; }
  .lk-act-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--lk-muted); }
  .lk-act[data-status="running"] .lk-act-dot { background: var(--lk-accent); animation: lk-blink 1s ease-in-out infinite; }
  .lk-act[data-status="done"] .lk-act-dot { background: var(--lk-ok); }
  .lk-act[data-status="error"] .lk-act-dot, .lk-act[data-status="cancelled"] .lk-act-dot { background: var(--lk-danger); }
  @keyframes lk-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes lk-blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

  /* ---- composer ---- */
  .lk-composer { display: flex; align-items: flex-end; gap: 8px; }
  .lk-input-row {
    flex: 1; display: flex; align-items: flex-end; gap: 6px;
    padding: 5px 5px 5px 14px; border-radius: 22px;
    border: 1px solid var(--lk-line); background: var(--lk-surface);
  }
  .lk-input-row:focus-within { border-color: color-mix(in srgb, var(--lk-accent) 55%, var(--lk-line)); }
  .lk-input {
    flex: 1; border: none; background: transparent; color: var(--lk-fg); resize: none;
    font: inherit; font-size: 0.9rem; line-height: 1.4; max-height: 96px; padding: 7px 0;
  }
  .lk-input:focus { outline: none; }
  .lk-input::placeholder { color: var(--lk-muted); }

  .lk-round {
    flex: none; cursor: pointer; width: 38px; height: 38px; border-radius: 50%; --mdc-icon-size: 20px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--lk-line); background: var(--lk-elevated); color: var(--lk-fg);
    transition: background-color .15s, color .15s, border-color .15s, transform .06s;
  }
  .lk-round:hover { border-color: color-mix(in srgb, var(--lk-fg) 30%, var(--lk-line)); }
  .lk-round:active { transform: scale(.94); }
  .lk-round[data-on="1"], .lk-round--accent {
    background: var(--lk-accent); color: var(--lk-on-accent); border-color: transparent;
  }
  .lk-round--ghost { background: transparent; border-color: transparent; color: var(--lk-muted); }
  .lk-round--ghost:hover { background: var(--lk-elevated); color: var(--lk-fg); }
  .lk-ptt[data-holding="1"] {
    background: var(--lk-danger); color: #fff; border-color: transparent;
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--lk-danger) 22%, transparent);
  }
  .lk-end { width: 38px; height: 38px; }

  .lk-start {
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 13px; border: none; border-radius: 16px; --mdc-icon-size: 20px;
    font-size: 0.95rem; font-weight: 650; letter-spacing: -0.01em;
    background: var(--lk-accent); color: var(--lk-on-accent);
    box-shadow: 0 10px 26px -14px color-mix(in srgb, var(--lk-accent) 90%, transparent);
    transition: transform .06s, opacity .2s;
  }
  .lk-start:hover { opacity: .94; }
  .lk-start:active { transform: scale(.985); }
  .lk-start:disabled { opacity: .5; cursor: default; box-shadow: none; }

  /* ---- history ---- */
  .lk-history { display: flex; flex-direction: column; gap: 12px; }
  .lk-history-head { display: flex; align-items: center; gap: 8px; }
  .lk-h2 { font-size: 0.95rem; font-weight: 650; color: var(--lk-fg); }
  .lk-spacer { margin-left: auto; }
  .lk-session-list { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; }
  .lk-session {
    text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
    padding: 11px 13px; border-radius: 13px; border: 1px solid var(--lk-line);
    background: var(--lk-surface); color: var(--lk-fg);
    transition: border-color .15s, background-color .15s;
  }
  .lk-session:hover { border-color: color-mix(in srgb, var(--lk-fg) 28%, var(--lk-line)); background: var(--lk-elevated); }
  .lk-session-summary { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-session-meta {
    display: flex; justify-content: space-between; gap: 8px;
    font-family: var(--lk-mono); font-size: 0.68rem; color: var(--lk-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .lk-orb-core, .lk-orb::before, .lk-act-dot, .lk-msg, .lk-act { animation: none !important; }
  }
`;
