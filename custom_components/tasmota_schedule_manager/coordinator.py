"""Tasmota timer state and staged edits."""
from __future__ import annotations

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
        self.timers_enabled: bool | None = None
        self.loaded = False
        self.error: str | None = None

    async def async_start(self) -> None:
        try:
            await self.mqtt.start()
            await self.async_refresh()
        except Exception as err:
            # Keep the entry visible so the card can report/retry after MQTT becomes available.
            self.error = str(err)

    async def async_stop(self) -> None:
        await self.mqtt.stop()

    async def async_refresh(self) -> dict:
        timers = {}
        try:
            result = await self.mqtt.command("Timers")
            value = result.get("Timers")
            if value is not None:
                self.timers_enabled = bool(int(value))
        except Exception:
            # Keep timer reads usable on firmware builds without the global setting.
            self.timers_enabled = None
        for number in range(1, MAX_TIMERS + 1):
            result = await self.mqtt.command(f"Timer{number}")
            value = result.get(f"Timer{number}")
            if isinstance(value, dict):
                timers[number] = {"id": number, **value}
        self.timers = timers
        self.loaded = True
        self.error = None
        return self.view()

    def view(self) -> dict:
        return {"entry_id": self.entry.entry_id, "title": self.entry.title,
                "topic": self.topic, "loaded": self.loaded,
                "timers_enabled": self.timers_enabled,
                "error": self.error,
                "timers": [self.timers[n] for n in sorted(self.timers)]}

    async def set_timers_enabled(self, enabled: bool) -> dict:
        result = await self.mqtt.command("Timers", 1 if enabled else 0)
        value = result.get("Timers")
        if value is None:
            raise HomeAssistantError("Tasmota did not confirm the global timer setting")
        self.timers_enabled = bool(int(value))
        return self.view()

    async def set_timer(self, number: int, values: dict) -> dict:
        if number not in range(1, MAX_TIMERS + 1):
            raise HomeAssistantError("Timer number must be between 1 and 16")
        allowed = {"Enable", "Mode", "Time", "Window", "Days", "Repeat", "Output", "Action"}
        if set(values) - allowed:
            raise HomeAssistantError("Unsupported Tasmota timer field")
        result = await self.mqtt.command(f"Timer{number}", values)
        value = result.get(f"Timer{number}")
        if not isinstance(value, dict):
            raise HomeAssistantError(f"Tasmota did not confirm Timer{number}")
        self.timers[number] = {"id": number, **value}
        return self.view()

    async def clear_timer(self, number: int) -> dict:
        if number not in range(1, MAX_TIMERS + 1):
            raise HomeAssistantError("Timer number must be between 1 and 16")
        result = await self.mqtt.command(f"Timer{number}", 0)
        if f"Timer{number}" not in result:
            raise HomeAssistantError(f"Tasmota did not confirm clearing Timer{number}")
        self.timers.pop(number, None)
        return self.view()
