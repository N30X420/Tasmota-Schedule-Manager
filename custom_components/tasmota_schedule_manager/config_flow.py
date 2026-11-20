"""Configuration flow for an existing MQTT-connected Tasmota device."""
from __future__ import annotations

import re
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.helpers import selector

from .const import DOMAIN

TOPIC_RE = re.compile(r"^[^/#\s]+$")


class TasmotaScheduleFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            topic = str(user_input["topic"]).strip()
            if not TOPIC_RE.fullmatch(topic):
                errors["topic"] = "invalid_topic"
            else:
                await self.async_set_unique_id(topic.casefold())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=user_input["name"].strip() or topic,
                    data={"topic": topic, "device_id": user_input.get("device")},
                )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("name", default=""): str,
                    vol.Required("topic"): str,
                    vol.Optional("device"): selector.DeviceSelector(
                        selector.DeviceSelectorConfig(integration="mqtt")
                    ),
                }
            ),
            errors=errors,
        )
