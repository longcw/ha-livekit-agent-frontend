// Visual system. Derives from Home Assistant theme variables so it belongs in any theme,
// with a designed type pairing (Manrope + JetBrains Mono for device data) and one
// signature: the voice orb + a floating dock with a separate push-to-talk button.
import { FONT_CSS } from './font';

export const CARD_STYLES =
  FONT_CSS +
  `
  :host {
    --lk-accent: var(--primary-color, #4c8dff);
    --lk-on-accent: var(--text-primary-color, #fff);
    --lk-fg: var(--primary-text-color, #e9eaee);
    --lk-muted: var(--secondary-text-color, #9aa1ac);
    --lk-surface: var(--card-background-color, var(--ha-card-background, #16181d));
    --lk-elevated: var(--secondary-background-color, rgba(140,140,150,0.10));
    --lk-line: var(--divider-color, rgba(140,140,150,0.20));
    --lk-danger: var(--error-color, #f0483e);
    --lk-ok: var(--success-color, #21b573);
    --lk-sans: "Manrope", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --lk-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --lk-h: 560px;
    display: block;
  }
  * { box-sizing: border-box; }
  button { font-family: inherit; color: inherit; }

  ha-card {
    position: relative;
    height: var(--lk-h);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
    font-family: var(--lk-sans);
    color: var(--lk-fg);
    -webkit-font-smoothing: antialiased;
  }

  /* ---- header ---- */
  .lk-top { display: flex; align-items: center; gap: 11px; padding: 16px 16px 10px; flex: none; }
  .lk-title { font-size: 1.16rem; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-status {
    margin-left: auto; font-family: var(--lk-mono); font-size: 0.64rem; font-weight: 600;
    letter-spacing: 0.09em; text-transform: uppercase; color: var(--lk-muted);
    padding: 4px 9px; border-radius: 999px; border: 1px solid var(--lk-line);
  }
  .lk-status[data-live="1"] { color: var(--lk-accent); border-color: color-mix(in srgb, var(--lk-accent) 38%, transparent); }
  .lk-iconbtn {
    flex: none; width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer;
    background: transparent; color: var(--lk-muted); display: grid; place-items: center; --mdc-icon-size: 20px;
  }
  .lk-iconbtn:hover { background: var(--lk-elevated); color: var(--lk-fg); }

  /* ---- voice orb ---- */
  .lk-orb { position: relative; width: 26px; height: 26px; flex: none; display: grid; place-items: center; }
  .lk-orb::before { content: ""; position: absolute; inset: -4px; border-radius: 50%; opacity: 0;
    background: radial-gradient(circle, color-mix(in srgb, var(--lk-accent) 48%, transparent), transparent 68%); }
  .lk-orb-core { width: 13px; height: 13px; border-radius: 50%;
    background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--lk-accent) 55%, #fff), var(--lk-accent));
    box-shadow: 0 0 12px -1px color-mix(in srgb, var(--lk-accent) 70%, transparent); }
  .lk-orb[data-state="idle"] .lk-orb-core { background: var(--lk-muted); box-shadow: none; }
  .lk-orb[data-state="connecting"] .lk-orb-core { animation: lk-breathe 1.1s ease-in-out infinite; }
  .lk-orb[data-state="listening"] .lk-orb-core { animation: lk-breathe 2.4s ease-in-out infinite; }
  .lk-orb[data-state="listening"]::before { opacity: .7; animation: lk-halo 2.4s ease-in-out infinite; }
  .lk-orb[data-state="thinking"] .lk-orb-core { animation: lk-breathe .8s ease-in-out infinite; }
  .lk-orb[data-state="thinking"]::before { opacity: .5; animation: lk-halo .8s ease-in-out infinite; }
  .lk-orb[data-state="speaking"] .lk-orb-core { animation: lk-speak .5s ease-in-out infinite; }
  .lk-orb[data-state="speaking"]::before { opacity: .9; }
  @keyframes lk-breathe { 0%,100% { transform: scale(.82); } 50% { transform: scale(1.18); } }
  @keyframes lk-speak { 0%,100% { transform: scale(.78); } 50% { transform: scale(1.3); } }
  @keyframes lk-halo { 0%,100% { transform: scale(.9); opacity: .35; } 50% { transform: scale(1.3); opacity: .8; } }

  /* ---- device tiles (horizontal rail) ---- */
  .lk-devices { flex: none; }
  .lk-tiles { display: flex; gap: 9px; overflow-x: auto; padding: 6px 16px 10px;
    scroll-snap-type: x proximity; scrollbar-width: none; }
  .lk-tiles::-webkit-scrollbar { display: none; }
  .lk-tile {
    flex: 0 0 124px; scroll-snap-align: start;
    text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
    padding: 11px; border-radius: 16px; overflow: hidden;
    border: 1px solid var(--lk-line); background: var(--lk-surface); color: var(--lk-fg);
    transition: border-color .18s, background-color .18s, box-shadow .18s, transform .06s;
  }
  .lk-tile:hover { border-color: color-mix(in srgb, var(--lk-fg) 26%, var(--lk-line)); }
  .lk-tile:active { transform: scale(.97); }
  .lk-tile[data-active="1"] { border-color: transparent;
    background: color-mix(in srgb, var(--lk-accent) 14%, var(--lk-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lk-accent) 40%, transparent); }
  .lk-tile[data-touched="1"] { border-color: transparent;
    box-shadow: 0 0 0 2px var(--lk-accent), 0 12px 26px -16px color-mix(in srgb, var(--lk-accent) 90%, transparent); }
  .lk-tile-icon { --mdc-icon-size: 19px; width: 33px; height: 33px; border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--lk-elevated); color: var(--lk-muted); transition: background-color .18s, color .18s; }
  .lk-tile[data-active="1"] .lk-tile-icon { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-tile-state { font-family: var(--lk-mono); font-size: 1.02rem; font-weight: 600; line-height: 1.05;
    letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-tile-name { font-size: 0.78rem; line-height: 1.2; color: var(--lk-muted);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .lk-more { align-self: center; cursor: pointer; --mdc-icon-size: 16px; display: inline-flex; align-items: center; gap: 3px;
    background: transparent; border: none; padding: 3px 10px; border-radius: 999px; color: var(--lk-muted); font-size: 0.8rem; font-weight: 600; }
  .lk-more:hover { color: var(--lk-fg); background: var(--lk-elevated); }

  /* ---- conversation (scrolls; dock floats over its bottom) ---- */
  .lk-convo { flex: 1; overflow-y: auto; padding: 8px 16px calc(var(--lk-dock-h, 132px) + 12px);
    display: flex; flex-direction: column; gap: 11px; scrollbar-width: thin; }
  .lk-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    color: var(--lk-muted); font-size: 0.95rem; max-width: 240px; --mdc-icon-size: 26px; }
  .lk-msg { display: flex; animation: lk-rise .22s ease both; }
  .lk-msg[data-role="user"] { justify-content: flex-end; }
  .lk-bubble { max-width: 82%; padding: 10px 15px; border-radius: 19px; font-size: 1rem; line-height: 1.42;
    white-space: pre-wrap; word-break: break-word; }
  .lk-msg[data-role="user"] .lk-bubble { background: var(--lk-accent); color: var(--lk-on-accent); border-bottom-right-radius: 6px; }
  .lk-msg[data-role="agent"] .lk-bubble { background: var(--lk-elevated); color: var(--lk-fg); border-bottom-left-radius: 6px; }
  .lk-act { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
    padding: 6px 13px 6px 10px; border-radius: 999px; font-size: 0.86rem; --mdc-icon-size: 15px;
    border: 1px solid var(--lk-line); background: var(--lk-surface); color: var(--lk-muted); animation: lk-rise .22s ease both; }
  .lk-act[data-kind="action"] { color: var(--lk-fg);
    border-color: color-mix(in srgb, var(--lk-accent) 34%, transparent);
    background: color-mix(in srgb, var(--lk-accent) 9%, var(--lk-surface)); }
  .lk-act-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-act-target { color: var(--lk-muted); }
  .lk-act[data-kind="action"] .lk-act-target { color: var(--lk-fg); font-weight: 700; }
  .lk-act-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--lk-muted); }
  .lk-act[data-status="running"] .lk-act-dot { background: var(--lk-accent); animation: lk-blink 1s ease-in-out infinite; }
  .lk-act[data-status="done"] .lk-act-dot { background: var(--lk-ok); }
  .lk-act[data-status="error"] .lk-act-dot, .lk-act[data-status="cancelled"] .lk-act-dot { background: var(--lk-danger); }
  @keyframes lk-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  @keyframes lk-blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

  /* ---- floating dock ---- */
  .lk-dock { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 14px 13px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
    background: linear-gradient(to top, var(--lk-surface) 46%, color-mix(in srgb, var(--lk-surface) 82%, transparent) 74%, transparent); }
  .lk-dock > * { pointer-events: auto; }

  .lk-ptt-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .lk-ptt { width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer; --mdc-icon-size: 25px;
    display: grid; place-items: center; background: var(--lk-accent); color: var(--lk-on-accent);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--lk-accent) 14%, transparent), 0 14px 30px -16px color-mix(in srgb, var(--lk-accent) 90%, transparent);
    transition: transform .08s, box-shadow .15s; touch-action: none; -webkit-user-select: none; user-select: none; }
  .lk-ptt:active, .lk-ptt[data-holding="1"] { transform: scale(1.07);
    box-shadow: 0 0 0 11px color-mix(in srgb, var(--lk-accent) 20%, transparent), 0 16px 34px -14px var(--lk-accent); }
  .lk-ptt-hint { font-size: 0.72rem; font-weight: 600; color: var(--lk-muted); }

  .lk-bar { width: 100%; min-height: 50px; display: flex; align-items: center; gap: 7px; padding: 5px 5px 5px 15px;
    border-radius: 23px; border: 1px solid var(--lk-line); background: var(--lk-surface);
    box-shadow: 0 12px 30px -20px #000; }
  .lk-bar:focus-within { border-color: color-mix(in srgb, var(--lk-accent) 52%, var(--lk-line)); }
  .lk-input { flex: 1; border: none; background: transparent; color: var(--lk-fg); resize: none; font: inherit;
    font-size: 1rem; line-height: 1.4; max-height: 90px; padding: 6px 0; }
  .lk-input:focus { outline: none; }
  .lk-input::placeholder { color: var(--lk-muted); }
  .lk-send { flex: none; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; --mdc-icon-size: 20px;
    display: grid; place-items: center; background: var(--lk-elevated); color: var(--lk-fg); transition: background-color .15s, transform .06s; }
  .lk-send:active { transform: scale(.93); }
  .lk-send[data-on="1"], .lk-send--accent { background: var(--lk-accent); color: var(--lk-on-accent); }

  .lk-start { cursor: pointer; width: 100%; padding: 15px; border: none; border-radius: 18px; --mdc-icon-size: 21px;
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    font-family: var(--lk-sans); font-size: 1.02rem; font-weight: 700; letter-spacing: -0.01em;
    background: var(--lk-accent); color: var(--lk-on-accent);
    box-shadow: 0 14px 34px -18px color-mix(in srgb, var(--lk-accent) 90%, transparent); transition: transform .06s, opacity .2s; }
  .lk-start:hover { opacity: .95; }
  .lk-start:active { transform: scale(.985); }
  .lk-start:disabled { opacity: .5; cursor: default; box-shadow: none; }

  @media (prefers-reduced-motion: reduce) {
    .lk-orb-core, .lk-orb::before, .lk-act-dot, .lk-msg, .lk-act { animation: none !important; }
  }
`;
