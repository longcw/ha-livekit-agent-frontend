"""The music server's player as a media_player entity.

The music server plays Apple Music on a Mac and its AirPlay speakers for the voice agent;
this entity shows what it plays and controls it from Home Assistant, with the speakers as
its sources.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
    UpdateFailed,
)
from homeassistant.util import dt as dt_util

from .const import CONF_MUSIC_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

# a playing track moves on its own, so it is polled more often than an idle player
_PLAYING_INTERVAL = timedelta(seconds=5)
_IDLE_INTERVAL = timedelta(seconds=30)

_STATES = {
    "playing": MediaPlayerState.PLAYING,
    "paused": MediaPlayerState.PAUSED,
    "stopped": MediaPlayerState.IDLE,
}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    url = {**entry.data, **entry.options}.get(CONF_MUSIC_URL, "").rstrip("/")
    if not url:
        return
    coordinator = _MusicCoordinator(hass, url)
    await coordinator.async_config_entry_first_refresh()
    async_add_entities([MusicPlayer(coordinator, entry)])


class _MusicCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, url: str) -> None:
        super().__init__(
            hass, _LOGGER, name=f"{DOMAIN} music", update_interval=_IDLE_INTERVAL
        )
        self._url = url
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> dict[str, Any]:
        return await self._call("GET", "state")

    async def send(self, path: str, body: dict[str, Any]) -> None:
        """Send a command; the server answers with its new state."""
        self.async_set_updated_data(await self._call("POST", path, body))

    def async_set_updated_data(self, data: dict[str, Any]) -> None:
        self.update_interval = (
            _PLAYING_INTERVAL if data.get("state") == "playing" else _IDLE_INTERVAL
        )
        super().async_set_updated_data(data)

    async def _call(
        self, method: str, path: str, body: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        try:
            async with self._session.request(
                method,
                f"{self._url}/api/{path}",
                json=body,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                data = await resp.json(content_type=None)
                if resp.status >= 400:
                    raise UpdateFailed(data.get("error") or f"HTTP {resp.status}")
                return data
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise UpdateFailed(f"music server unreachable: {exc}") from exc


class MusicPlayer(CoordinatorEntity[_MusicCoordinator], MediaPlayerEntity):
    _attr_has_entity_name = True
    _attr_name = "Music"
    _attr_icon = "mdi:music"
    _attr_media_content_type = MediaType.MUSIC
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.VOLUME_SET
        | MediaPlayerEntityFeature.VOLUME_STEP
        | MediaPlayerEntityFeature.SELECT_SOURCE
    )

    def __init__(self, coordinator: _MusicCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_music"

    def _handle_coordinator_update(self) -> None:
        data = self.coordinator.data
        self._attr_state = _STATES.get(data.get("state"), MediaPlayerState.IDLE)
        playing = self._attr_state != MediaPlayerState.IDLE
        self._attr_media_title = data.get("track") or None if playing else None
        self._attr_media_artist = data.get("artist") or None if playing else None
        self._attr_media_album_name = data.get("album") or None if playing else None
        self._attr_media_duration = data.get("duration") or None if playing else None
        self._attr_media_position = data.get("position") if playing else None
        self._attr_media_position_updated_at = dt_util.utcnow() if playing else None
        volume = data.get("volume")
        self._attr_volume_level = volume / 100 if volume is not None else None
        devices = data.get("devices") or []
        self._attr_source_list = [d["name"] for d in devices if d.get("available")]
        self._attr_source = ", ".join(d["name"] for d in devices if d.get("selected")) or None
        super()._handle_coordinator_update()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self._handle_coordinator_update()

    async def async_media_play(self) -> None:
        await self.coordinator.send("control", {"action": "play"})

    async def async_media_pause(self) -> None:
        await self.coordinator.send("control", {"action": "pause"})

    async def async_media_stop(self) -> None:
        await self.coordinator.send("control", {"action": "stop"})

    async def async_media_next_track(self) -> None:
        await self.coordinator.send("control", {"action": "next"})

    async def async_media_previous_track(self) -> None:
        await self.coordinator.send("control", {"action": "previous"})

    async def async_set_volume_level(self, volume: float) -> None:
        await self.coordinator.send("volume", {"level": round(volume * 100)})

    async def async_select_source(self, source: str) -> None:
        await self.coordinator.send("source", {"device": source})
