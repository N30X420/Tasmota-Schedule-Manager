"""Configuration flow for an existing Tasmota device."""
from __future__ import annotations

import asyncio
import json
import re

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.components import mqtt
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, selector

from .const import DOMAIN

TOPIC_RE = re.compile(r"[^/+#\s\x00]+")
DISCOVERY_TIMEOUT = 3
DEFAULT_DISCOVERY_PREFIX = "tasmota/discovery"


async def _async_discover_config(
    hass: HomeAssistant, device: dr.DeviceEntry, discovery_prefix: str
) -> dict | None:
    """Read native Tasmota discovery for a device with a single MAC address."""
    macs = {
        dr.format_mac(address)
        for connection_type, address in device.connections
        if connection_type == dr.CONNECTION_NETWORK_MAC
    }
    if len(macs) != 1:
        return None
    mac = next(iter(macs))
    discovery_mac = mac.replace(":", "").upper()
    if not re.fullmatch(r"[0-9A-F]{12}", discovery_mac):
        return None

    result: asyncio.Future[dict] = asyncio.get_running_loop().create_future()

    @callback
    def receive_config(message: mqtt.ReceiveMessage) -> None:
        if result.done():
            return
        try:
            config = json.loads(message.payload)
        except (TypeError, ValueError):
            return
        if (
            isinstance(config, dict)
            and isinstance(config.get("mac"), str)
            and dr.format_mac(config["mac"]) == mac
            and isinstance(config.get("t"), str)
            and isinstance(config.get("ft"), str)
            and isinstance(config.get("tp"), list)
            and len(config["tp"]) >= 2
        ):
            result.set_result(config)

    try:
        unsubscribe = await mqtt.async_subscribe(
            hass, f"{discovery_prefix}/{discovery_mac}/config", receive_config
        )
    except HomeAssistantError:
        return None
    try:
        return await asyncio.wait_for(result, timeout=DISCOVERY_TIMEOUT)
    except asyncio.TimeoutError:
        return None
    finally:
        unsubscribe()


class TasmotaScheduleFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            registry = dr.async_get(self.hass)
            selected = next(
                (
                    (device, entry)
                    for entry in self.hass.config_entries.async_entries("tasmota")
                    for device in dr.async_entries_for_config_entry(
                        registry, entry.entry_id
                    )
                    if device.id == user_input["device"]
                ),
                None,
            )
            if selected is None:
                errors["device"] = "invalid_device"
            else:
                device, tasmota_entry = selected
                self._device_id = device.id
                self._device_name = device.name_by_user or device.name or ""
                self._discovered_topic = None
                config = await _async_discover_config(
                    self.hass,
                    device,
                    tasmota_entry.data.get("discovery_prefix", DEFAULT_DISCOVERY_PREFIX),
                )
                if config is not None and TOPIC_RE.fullmatch(config["t"]):
                    if (
                        config["ft"] != "%prefix%/%topic%/"
                        or config["tp"][:2] != ["cmnd", "stat"]
                    ):
                        return self.async_abort(reason="unsupported_mqtt_layout")
                    self._discovered_topic = config["t"]
                return await self.async_step_details()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("device"): selector.DeviceSelector(
                        selector.DeviceSelectorConfig(integration="tasmota")
                    ),
                }
            ),
            errors=errors,
            last_step=False,
        )

    async def async_step_details(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        name = self._device_name
        topic = self._discovered_topic
        if user_input is not None:
            name = user_input.get("name", "").strip()
            topic = user_input["topic"].strip()
            if not TOPIC_RE.fullmatch(topic):
                errors["topic"] = "invalid_topic"
            else:
                await self.async_set_unique_id(topic.casefold())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=name or self._device_name or topic,
                    data={"topic": topic, "device_id": self._device_id},
                )
        return self.async_show_form(
            step_id="details",
            data_schema=vol.Schema(
                {
                    vol.Optional("name", default=name): str,
                    vol.Required(
                        "topic", default=topic if topic is not None else vol.UNDEFINED
                    ): str,
                }
            ),
            errors=errors,
            last_step=True,
        )
