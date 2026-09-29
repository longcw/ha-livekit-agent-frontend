"""Proxy endpoints for the dashboard card's Schedules, Settings and Text tabs.

The card calls these (via ``hass.callApi``, so Home Assistant auth applies) and they forward
to the scheduler service or the worker, attaching the shared secret. This keeps both
reachable only from Home Assistant (not the browser) and lets the tabs work without a
LiveKit connection.
"""

from __future__ import annotations

import json
import logging

from aiohttp import ClientError, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import slugify

from .const import (
    CHAT_CANCEL_URL,
    CHAT_HISTORY_URL,
    CHAT_URL,
    CONF_CHAT_TOKEN,
    CONF_CHAT_URL,
    CONF_SCHEDULER_TOKEN,
    CONF_SCHEDULER_URL,
    DATA_CONFIG,
    DOMAIN,
    SETTINGS_URL,
    TASK_URL,
    TASKS_URL,
)

_LOGGER = logging.getLogger(__name__)


async def _forward(
    hass: HomeAssistant,
    method: str,
    path: str,
    *,
    query: dict | None = None,
    json_body: object | None = None,
    service: tuple[str, str, str] = ("scheduler", CONF_SCHEDULER_URL, CONF_SCHEDULER_TOKEN),
) -> web.Response:
    """Forward a request to a backing service (the scheduler by default) and relay its
    response."""
    name, url_key, token_key = service
    config = hass.data.get(DOMAIN, {}).get(DATA_CONFIG) or {}
    base = config.get(url_key)
    if not base:
        return web.json_response({"detail": f"{name} not configured"}, status=503)

    url = f"{base.rstrip('/')}{path}"
    token = config.get(token_key)
    headers = {"Authorization": f"Bearer {token}"} if token else None
    session = async_get_clientsession(hass)
    try:
        async with session.request(
            method, url, params=query, json=json_body, headers=headers
        ) as resp:
            body = await resp.read()
            return web.Response(
                body=body,
                status=resp.status,
                content_type=resp.content_type or "application/json",
                charset=resp.charset,
            )
    except ClientError as err:
        _LOGGER.warning("%s request failed: %s", name, err)
        return web.json_response({"detail": f"{name} unreachable: {err}"}, status=502)


async def _json_body(request: web.Request) -> object | None:
    if not request.can_read_body:
        return None
    try:
        return await request.json()
    except ValueError:
        return None


def _ha_user_id(request: web.Request) -> str | None:
    """The logged-in Home Assistant user, which is the chat identity on this path."""
    user = request.get("hass_user")
    return user.id if user else None


def _as_user(request: web.Request) -> dict[str, str]:
    """The request's query, speaking for the logged-in HA user and no one else."""
    query = {k: v for k, v in request.query.items() if k not in ("user", "ha_user_id")}
    if (user_id := _ha_user_id(request)) is not None:
        query["ha_user_id"] = user_id
    return query


async def _task_body(request: web.Request) -> object | None:
    """A task edit's body, without an owner: the HA login decides whose task it is."""
    body = await _json_body(request)
    if isinstance(body, dict):
        body.pop("user", None)
    return body


class LiveKitTasksView(HomeAssistantView):
    """List the user's tasks (`?active_only=`), or create one."""

    url = TASKS_URL
    name = "api:livekit_voice:tasks"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return await _forward(self._hass, "GET", "/tasks", query=_as_user(request))

    async def post(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass,
            "POST",
            "/tasks",
            query=_as_user(request),
            json_body=await _task_body(request),
        )


class LiveKitTaskView(HomeAssistantView):
    """Get / edit / delete one of the user's tasks."""

    url = TASK_URL
    name = "api:livekit_voice:task"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request, task_id: str) -> web.Response:
        path = f"/tasks/{task_id}"
        return await _forward(self._hass, "GET", path, query=_as_user(request))

    async def patch(self, request: web.Request, task_id: str) -> web.Response:
        return await _forward(
            self._hass,
            "PATCH",
            f"/tasks/{task_id}",
            query=_as_user(request),
            json_body=await _task_body(request),
        )

    async def delete(self, request: web.Request, task_id: str) -> web.Response:
        path = f"/tasks/{task_id}"
        return await _forward(self._hass, "DELETE", path, query=_as_user(request))



def _device_names(hass: HomeAssistant) -> dict[str, str]:
    """Each Companion-app notify service's device, by the name it has in HA now.

    The service id is fixed from the name the app registered with, so renaming the
    device in HA changes this name and never the id; phones registered under one name
    share a service, and are listed together.
    """
    registry = dr.async_get(hass)
    names: dict[str, list[str]] = {}
    for entry in hass.config_entries.async_entries("mobile_app"):
        registered = entry.data.get("device_name") or entry.title
        device = registry.async_get_device(
            identifiers={("mobile_app", entry.data.get("device_id", ""))}
        )
        shown = (device.name_by_user or device.name) if device else None
        names.setdefault(f"mobile_app_{slugify(registered)}", []).append(
            shown or registered
        )
    return {service: " / ".join(sorted(n)) for service, n in names.items()}


class LiveKitSettingsView(HomeAssistantView):
    """Get / update shared settings (e.g. notify.* push targets)."""

    url = SETTINGS_URL
    name = "api:livekit_voice:settings"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        resp = await _forward(self._hass, "GET", "/settings")
        if resp.status != 200 or not isinstance(resp.body, bytes):
            return resp
        data = json.loads(resp.body)
        data["device_names"] = _device_names(self._hass)
        return web.json_response(data)


    async def put(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass, "PUT", "/settings", json_body=await _json_body(request)
        )


_WORKER = ("worker", CONF_CHAT_URL, CONF_CHAT_TOKEN)


class LiveKitChatView(HomeAssistantView):
    """Send one message into the worker's persisted text conversation."""

    url = CHAT_URL
    name = "api:livekit_voice:chat"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def post(self, request: web.Request) -> web.Response:
        body = await _json_body(request)
        body = dict(body) if isinstance(body, dict) else {}
        # the HA login names the person, so a client-sent identity is never forwarded
        body.pop("user", None)
        body["ha_user_id"] = _ha_user_id(request)
        return await _forward(self._hass, "POST", "/chat", json_body=body, service=_WORKER)


class LiveKitChatHistoryView(HomeAssistantView):
    """Read the text conversation's messages and tool calls (`?limit=`)."""

    url = CHAT_HISTORY_URL
    name = "api:livekit_voice:chat_history"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass, "GET", "/chat/history", query=_as_user(request), service=_WORKER
        )


class LiveKitChatCancelView(HomeAssistantView):
    """Stop the running text turn (`{"task_id"}` from the history)."""

    url = CHAT_CANCEL_URL
    name = "api:livekit_voice:chat_cancel"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def post(self, request: web.Request) -> web.Response:
        body = await _json_body(request)
        body = dict(body) if isinstance(body, dict) else {}
        # the HA login names the person, so a client-sent identity is never forwarded
        body.pop("user", None)
        body["ha_user_id"] = _ha_user_id(request)
        return await _forward(
            self._hass, "POST", "/chat/cancel", json_body=body, service=_WORKER
        )
