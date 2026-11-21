# Tasmota Schedule Manager

![Tasmota Schedule Manager logo](custom_components/tasmota_schedule_manager/brand/logo.png)

Home Assistant custom integration and Lovelace card for managing native timers on Sonoff devices running Tasmota.

The device remains configured through Home Assistant's Tasmota/MQTT integration. This project adds a management layer that reads and writes Tasmota timer slots over MQTT.

This architecture is supported: Home Assistant's official Tasmota integration controls Tasmota devices over MQTT, while this custom integration sends the native `Timer1` through `Timer16` commands through the same broker. It does not replace or reconfigure the official Tasmota integration.

## Features

- Configure one integration entry per Tasmota device.
- Select the existing Tasmota device during setup and confirm its MQTT topic.
- Manage all 16 Tasmota timer slots.
- Read from `stat/<topic>/RESULT` and write to `cmnd/<topic>/Timer1` through `Timer16`.
- Support fixed time, sunrise/sunset mode, weekday masks, repeat, output, action, and random windows.
- Read and control Tasmota's global **Timers** setting (the **Enable Timers** checkbox in the Tasmota web UI).
- Edit timer names locally in Home Assistant; names are not sent to or stored on the Tasmota device.
- Include a Lovelace card with a device selector when multiple devices are configured.

## Installation

### HACS custom repository

1. In HACS, choose **Custom repositories**.
2. Add this repository as an **Integration**.
3. Download **Tasmota Schedule Manager** and restart Home Assistant.
4. Add the integration from **Settings → Devices & services → Add integration** and complete at least one Tasmota device entry.
5. Add the Lovelace card resource and card described below.

### Manual

Copy `custom_components/tasmota_schedule_manager` into Home Assistant's `custom_components` directory and restart Home Assistant.

## Configure a device

The Tasmota device must already be visible under Home Assistant's **Tasmota** integration. During setup, select that existing Tasmota device, enter its MQTT topic exactly as configured (for example `sonoff_livingroom`), and give the entry a friendly name.

The device selector identifies the Tasmota device, while the topic is confirmed separately because the device registry does not expose one canonical Tasmota command topic for every MQTT discovery layout.

### Find the MQTT topic

Open the Tasmota device's own web interface and go to **Configuration → Configure MQTT**. Copy the value in the **Topic** field into the integration's **Tasmota MQTT topic** field.

For example, if Tasmota shows:

```text
Topic: sonoff_livingroom
```

enter only:

```text
sonoff_livingroom
```

Do not enter `cmnd/`, `stat/`, `/RESULT`, or `Timer1`. The integration builds those MQTT paths itself. With Tasmota's default settings, the Topic field may show a template such as `tasmota_%06X`, while the text in parentheses shows this device's expanded topic. Use the expanded value—for example `tasmota_A966EA`—not the `%06X` template. The official Tasmota MQTT documentation describes the Topic and FullTopic settings in detail: https://tasmota.github.io/docs/MQTT/.

## Lovelace card

Add the bundled JavaScript module as a dashboard resource:

```yaml
url: /tasmota_schedule_manager/tasmota-schedule-card.js
type: module
```

For the Dutch card, add the second module instead:

```yaml
url: /tasmota_schedule_manager/tasmota-schedule-card-nl.js
type: module
```

After installing or updating the integration, restart Home Assistant before adding the resource. If the card still says that the custom element is not found, open the resource URL in a browser and confirm that it returns JavaScript rather than a 404 page, then hard-refresh the Home Assistant dashboard.

The `/tasmota_schedule_manager/...` URLs are served by this integration after Home Assistant loads it. The alternative `/local/tasmota-schedule-card.js` URL is served globally from `/config/www` and does not depend on this integration starting successfully.

Then add a manual card:

```yaml
type: custom:tasmota-schedule-card
title: Tasmota schedules
```

Or use the Dutch version:

```yaml
type: custom:tasmota-schedule-card-nl
title: Tasmota-schema's
```

The card shows a confirmation message after a timer is saved successfully. The action (off, on, toggle, or rule/blink) is available directly in each timer row; less frequently used timer options remain under **Advanced options**.

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

Tasmota executes schedules locally. The global `Timers` setting must be `1` for enabled timer slots to run. The card exposes this as **Enable all timers**. Sunrise and sunset timers require latitude, longitude, and correct device time/NTP settings on the Tasmota device.

The implementation assumes Tasmota's standard `FullTopic` format (`%prefix%/%topic%/`) and the normal `RESULT` response topic. The official Tasmota integration supports custom full topics, but this manager currently expects the standard format; keep the device's default FullTopic unless custom-topic support is added.

References: [Home Assistant Tasmota integration](https://www.home-assistant.io/integrations/tasmota/), [Tasmota MQTT documentation](https://tasmota.github.io/docs/MQTT/), and [Tasmota Timers](https://tasmota.github.io/docs/Timers/).

## Development

```text
custom_components/tasmota_schedule_manager/
  __init__.py  config_flow.py  coordinator.py  manifest.json
  mqtt.py  websocket.py  www/tasmota-schedule-card.js www/tasmota-schedule-card-nl.js
hacs.json  LICENSE  README.md
```

Licensed under the [MIT License](LICENSE).
