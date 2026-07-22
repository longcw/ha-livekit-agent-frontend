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
    --lk-h: 540px;
    display: block;
  }
  * { box-sizing: border-box; }
  button { font-family: inherit; color: inherit; }

  ha-card {
    position: relative;
    /* Content-sized: shrinks to fit (idle = just header + tiles + composer, no dead space)
       and grows with the conversation up to the cap, then the timeline scrolls inside. */
    height: auto;
    max-height: min(var(--lk-h), calc(100dvh - 148px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
    font-family: var(--lk-sans);
    color: var(--lk-fg);
    -webkit-font-smoothing: antialiased;
  }
  /* Schedules tab / editor: a definite height (not content-sized) so the list scrolls in a
     stable viewport and the editor sheet has room. */
  ha-card[data-tall="1"] {
    height: min(var(--lk-h), calc(100dvh - 148px));
  }

  /* ---- header ---- */
  .lk-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px 7px; flex: none; }
  .lk-titlewrap { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .lk-title { min-width: 0; font-size: 1.04rem; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* live agent phase under the title: connecting / connected / listening / thinking / speaking */
  .lk-state { font-family: var(--lk-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--lk-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    transition: color .2s; }
  .lk-state[data-state="listening"], .lk-state[data-state="speaking"], .lk-state[data-state="thinking"] { color: var(--lk-accent); }

  /* Auto | Manual segmented toggle (shown when connected, in place of the status pill) */
  .lk-modeswitch { flex: none; display: inline-flex; gap: 2px; padding: 2px;
    border-radius: 999px; border: 1px solid var(--lk-line); background: var(--lk-elevated); }
  .lk-modeswitch button { border: none; cursor: pointer; background: transparent; color: var(--lk-muted);
    font-family: var(--lk-sans); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.01em;
    padding: 4px 8px; border-radius: 999px; transition: background-color .15s, color .15s; }
  .lk-modeswitch button[data-on="1"] { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-modeswitch button:not([data-on="1"]):hover { color: var(--lk-fg); }

  .lk-iconbtn {
    flex: none; width: 32px; height: 32px; border-radius: 10px; border: none; cursor: pointer;
    background: transparent; color: var(--lk-muted); display: grid; place-items: center; --mdc-icon-size: 19px;
  }
  .lk-iconbtn:hover { background: var(--lk-elevated); color: var(--lk-fg); }
  .lk-iconbtn[data-on="1"] { color: var(--lk-accent); }

  /* ---- voice orb ---- */
  .lk-orb { position: relative; width: 26px; height: 26px; flex: none; display: grid; place-items: center; }
  .lk-orb::before { content: ""; position: absolute; inset: -4px; border-radius: 50%; opacity: 0;
    background: radial-gradient(circle, color-mix(in srgb, var(--lk-accent) 48%, transparent), transparent 68%); }
  .lk-orb-core { width: 13px; height: 13px; border-radius: 50%;
    background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--lk-accent) 55%, #fff), var(--lk-accent));
    box-shadow: 0 0 12px -1px color-mix(in srgb, var(--lk-accent) 70%, transparent); }
  .lk-orb[data-state="idle"] .lk-orb-core { background: var(--lk-muted); box-shadow: none; }
  /* dozing: connected but STT torn down to save cost — alive (slow, faint breathe) but not listening */
  .lk-orb[data-state="dozing"] .lk-orb-core { background: var(--lk-muted); box-shadow: none; opacity: .55;
    animation: lk-breathe 3.6s ease-in-out infinite; }
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
  .lk-tiles { flex: none; display: flex; gap: 8px; overflow-x: auto; padding: 5px 14px 9px;
    scroll-snap-type: x proximity; scrollbar-width: none; }
  .lk-tiles::-webkit-scrollbar { display: none; }
  .lk-tile {
    flex: 0 0 104px; scroll-snap-align: start;
    text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px;
    padding: 9px; border-radius: 13px; overflow: hidden;
    border: 1px solid var(--lk-line); background: var(--lk-surface); color: var(--lk-fg);
    transition: border-color .18s, background-color .18s, box-shadow .18s, transform .06s;
  }
  .lk-tile:hover { border-color: color-mix(in srgb, var(--lk-fg) 26%, var(--lk-line)); }
  .lk-tile:active { transform: scale(.97); }
  .lk-tile[data-active="1"] { border-color: transparent;
    background: color-mix(in srgb, var(--lk-accent) 14%, var(--lk-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lk-accent) 40%, transparent); }
  .lk-tile[data-touched="1"] { border-color: transparent;
    background: color-mix(in srgb, var(--lk-accent) 14%, var(--lk-surface));
    box-shadow: inset 0 0 0 2px var(--lk-accent); }
  .lk-tile-icon { --mdc-icon-size: 16px; width: 27px; height: 27px; border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--lk-elevated); color: var(--lk-muted); transition: background-color .18s, color .18s; }
  .lk-tile[data-active="1"] .lk-tile-icon { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-tile-state { font-family: var(--lk-mono); font-size: 0.9rem; font-weight: 600; line-height: 1.05;
    letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-tile-name { font-size: 0.72rem; line-height: 1.2; color: var(--lk-muted);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .lk-more { align-self: center; cursor: pointer; --mdc-icon-size: 16px; display: inline-flex; align-items: center; gap: 3px;
    background: transparent; border: none; padding: 3px 10px; border-radius: 999px; color: var(--lk-muted); font-size: 0.8rem; font-weight: 600; }
  .lk-more:hover { color: var(--lk-fg); background: var(--lk-elevated); }

  /* ---- scheduled tasks (vertical list, above the conversation) ---- */
  .lk-sched { flex: none; display: flex; flex-direction: column; gap: 6px; padding: 10px 14px 8px; }
  .lk-sched-head { display: inline-flex; align-items: center; gap: 6px; --mdc-icon-size: 14px;
    font-family: var(--lk-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--lk-muted); }
  .lk-sched-item { display: flex; align-items: center; gap: 10px; padding: 8px 11px; border-radius: 12px;
    border: 1px solid var(--lk-line); background: var(--lk-surface); animation: lk-rise .22s ease both; }
  .lk-sched-item[data-fresh="1"] { border-color: transparent;
    background: color-mix(in srgb, var(--lk-accent) 12%, var(--lk-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lk-accent) 42%, transparent); }
  .lk-sched-icon { flex: none; --mdc-icon-size: 16px; width: 30px; height: 30px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--lk-elevated); color: var(--lk-muted); }
  .lk-sched-item[data-fresh="1"] .lk-sched-icon { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-sched-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lk-sched-desc { font-size: 0.9rem; font-weight: 600; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-sched-when { font-family: var(--lk-mono); font-size: 0.72rem; color: var(--lk-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-sched-badge { flex: none; font-size: 0.64rem; font-weight: 700; letter-spacing: 0.02em;
    text-transform: uppercase; padding: 3px 8px; border-radius: 999px;
    color: var(--lk-accent); background: color-mix(in srgb, var(--lk-accent) 14%, transparent); }
  .lk-sched-more { align-self: flex-start; cursor: pointer; border: none; background: transparent; color: var(--lk-muted);
    font-family: var(--lk-sans); font-size: 0.76rem; font-weight: 600; padding: 4px 8px; border-radius: 8px; }
  .lk-sched-more:hover { color: var(--lk-fg); background: var(--lk-elevated); }

  /* ---- tabs (Chat | Schedules) ---- */
  .lk-tabs { flex: none; display: flex; gap: 4px; padding: 2px 14px 0; border-bottom: 1px solid var(--lk-line); }
  .lk-tab { flex: 0 0 auto; border: none; background: transparent; cursor: pointer; color: var(--lk-muted);
    font-family: var(--lk-sans); font-size: 0.82rem; font-weight: 700; padding: 8px 10px 9px;
    border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s; }
  .lk-tab[data-on="1"] { color: var(--lk-fg); border-bottom-color: var(--lk-accent); }
  .lk-tab:not([data-on="1"]):hover { color: var(--lk-fg); }

  /* ---- schedules tab (search + full list) ---- */
  .lk-schedtab { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .lk-search { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 14px 8px;
    --mdc-icon-size: 18px; color: var(--lk-muted); }
  .lk-search-in { flex: 1; min-width: 0; height: 34px; border: 1px solid var(--lk-line); background: var(--lk-surface);
    border-radius: 10px; padding: 0 12px; color: var(--lk-fg); font: inherit; font-size: 0.9rem; }
  .lk-search-in:focus { outline: none; border-color: color-mix(in srgb, var(--lk-accent) 52%, var(--lk-line)); }
  .lk-search-in::placeholder { color: var(--lk-muted); }
  .lk-tasklist { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column;
    gap: 6px; padding: 4px 14px 14px; scrollbar-width: thin; }
  .lk-tasks-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px;
    color: var(--lk-muted); font-size: 0.85rem; text-align: center; max-width: 250px; --mdc-icon-size: 22px; padding: 26px 0; }
  .lk-taskrow { display: flex; align-items: center;
    border-radius: 12px; border: 1px solid var(--lk-line); background: var(--lk-surface); color: var(--lk-fg);
    animation: lk-rise .2s ease both; transition: border-color .15s, background-color .15s; }
  .lk-taskrow:hover { border-color: color-mix(in srgb, var(--lk-fg) 22%, var(--lk-line)); }
  .lk-taskrow[data-fresh="1"] { border-color: transparent; background: color-mix(in srgb, var(--lk-accent) 12%, var(--lk-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lk-accent) 42%, transparent); }
  .lk-taskrow[data-status="cancelled"], .lk-taskrow[data-status="completed"], .lk-taskrow[data-status="missed"] { opacity: .62; }
  /* clickable body (opens the editor); the action buttons live outside it so they aren't nested in a button */
  .lk-taskrow-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; text-align: left;
    cursor: pointer; border: none; background: transparent; color: inherit; padding: 9px 4px 9px 11px; }
  .lk-taskrow-acts { flex: none; display: flex; align-items: center; gap: 2px; padding: 0 6px 0 2px; }
  .lk-taskrow-acts .lk-iconbtn { width: 30px; height: 30px; --mdc-icon-size: 17px; }
  .lk-taskrow-del:hover { color: var(--lk-danger); background: color-mix(in srgb, var(--lk-danger) 14%, transparent); }
  .lk-taskrow-del[data-armed="1"], .lk-taskrow-del[data-armed="1"]:hover { color: var(--lk-on-accent); background: var(--lk-danger); }
  .lk-taskrow-icon { flex: none; --mdc-icon-size: 16px; width: 30px; height: 30px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center; background: var(--lk-elevated); color: var(--lk-muted); }
  .lk-taskrow[data-status="scheduled"] .lk-taskrow-icon { color: var(--lk-accent); }
  .lk-taskrow-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lk-taskrow-desc { font-size: 0.9rem; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-taskrow-when { font-family: var(--lk-mono); font-size: 0.7rem; color: var(--lk-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-taskrow-exec { font-size: 0.75rem; color: var(--lk-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lk-taskrow-tags { flex: none; display: flex; align-items: center; gap: 5px; --mdc-icon-size: 13px; }
  .lk-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.03em; padding: 3px 7px; border-radius: 999px; color: var(--lk-accent);
    background: color-mix(in srgb, var(--lk-accent) 14%, transparent); }
  .lk-tag-muted { color: var(--lk-muted); background: var(--lk-elevated); }

  /* ---- task editor (slide-up sheet) ---- */
  .lk-editor { position: absolute; inset: 0; z-index: 10; display: flex; align-items: flex-end; justify-content: center;
    background: color-mix(in srgb, #000 46%, transparent); animation: lk-fade .15s ease both; }
  @keyframes lk-fade { from { opacity: 0; } to { opacity: 1; } }
  .lk-editor-panel { width: 100%; max-height: 100%; display: flex; flex-direction: column; background: var(--lk-surface);
    border-top-left-radius: var(--ha-card-border-radius, 12px); border-top-right-radius: var(--ha-card-border-radius, 12px);
    border-top: 1px solid var(--lk-line);
    box-shadow: 0 -14px 40px -18px #000; animation: lk-rise .2s ease both; }
  .lk-editor-head { flex: none; display: flex; align-items: center; justify-content: space-between;
    padding: 11px 8px 8px 16px; font-weight: 700; font-size: 0.98rem; }
  /* overflow-x: hidden is required — with overflow-y:auto, overflow-x would otherwise compute
     to 'auto', and iOS's datetime-local input (intrinsically wide) then scrolls it sideways. */
  .lk-editor-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 4px 16px 8px;
    display: flex; flex-direction: column; gap: 13px; scrollbar-width: thin; }
  .lk-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .lk-field-label { font-family: var(--lk-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--lk-muted); }
  /* min-width:0 lets the input shrink to the container (flex items default to min-width:auto =
     content width, which iOS date/time inputs report far wider than the panel). */
  .lk-in { width: 100%; min-width: 0; max-width: 100%; border: 1px solid var(--lk-line);
    background: var(--lk-elevated); color: var(--lk-fg);
    border-radius: 10px; padding: 9px 11px; font: inherit; font-size: 0.9rem; }
  /* iOS gives datetime-local a wide native control that ignores width:100% (its right edge then
     spills out of the panel). Dropping the native appearance makes it a normal box that fits;
     tapping still opens the iOS date/time picker. */
  input.lk-in[type="datetime-local"] { -webkit-appearance: none; appearance: none;
    text-align: left; min-height: 38px; }
  .lk-in:focus { outline: none; border-color: color-mix(in srgb, var(--lk-accent) 52%, var(--lk-line)); }
  .lk-ta { resize: vertical; min-height: 38px; line-height: 1.35; }
  .lk-mono { font-family: var(--lk-mono); font-size: 0.82rem; }
  .lk-hint { font-family: var(--lk-mono); font-size: 0.64rem; color: var(--lk-muted); }
  .lk-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; border: 1px solid var(--lk-line);
    background: var(--lk-elevated); align-self: flex-start; }
  .lk-seg button { border: none; cursor: pointer; background: transparent; color: var(--lk-muted); font-family: var(--lk-sans);
    font-size: 0.76rem; font-weight: 700; padding: 5px 12px; border-radius: 8px; transition: background-color .15s, color .15s; }
  .lk-seg button[data-on="1"] { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-steps { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .lk-step { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px;
    border: 1px solid var(--lk-line); border-radius: 10px; background: var(--lk-elevated); }
  .lk-step-head { display: flex; align-items: center; gap: 2px; }
  .lk-step-num { font-family: var(--lk-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--lk-muted); }
  .lk-iconbtn:disabled { opacity: .3; cursor: default; background: transparent; }
  .lk-addstep { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; --mdc-icon-size: 15px;
    cursor: pointer; border: 1px dashed var(--lk-line); background: transparent; color: var(--lk-muted);
    border-radius: 9px; padding: 6px 10px; font-family: var(--lk-sans); font-size: 0.8rem; font-weight: 600; }
  .lk-addstep:hover { color: var(--lk-fg); border-color: color-mix(in srgb, var(--lk-fg) 22%, var(--lk-line)); }
  .lk-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
  .lk-switch input { width: 18px; height: 18px; accent-color: var(--lk-accent); }
  .lk-editor-error { color: var(--lk-danger); font-size: 0.8rem; font-weight: 600; }
  .lk-editor-actions { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid var(--lk-line); }
  .lk-spacer { flex: 1; }
  .lk-btn { border: 1px solid var(--lk-line); background: var(--lk-elevated); color: var(--lk-fg); cursor: pointer;
    font-family: var(--lk-sans); font-size: 0.86rem; font-weight: 700; padding: 9px 15px; border-radius: 11px;
    transition: transform .06s, opacity .15s, background-color .15s; }
  .lk-btn:active { transform: scale(.97); }
  .lk-btn:disabled { opacity: .5; cursor: default; }
  .lk-btn-accent { background: var(--lk-accent); color: var(--lk-on-accent); border-color: transparent; }
  .lk-btn-danger { background: transparent; border-color: transparent; color: var(--lk-danger); }
  .lk-btn-danger:hover { background: color-mix(in srgb, var(--lk-danger) 14%, transparent); }

  /* ---- conversation (scrolls; dock floats over its bottom) ---- */
  /* min-height:0 lets the timeline shrink to scroll once the card hits its max-height; the
     bottom padding reserves room for the floating dock so short content never sits under it. */
  .lk-convo { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 14px calc(var(--lk-dock-h, 100px) + 10px);
    display: flex; flex-direction: column; gap: 9px; scrollbar-width: thin; }
  .lk-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    color: var(--lk-muted); font-size: 0.84rem; line-height: 1.4; max-width: 220px; --mdc-icon-size: 21px; }
  .lk-msg { display: flex; animation: lk-rise .22s ease both; }
  .lk-msg[data-role="user"] { justify-content: flex-end; }
  .lk-bubble { max-width: 84%; padding: 8px 13px; border-radius: 16px; font-size: 0.92rem; line-height: 1.4;
    white-space: pre-wrap; word-break: break-word; }
  .lk-msg[data-role="user"] .lk-bubble { background: var(--lk-accent); color: var(--lk-on-accent); border-bottom-right-radius: 5px; }
  .lk-msg[data-role="agent"] .lk-bubble { background: var(--lk-elevated); color: var(--lk-fg); border-bottom-left-radius: 5px; }
  .lk-act { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; max-width: 100%;
    padding: 5px 12px 5px 9px; border-radius: 999px; font-size: 0.8rem; --mdc-icon-size: 14px;
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
  .lk-dock { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 12px 11px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
    background: linear-gradient(to top, var(--lk-surface) 46%, color-mix(in srgb, var(--lk-surface) 82%, transparent) 74%, transparent); }
  .lk-dock > * { pointer-events: auto; }

  /* ---- one-tap quick replies the agent offers, above the composer ---- */
  .lk-suggest { width: 100%; display: flex; flex-wrap: wrap; gap: 7px; justify-content: flex-end; }
  .lk-chip { flex: 0 0 auto; border-radius: 16px; padding: 6px 14px; cursor: pointer;
    font: inherit; font-size: 0.85rem; font-weight: 600; line-height: 1.2; color: var(--lk-fg);
    background: var(--lk-surface); border: 1px solid color-mix(in srgb, var(--lk-accent) 42%, var(--lk-line));
    transition: background-color .15s, border-color .15s, transform .06s; }
  .lk-chip:hover { background: color-mix(in srgb, var(--lk-accent) 12%, var(--lk-surface));
    border-color: color-mix(in srgb, var(--lk-accent) 60%, var(--lk-line)); }
  .lk-chip:active { transform: scale(.95); }
  .lk-chip:disabled { cursor: default; opacity: .55; }

  /* ---- manual turn: the composer becomes a listening bar (Cancel · meter · Send) ---- */
  .lk-listen { width: 100%; min-height: 52px; display: flex; align-items: center; gap: 8px;
    padding: 7px 7px 7px 10px; border-radius: 26px;
    background: color-mix(in srgb, var(--lk-accent) 12%, var(--lk-surface));
    border: 1px solid color-mix(in srgb, var(--lk-accent) 42%, transparent);
    box-shadow: 0 14px 36px -18px color-mix(in srgb, var(--lk-accent) 85%, transparent); }
  .lk-listen-cancel { flex: none; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
    --mdc-icon-size: 20px; display: grid; place-items: center; background: transparent; color: var(--lk-muted);
    transition: background-color .15s, color .15s, transform .06s; }
  .lk-listen-cancel:hover { color: var(--lk-danger); background: color-mix(in srgb, var(--lk-danger) 15%, transparent); }
  .lk-listen-cancel:active { transform: scale(.92); }
  .lk-listen-mid { flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px; padding-left: 4px; }
  .lk-listen-label { font-size: 0.85rem; font-weight: 600; color: var(--lk-fg); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  /* live input meter — the card's voice signature, echoing the orb */
  .lk-eq { flex: none; display: inline-flex; align-items: center; gap: 3px; height: 20px; }
  .lk-eq i { width: 3px; height: 18px; border-radius: 2px; background: var(--lk-accent);
    transform: scaleY(.28); transform-origin: center; animation: lk-eq 1s ease-in-out infinite; }
  .lk-eq i:nth-child(1) { animation-delay: -.9s; }
  .lk-eq i:nth-child(2) { animation-delay: -.5s; }
  .lk-eq i:nth-child(3) { animation-delay: -.2s; }
  .lk-eq i:nth-child(4) { animation-delay: -.7s; }
  .lk-eq i:nth-child(5) { animation-delay: -.4s; }
  @keyframes lk-eq { 0%,100% { transform: scaleY(.28); } 50% { transform: scaleY(1); } }
  /* Cold-start spinner shown while the mic is being acquired (App.tsx openTurn). Uses
     currentColor: accent in the listening bar (matching the EQ it replaces), on-accent on the
     round auto-resume button. */
  .lk-spin { flex: none; box-sizing: border-box; width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid color-mix(in srgb, currentColor 26%, transparent); border-top-color: currentColor;
    animation: lk-spin .7s linear infinite; }
  .lk-listen-mid .lk-spin { color: var(--lk-accent); }
  @keyframes lk-spin { to { transform: rotate(360deg); } }
  .lk-listen-send { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 40px; padding: 0 14px 0 16px;
    border: none; border-radius: 20px; cursor: pointer; --mdc-icon-size: 18px;
    font-family: var(--lk-sans); font-size: 0.9rem; font-weight: 700; letter-spacing: -0.01em;
    background: var(--lk-accent); color: var(--lk-on-accent); transition: transform .06s, opacity .15s; }
  .lk-listen-send:hover { opacity: .95; }
  .lk-listen-send:active { transform: scale(.96); }
  .lk-listen-send:disabled { opacity: .45; cursor: default; }
  .lk-listen-send:disabled:active { transform: none; }

  .lk-bar { width: 100%; height: 48px; display: flex; align-items: center; gap: 7px; padding: 0 6px 0 15px;
    border-radius: 24px; border: 1px solid var(--lk-line); background: var(--lk-surface);
    box-shadow: 0 12px 30px -20px #000; }
  .lk-bar:focus-within { border-color: color-mix(in srgb, var(--lk-accent) 52%, var(--lk-line)); }
  .lk-bar[data-paused="1"] { border-style: dashed; border-color: color-mix(in srgb, var(--lk-muted) 45%, var(--lk-line)); }
  .lk-input { flex: 1; min-width: 0; height: 100%; border: none; background: transparent; color: var(--lk-fg);
    font: inherit; font-size: 1rem; padding: 0; }
  .lk-input:focus { outline: none; }
  .lk-input::placeholder { color: var(--lk-muted); }
  .lk-send { flex: none; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; --mdc-icon-size: 20px;
    display: grid; place-items: center; background: var(--lk-elevated); color: var(--lk-fg); transition: background-color .15s, transform .06s; }
  .lk-send:active { transform: scale(.93); }
  .lk-send[data-on="1"], .lk-send--accent { background: var(--lk-accent); color: var(--lk-on-accent); }
  .lk-send:disabled { cursor: default; }
  .lk-send:disabled:active { transform: none; }

  .lk-start { cursor: pointer; width: 100%; padding: 13px; border: none; border-radius: 16px; --mdc-icon-size: 20px;
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    font-family: var(--lk-sans); font-size: 0.96rem; font-weight: 700; letter-spacing: -0.01em;
    background: var(--lk-accent); color: var(--lk-on-accent);
    box-shadow: 0 14px 34px -18px color-mix(in srgb, var(--lk-accent) 90%, transparent); transition: transform .06s, opacity .2s; }
  .lk-start:hover { opacity: .95; }
  .lk-start:active { transform: scale(.985); }
  .lk-start:disabled { opacity: .5; cursor: default; box-shadow: none; }

  @media (prefers-reduced-motion: reduce) {
    .lk-orb-core, .lk-orb::before, .lk-act-dot, .lk-msg, .lk-act { animation: none !important; }
    .lk-eq i { animation: none !important; transform: scaleY(.6); }
  }
`;
