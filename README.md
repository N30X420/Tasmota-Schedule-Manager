# Tasmota Schedule Manager

Home Assistant custom integration and Lovelace card for managing native timers on Sonoff devices running Tasmota.

The device remains configured through Home Assistant's MQTT integration. This project adds a management layer that reads and writes Tasmota timer slots over MQTT.

## Features

- Configure one integration entry per Tasmota device.
- Select the existing MQTT device during setup and confirm its Tasmota topic.
- Manage all 16 Tasmota timer slots.
- Read from `stat/<topic>/RESULT` and write to `cmnd/<topic>/Timer1` through `Timer16`.
- Support fixed time, sunrise/sunset mode, weekday masks, repeat, output, action, and random windows.
- Include a Lovelace card with a device selector when multiple devices are configured.

## Installation

### HACS custom repository

1. In HACS, choose **Custom repositories**.
2. Add this repository as an **Integration**.
3. Download **Tasmota Schedule Manager** and restart Home Assistant.
4. Add the integration from **Settings → Devices & services → Add integration**.

### Manual

Copy `custom_components/tasmota_schedule_manager` into Home Assistant's `custom_components` directory and restart Home Assistant.

## Configure a device

The Tasmota device must already work through Home Assistant's MQTT integration. During setup, select the existing MQTT device when possible, enter the Tasmota MQTT topic exactly as configured (for example `sonoff_livingroom`), and give the entry a friendly name.

The device selector identifies the MQTT device, while the topic is confirmed separately because the device registry does not expose one canonical Tasmota command topic for every MQTT discovery layout.

## Lovelace card

Add the bundled JavaScript module as a dashboard resource:

```yaml
url: /tasmota_schedule_manager/tasmota-schedule-card.js
type: module
```

Then add a manual card:

```yaml
type: custom:tasmota-schedule-card
title: Tasmota schedules
```

When several devices are configured, the card displays a selector. To pin a card to one device, add its config-entry ID:

```yaml
type: custom:tasmota-schedule-card
entry_id: 0123456789abcdef
```

## Tasmota MQTT model

For timer 1, the integration uses `cmnd/<topic>/Timer1` and reads the response from `stat/<topic>/RESULT`. Example payload:

```json
{"Enable":1,"Mode":0,"Time":"07:30","Window":0,"Days":"SMTWTFS","Repeat":1,"Output":1,"Action":1}
```

Tasmota executes schedules locally. Sunrise and sunset timers require latitude, longitude, and correct device time/NTP settings on the Tasmota device.

## Development

```text
custom_components/tasmota_schedule_manager/
  __init__.py  config_flow.py  coordinator.py  manifest.json
  mqtt.py  websocket.py  www/tasmota-schedule-card.js
hacs.json  LICENSE  README.md
```

Licensed under the [MIT License](LICENSE).
