"""Authenticated websocket API used by the Lovelace card."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN


def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, _handler)


@websocket_api.websocket_command({
    vol.Required("type"): vol.In([f"{DOMAIN}/{name}" for name in ("entries", "list", "refresh", "set_timer", "clear_timer")]),
    vol.Optional("entry_id"): str,
    vol.Optional("timer"): int,
    vol.Optional("values"): dict,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _handler(hass: HomeAssistant, connection, msg: dict) -> None:
    if msg["type"] == f"{DOMAIN}/entries":
        configured = hass.config_entries.async_entries(DOMAIN)
        connection.send_result(msg["id"], {"entries": [
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "topic": entry.data.get("topic", ""),
                "loaded": entry.entry_id in hass.data[DOMAIN],
            }
            for entry in configured
        ]})
        return
    coordinator = hass.data[DOMAIN].get(msg["entry_id"])
    if coordinator is None:
        connection.send_error(
            msg["id"],
            "not_loaded",
            "This Tasmota Schedule Manager entry is configured but not loaded. Check Home Assistant logs.",
        )
        return
    try:
        action = msg["type"].rsplit("/", 1)[-1]
        if action == "list": result = coordinator.view()
        elif action == "refresh": result = await coordinator.async_refresh()
        elif action == "set_timer": result = await coordinator.set_timer(msg["timer"], msg.get("values", {}))
        else: result = await coordinator.clear_timer(msg["timer"])
        connection.send_result(msg["id"], result)
    except Exception as err:  # HA will render a safe client error; no secrets are included.
        connection.send_error(msg["id"], "command_failed", str(err))
