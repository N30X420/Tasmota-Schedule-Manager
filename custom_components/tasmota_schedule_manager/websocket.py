"""Authenticated websocket API used by the Lovelace card."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN


def async_register_websocket(hass: HomeAssistant) -> None:
    if hass.data.setdefault(DOMAIN, {}).get("_websocket_registered"):
        return
    for handler in (_entries, _list, _refresh, _set_timer, _clear_timer, _set_timer_name, _set_timers_enabled):
        websocket_api.async_register_command(hass, handler)
    hass.data[DOMAIN]["_websocket_registered"] = True


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/entries"})
@websocket_api.require_admin
@websocket_api.async_response
async def _entries(hass: HomeAssistant, connection, msg: dict) -> None:
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


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/list",
    vol.Required("entry_id"): str,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _list(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "list")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/refresh",
    vol.Required("entry_id"): str,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _refresh(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "refresh")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/set_timer",
    vol.Required("entry_id"): str,
    vol.Required("timer"): int,
    vol.Required("values"): dict,
    vol.Optional("name"): str,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _set_timer(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "set_timer")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/clear_timer",
    vol.Required("entry_id"): str,
    vol.Required("timer"): int,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _clear_timer(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "clear_timer")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/set_timer_name",
    vol.Required("entry_id"): str,
    vol.Required("timer"): int,
    vol.Required("name"): str,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _set_timer_name(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "set_timer_name")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/set_timers_enabled",
    vol.Required("entry_id"): str,
    vol.Required("enabled"): bool,
})
@websocket_api.require_admin
@websocket_api.async_response
async def _set_timers_enabled(hass: HomeAssistant, connection, msg: dict) -> None:
    await _device_command(hass, connection, msg, "set_timers_enabled")


async def _device_command(hass: HomeAssistant, connection, msg: dict, action: str) -> None:
    coordinator = hass.data[DOMAIN].get(msg["entry_id"])
    if coordinator is None:
        connection.send_error(
            msg["id"],
            "not_loaded",
            "This Tasmota Schedule Manager entry is configured but not loaded. Check Home Assistant logs.",
        )
        return
    try:
        if action == "list": result = coordinator.view()
        elif action == "refresh": result = await coordinator.async_refresh()
        elif action == "set_timer":
            result = await coordinator.set_timer(msg["timer"], msg["values"], msg.get("name"))
        elif action == "set_timer_name": result = await coordinator.set_timer_name(msg["timer"], msg["name"])
        elif action == "set_timers_enabled": result = await coordinator.set_timers_enabled(msg["enabled"])
        else: result = await coordinator.clear_timer(msg["timer"])
        connection.send_result(msg["id"], result)
    except Exception as err:  # HA will render a safe client error; no secrets are included.
        connection.send_error(msg["id"], "command_failed", str(err))
