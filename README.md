# LiveKit Voice Assistant for Home Assistant

A Home Assistant **custom integration + Lovelace card**. The card runs your LiveKit voice
agent *inside* the HA dashboard and behaves like a native card: **live device tiles you can
tap to control**, plus voice, text chat, a transcript, and the agent's tool-call status.

The voice **worker** — the agent brain (STT / LLM / TTS + Home Assistant MCP) — lives in
the companion repo **[home-assistant-mcp-agent](https://github.com/longcw/home-assistant-mcp-agent)**
and runs unchanged. This repo is the HA-side glue: it mints LiveKit tokens for logged-in
Home Assistant users and serves the card that runs the voice session in the HA frontend.

## What the card does

- **Native device tiles from `hass.states`** — live status, **tap to toggle**, long-press /
  right-click opens HA's native more-info dialog. Tiles update themselves via `hass`.
- **Voice** — push-to-talk or auto turn detection. STT starts **off** and only spins up for
  an actual turn (then back down when you go idle), so a card idling on a dashboard costs
  nothing beyond the worker connection.
- **Text chat** — always available and needs no STT, so the card works as a pure text chat.
- **Speaker toggle** — turn the agent's spoken (TTS) replies on/off from the header; **off by
  default** (text-only).
- **Transcript** — SDK-managed, so interim speech is replaced by the final text (no dupes).
- **Tool-call status** — a compact line for what the agent is doing.

## Architecture

```
LiveKit worker  (companion repo: home-assistant-mcp-agent) — UNCHANGED
  ├─ talks to Home Assistant over MCP  → voice control ("turn on the light")
  └─ streams tool-execution events on the "ha.tool_call" data channel

custom_components/livekit_voice/  (this repo — thin glue integration)
  ├─ token.py  → POST /api/livekit_voice/token: mints a LiveKit token for the
  │              logged-in HA user + explicitly dispatches the worker (agent_name)
  └─ __init__.py → serves the built card and registers it as a frontend module

card/  (React + @livekit/components-react, bundled with Vite → a single ESM web component)
  ├─ mounts React in a shadow root, given HA's `hass` object
  ├─ device tiles from hass.states: tap = hass.callService, long-press = hass-more-info
  └─ voice / chat / transcript / tool status via @livekit/components-react
```

Two independent control paths that both end at HA and reflect back into the card:
**voice → worker → MCP → HA**, and **tap → card → `hass.callService` → HA**.

## Install (HACS)

1. In HACS, open the **⋮** menu (top right) → **Custom repositories**. Paste
   `https://github.com/longcw/ha-livekit-agent-frontend`, category **Integration**, → **Add**.
2. Find **LiveKit Voice Assistant** in HACS → **Download** → **Restart Home Assistant**.
3. Settings → Devices & Services → **Add Integration** → “LiveKit Voice Assistant”, then:

   | Field | Value |
   |---|---|
   | LiveKit server URL | `wss://your-livekit-host` |
   | LiveKit API key / secret | your LiveKit project credentials |
   | Agent name | `ha-agent` (must match `AGENT_NAME` in the worker's `agent/agent.py`) |

4. Make sure the **worker** is running (companion repo) and connected to the same LiveKit
   project.
5. Add the card to a dashboard (Edit dashboard → Add card → “LiveKit Voice Assistant”, or
   in YAML — see options below).
6. Open the dashboard **over HTTPS** and tap **Start voice**.

When a new version is released, HACS offers the update; restart HA and hard-refresh the
dashboard to pick up the new card.

## Card options

```yaml
type: custom:livekit-voice-card
title: Voice Assistant        # optional header title
input_mode: push_to_talk      # push_to_talk (default) | auto
audio_output: false           # default false: agent replies in text only (toggle in the header)
start_on_connect: false       # default false: stay dormant (no STT) until you tap to talk
auto_connect: false           # default false: stay static until the first send/speak, then connect lazily
height: 720                   # card height in px (default 720; capped to the viewport)
areas:                        # optional: show all entities in these areas as tiles
  - Living Room
  - 主卧
entities:                     # optional: always show these specific entities
  - light.study_spotlight
  - climate.bedroom_ac
follow_agent: true            # default true: also surface tiles for areas the agent looks at
```

All fields are optional. **By default the card is text-only and dormant**: it stays static
until you send or speak, then connects with STT and TTS off, so it's free to leave on any
dashboard. Tap the mic to talk — which spins STT up just for that turn and tears it back down once you're idle — or flip
the header speaker to hear replies. Set `audio_output: true` and/or `start_on_connect: true`
to speak and start listening the moment it connects; `input_mode: auto` makes it hands-free.
`areas`/`entities` pin a fixed set of tiles that are always visible (like any native HA card).

## Why tiles render by `entity_id`/area, not by device name

Matching the worker's spoken device *names* back to entities is unreliable in a typical
setup: registry aliases are often absent, one device name can map to many entities
(multi-gang switches, or climate devices that also expose a `switch`/`light`), and real
`friendly_name`s carry channel suffixes. The card renders from `hass.states` keyed by
`entity_id`, **scoped by area** via HA's own area registry. State stays correct for free:
HA pushes state changes into the card's `hass` object, so tiles update themselves.

## Roadmap

- ✅ Voice (push-to-talk / auto), transcript, agent state.
- ✅ Native device tiles from `hass.states` (tap-to-toggle, more-info), text chat, tool status.
- ⏳ Per-device highlight of exactly what the agent just controlled.
- ⏳ Voice-driven navigation of your existing Lovelace views.

## Caveats

- **Microphone needs a secure context.** Open the dashboard over HTTPS (or `localhost`). A
  LAN-IP `http://…:8123` origin cannot use the mic.
- **Reload requires a restart.** HA has no runtime unregister for HTTP views / static
  paths / frontend modules, so reconfiguring updates the token config live, but fully
  removing the integration needs a restart.

## Manual install (without HACS)

The built card bundle is committed, so no Node toolchain is needed on the HA host — just
copy the integration into your HA config's `custom_components/` and restart:

```bash
rsync -a custom_components/livekit_voice/ \
  <user>@<your-ha-host>:/config/custom_components/livekit_voice/   # adjust to your config path
```

## Development

Card source is `card/src/` (React + TypeScript). CI rebuilds and commits the bundle on
push to `main`, and cuts a GitHub release on a `v*` tag; to build locally:

```bash
cd card
pnpm install
pnpm build     # → ../custom_components/livekit_voice/frontend/livekit-voice-card.js
pnpm watch     # rebuild on change
```

Commit the rebuilt bundle so HACS / manual installs serve it directly. The integration
Python is in `custom_components/livekit_voice/` (`token.py` = token endpoint, `__init__.py`
= setup/registration, `config_flow.py` = setup UI).
