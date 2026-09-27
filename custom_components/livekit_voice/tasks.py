"""Proxy endpoints for the dashboard card's Schedules, Settings and Text tabs.

The card calls these (via ``hass.callApi``, so Home Assistant auth applies) and they forward
to the scheduler service or the worker, attaching the shared secret. This keeps both
reachable only from Home Assistant (not the browser) and lets the tabs work without a
LiveKit connection.
"""

from __future__ import annotations

import logging

from aiohttp import ClientError, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
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


class LiveKitTasksView(HomeAssistantView):
    """List all tasks (`?active_only=`), or create one."""

    url = TASKS_URL
    name = "api:livekit_voice:tasks"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass, "GET", "/tasks", query=dict(request.query)
        )

    async def post(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass, "POST", "/tasks", json_body=await _json_body(request)
        )


class LiveKitTaskView(HomeAssistantView):
    """Get / edit / delete a single task."""

    url = TASK_URL
    name = "api:livekit_voice:task"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request, task_id: str) -> web.Response:
        return await _forward(self._hass, "GET", f"/tasks/{task_id}")

    async def patch(self, request: web.Request, task_id: str) -> web.Response:
        return await _forward(
            self._hass, "PATCH", f"/tasks/{task_id}", json_body=await _json_body(request)
        )

    async def delete(self, request: web.Request, task_id: str) -> web.Response:
        return await _forward(self._hass, "DELETE", f"/tasks/{task_id}")


class LiveKitSettingsView(HomeAssistantView):
    """Get / update shared settings (e.g. notify.* push targets)."""

    url = SETTINGS_URL
    name = "api:livekit_voice:settings"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return await _forward(self._hass, "GET", "/settings")

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
        return await _forward(
            self._hass, "POST", "/chat", json_body=await _json_body(request), service=_WORKER
        )


class LiveKitChatHistoryView(HomeAssistantView):
    """Read the text conversation's messages and tool calls (`?limit=`)."""

    url = CHAT_HISTORY_URL
    name = "api:livekit_voice:chat_history"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return await _forward(
            self._hass, "GET", "/chat/history", query=dict(request.query), service=_WORKER
        )
