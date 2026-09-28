"""A text turn's progress on a phone: a Live Activity while it runs, the answer as a notification.

The worker reports each turn as ``start``, ``progress`` and ``final``. Running inside Home
Assistant, this view can read from the mobile_app integration whether the phone's Live
Activity for the tag is running, which the worker cannot see: it updates a running
activity, starts one otherwise, holds updates until the phone reports a new activity's
token (before that, mobile_app sends an update as another start), and gives the answer
notification a sound only when the activity cannot carry the answer.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.event import async_call_later
from homeassistant.util import slugify

from .const import DATA_PROGRESS, DOMAIN, PROGRESS_URL

_LOGGER = logging.getLogger(__name__)

# how long a start may take to report its token before its held update is dropped
SETTLE_TIMEOUT = 20.0
# the relay sends a given alert as is: title-only lands at full priority without a buzz
QUIET_ALERT = {"title": ""}


@dataclass
class _Activity:
    """What this view knows about one phone's activity for one tag."""

    # when a start was sent, until the phone reports the activity's token
    started_at: float | None = None
    # the latest update held back while that start settles: (message, title, data)
    held: tuple[str, str, dict[str, Any]] | None = None
    waiter: asyncio.Task[None] | None = None
    cancel_clear: CALLBACK_TYPE | None = None


def _webhook_id(hass: HomeAssistant, target: str) -> str | None:
    """The mobile_app registration a ``notify.mobile_app_<device>`` target sends to."""
    try:
        from homeassistant.components.mobile_app.notify import push_registrations

        for device_name, webhook_id in push_registrations(hass).items():
            if f"mobile_app_{slugify(device_name)}" == target:
                return webhook_id
    except Exception:  # noqa: BLE001 - mobile_app internals; unknown is handled
        _LOGGER.debug("could not look up the push registration", exc_info=True)
    return None


def _activity_running(hass: HomeAssistant, webhook_id: str | None, tag: str) -> bool | None:
    """Whether the phone holds a live activity for ``tag``; None when HA cannot tell.

    Reads mobile_app's in-memory tokens, which the phone reports when an activity starts
    and withdraws when it is dismissed. Not a public API, so any change reads as None.
    """
    if webhook_id is None:
        return None
    try:
        tokens = hass.data["mobile_app"]["live_activity_tokens"]
        token = tokens.get(webhook_id, {}).get(tag)
    except (KeyError, TypeError, AttributeError):
        return None
    return bool(token) and token.get("expires_at", 0) > time.time()


class LiveKitProgressView(HomeAssistantView):
    """Take a turn's start / progress / final and show it on the phone."""

    url = PROGRESS_URL
    name = "api:livekit_voice:progress"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def post(self, request: web.Request) -> web.Response:
        try:
            body: dict[str, Any] = await request.json()
            phase = body["phase"]
            target = str(body["target"]).removeprefix("notify.")
            tag = str(body.get("tag") or "ha-text")
        except (ValueError, KeyError):
            return web.json_response({"detail": "phase and target are required"}, status=400)
        if phase not in ("start", "progress", "final"):
            return web.json_response({"detail": f"unknown phase {phase!r}"}, status=400)

        hass = self._hass
        activities: dict[tuple[str, str], _Activity] = hass.data[DOMAIN].setdefault(
            DATA_PROGRESS, {}
        )
        activity = activities.setdefault((target, tag), _Activity())
        webhook_id = _webhook_id(hass, target)
        running = _activity_running(hass, webhook_id, tag)
        if running:
            activity.started_at = None

        title = str(body.get("title") or "Home Assistant")
        data: dict[str, Any] = {
            "tag": tag,
            "live_update": True,
            "critical_text": str(body.get("status") or ""),
            "notification_icon": str(body.get("icon") or "mdi:robot"),
        }
        if body.get("url"):
            data["url"] = body["url"]
        message = str(body.get("message") or "…")[:250]

        if phase == "start":
            if activity.cancel_clear is not None:
                activity.cancel_clear()
                activity.cancel_clear = None
            activity.held = None
            # a start always alerts, whether it starts the activity or updates the running one
            await _notify(hass, target, message, title, data)
            if not running:
                activity.started_at = time.monotonic()
        else:
            # the answer alerts on a running activity, and then its notification stays quiet
            alerting = phase == "final" and running
            update = data if alerting else {**data, "alert": QUIET_ALERT}
            if running:
                await _notify(hass, target, message, title, update)
            elif activity.started_at is not None:
                activity.held = (message, title, update)
                if activity.waiter is None or activity.waiter.done():
                    activity.waiter = hass.async_create_background_task(
                        _send_when_running(hass, activity, target, webhook_id, tag),
                        "livekit_voice activity settle",
                    )
            # else no activity to update: it could not start, or was dismissed

        answer_sound = None
        if phase == "final":
            answer_sound = running is not True
            await _answer(hass, target, tag, body, sound=answer_sound)
            _schedule_clear(hass, activity, target, tag, float(body.get("clear_after") or 900))

        state = "running" if running else "starting" if activity.started_at else "none"
        if running is None:
            state = "unknown"
        return web.json_response({"activity": state, "answer_sound": answer_sound})


async def _notify(
    hass: HomeAssistant, target: str, message: str, title: str, data: dict[str, Any]
) -> None:
    await hass.services.async_call(
        "notify",
        target,
        {"message": message, "title": title, "data": data},
        blocking=True,
    )


async def _send_when_running(
    hass: HomeAssistant, activity: _Activity, target: str, webhook_id: str | None, tag: str
) -> None:
    """Send the held update once the phone reports the new activity's token."""
    started_at = activity.started_at or time.monotonic()
    while time.monotonic() - started_at < SETTLE_TIMEOUT:
        if _activity_running(hass, webhook_id, tag):
            activity.started_at = None
            if activity.held is not None:
                message, title, data = activity.held
                activity.held = None
                await _notify(hass, target, message, title, data)
            return
        await asyncio.sleep(0.5)
    _LOGGER.debug("the activity %s on %s never reported a token", tag, target)
    activity.started_at = None
    activity.held = None


async def _answer(
    hass: HomeAssistant, target: str, tag: str, body: dict[str, Any], *, sound: bool
) -> None:
    """The answer as a regular notification, replacing the last so it pops."""
    answer_tag = f"{tag}-answer"
    await _notify(hass, target, "clear_notification", "", {"tag": answer_tag})
    data: dict[str, Any] = {"tag": answer_tag}
    if body.get("url"):
        data["url"] = body["url"]
    if body.get("actions"):
        data["actions"] = body["actions"]
    if not sound:
        data["push"] = {"sound": "none"}
    await _notify(
        hass,
        target,
        str(body.get("answer") or "Done."),
        str(body.get("question") or ""),
        data,
    )


def _schedule_clear(
    hass: HomeAssistant, activity: _Activity, target: str, tag: str, delay: float
) -> None:
    if activity.cancel_clear is not None:
        activity.cancel_clear()

    async def _clear(_now: Any) -> None:
        activity.cancel_clear = None
        activity.started_at = None
        await _notify(hass, target, "clear_notification", "", {"tag": tag})

    activity.cancel_clear = async_call_later(hass, delay, _clear)
