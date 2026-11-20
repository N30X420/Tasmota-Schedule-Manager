"""Tasmota Schedule Manager."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .coordinator import TasmotaCoordinator
from .websocket import async_register_websocket

LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                f"/{DOMAIN}/{filename}",
                str(Path(__file__).parent / "www" / filename),
                cache_headers=False,
            )
            for filename in ("tasmota-schedule-card.js", "tasmota-schedule-card-nl.js")
        ]
    )
    async_register_websocket(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Config entries can be restored without re-running the integration setup
    # path in some reload scenarios; make the card API available here too.
    async_register_websocket(hass)
    coordinator = TasmotaCoordinator(hass, entry)
    # Register before the first MQTT read so the card can report/retry a device
    # even when the broker or device is temporarily unavailable at startup.
    hass.data[DOMAIN][entry.entry_id] = coordinator
    await coordinator.async_start()
    if coordinator.error:
        LOGGER.warning("Could not initially read Tasmota timers for %s: %s", entry.title, coordinator.error)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = hass.data[DOMAIN].pop(entry.entry_id)
    await coordinator.async_stop()
    return True
