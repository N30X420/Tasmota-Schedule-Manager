"""Small MQTT request/response adapter for Tasmota commands."""
from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

from homeassistant.components import mqtt
from homeassistant.core import HomeAssistant


class TasmotaMqtt:
    def __init__(self, hass: HomeAssistant, topic: str) -> None:
        self.hass = hass
        self.topic = topic
        self._waiters: list[asyncio.Future[dict]] = []
        self._unsubscribe: Callable[[], None] | None = None

    async def start(self) -> None:
        self._unsubscribe = await mqtt.async_subscribe(
            self.hass, f"stat/{self.topic}/RESULT", self._message, qos=1
        )

    async def stop(self) -> None:
        if self._unsubscribe:
            self._unsubscribe()
            self._unsubscribe = None

    def _message(self, msg) -> None:
        try:
            value = json.loads(msg.payload)
        except (TypeError, ValueError):
            return
        if not isinstance(value, dict):
            return
        for waiter in tuple(self._waiters):
            if not waiter.done():
                waiter.set_result(value)
        self._waiters.clear()

    async def command(self, command: str, payload: object = "", timeout: float = 5) -> dict:
        waiter: asyncio.Future[dict] = asyncio.get_running_loop().create_future()
        self._waiters.append(waiter)
        if isinstance(payload, (dict, list)):
            payload = json.dumps(payload, separators=(",", ":"))
        await mqtt.async_publish(self.hass, f"cmnd/{self.topic}/{command}", str(payload), qos=1)
        try:
            return await asyncio.wait_for(waiter, timeout)
        finally:
            if waiter in self._waiters:
                self._waiters.remove(waiter)
