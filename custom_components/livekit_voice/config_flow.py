"""Config + options flow for the LiveKit Voice Assistant integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback

from .const import (
    CONF_AGENT_NAME,
    CONF_API_KEY,
    CONF_API_SECRET,
    CONF_LIVEKIT_URL,
    CONF_SCHEDULER_TOKEN,
    CONF_SCHEDULER_URL,
    DEFAULT_AGENT_NAME,
    DOMAIN,
)


class LiveKitVoiceConfigFlow(ConfigFlow, domain=DOMAIN):
    """Collect the LiveKit connection details for the token endpoint."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial setup step."""
        if user_input is not None:
            return self.async_create_entry(
                title="LiveKit Voice Assistant", data=user_input
            )

        schema = vol.Schema(
            {
                vol.Required(CONF_LIVEKIT_URL): str,
                vol.Required(CONF_API_KEY): str,
                vol.Required(CONF_API_SECRET): str,
                vol.Optional(CONF_AGENT_NAME, default=DEFAULT_AGENT_NAME): str,
                # Optional: enables the card's Schedules tab. Also editable later via Options.
                vol.Optional(CONF_SCHEDULER_URL, default=""): str,
                vol.Optional(CONF_SCHEDULER_TOKEN, default=""): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return LiveKitVoiceOptionsFlow(config_entry)


class LiveKitVoiceOptionsFlow(OptionsFlow):
    """Edit any setting on an existing entry (no re-add needed).

    Options are merged over the entry's original data (see __init__._merged_config), so editing
    a value here overrides what was set at initial setup.
    """

    def __init__(self, config_entry: ConfigEntry) -> None:
        self._entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = {**self._entry.data, **self._entry.options}
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_LIVEKIT_URL, default=current.get(CONF_LIVEKIT_URL, "")
                ): str,
                vol.Required(CONF_API_KEY, default=current.get(CONF_API_KEY, "")): str,
                vol.Required(
                    CONF_API_SECRET, default=current.get(CONF_API_SECRET, "")
                ): str,
                vol.Optional(
                    CONF_AGENT_NAME,
                    default=current.get(CONF_AGENT_NAME, DEFAULT_AGENT_NAME),
                ): str,
                vol.Optional(
                    CONF_SCHEDULER_URL, default=current.get(CONF_SCHEDULER_URL, "")
                ): str,
                vol.Optional(
                    CONF_SCHEDULER_TOKEN, default=current.get(CONF_SCHEDULER_TOKEN, "")
                ): str,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
