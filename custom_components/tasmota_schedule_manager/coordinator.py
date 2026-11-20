"""Tasmota timer state and staged edits."""
from __future__ import annotations

from copy import deepcopy
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import MAX_TIMERS
from .mqtt import TasmotaMqtt


class TasmotaCoordinator:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass, self.entry = hass, entry
        self.topic = entry.data["topic"]
        self.mqtt = TasmotaMqtt(hass, self.topic)
        self.timers: dict[int, dict] = {}
        self.loaded = False

    async def async_start(self) -> None:
        await self.mqtt.start()
        await self.async_refresh()

    async def async_stop(self) -> None:
        await self.mqtt.stop()

    async def async_refresh(self) -> dict:
        timers = {}
        for number in range(1, MAX_TIMERS + 1):
            result = await self.mqtt.command(f"Timer{number}")
            value = result.get(f"Timer{number}")
            if isinstance(value, dict):
                timers[number] = {"id": number, **value}
        self.timers = timers
        self.loaded = True
        return self.view()

    def view(self) -> dict:
        return {"entry_id": self.entry.entry_id, "title": self.entry.title,
                "topic": self.topic, "loaded": self.loaded,
                "timers": [self.timers[n] for n in sorted(self.timers)]}

    async def set_timer(self, number: int, values: dict) -> dict:
        if number not in range(1, MAX_TIMERS + 1):
            raise HomeAssistantError("Timer number must be between 1 and 16")
        allowed = {"Enable", "Mode", "Time", "Window", "Days", "Repeat", "Output", "Action"}
        if set(values) - allowed:
            raise HomeAssistantError("Unsupported Tasmota timer field")
        result = await self.mqtt.command(f"Timer{number}", values)
        value = result.get(f"Timer{number}")
        if isinstance(value, dict):
            self.timers[number] = {"id": number, **value}
        return self.view()

    async def clear_timer(self, number: int) -> dict:
        if number not in range(1, MAX_TIMERS + 1):
            raise HomeAssistantError("Timer number must be between 1 and 16")
        await self.mqtt.command(f"Timer{number}", 0)
        self.timers.pop(number, None)
        return self.view()
