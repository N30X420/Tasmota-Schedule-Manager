import {TasmotaScheduleCard} from './tasmota-schedule-card.js';

const DUTCH = {
  title: 'Tasmota-schema’s', chooseDevice: 'Kies een Tasmota-apparaat', refresh: 'Vernieuwen', newTimer: 'Nieuwe timer',
  addEntry: 'Voeg eerst een Tasmota Schedule Manager-configuratie toe en voltooi deze.', loading: 'Timers laden…',
  readError: 'Timers konden niet worden gelezen', noTimers: 'Geen timergegevens ontvangen. Controleer MQTT en druk op Vernieuwen.',
  timer: 'Timer', enabled: 'Ingeschakeld', enableTimer: 'Timer {id} inschakelen', time: 'Tijd of verschuiving', mode: 'Schema-modus',
  clock: 'Kloktijd', sunrise: 'Verschuiving zonsopkomst', sunset: 'Verschuiving zonsondergang', repeat: 'Herhalen', advanced: 'Geavanceerde opties',
  randomWindow: 'Willekeurig venster (minuten)', repeatBehavior: 'Herhaalgedrag', repeating: 'Herhalen', oneTime: 'Eenmalig',
  output: 'Uitgang / relais', action: 'Actie', off: 'UITSCHAKELEN', on: 'INSCHAKELEN', toggle: 'OMSCHAKELEN', rule: 'REGEL / KNIPPEREN',
  enableTimers: 'Timers inschakelen',
  save: 'Timer opslaan', clear: 'Timer wissen', clearConfirm: 'Timer {id} wissen?', saved: 'Timer {id} is succesvol opgeslagen.',
  cleared: 'Timer {id} is succesvol gewist.', sun: 'Zo', mon: 'Ma', tue: 'Di', wed: 'Wo', thu: 'Do', fri: 'Vr', sat: 'Za',
  timersEnabled: 'Timerfunctie succesvol ingeschakeld.', timersDisabled: 'Timerfunctie succesvol uitgeschakeld.',
  mqttTopic: 'MQTT-topic', notLoaded: ' — niet geladen', timeFor: 'Tijd voor timer {id}', modeFor: 'Modus voor timer {id}',
};

class TasmotaScheduleCardNL extends TasmotaScheduleCard {
  get _strings() { return DUTCH; }
}

if (!customElements.get('tasmota-schedule-card-nl')) customElements.define('tasmota-schedule-card-nl', TasmotaScheduleCardNL);
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'tasmota-schedule-card-nl')) {
  window.customCards.push({type: 'tasmota-schedule-card-nl', name: 'Tasmota Schedule Manager (Nederlands)', description: 'Beheer Tasmota-timers via MQTT'});
}
