const ENGLISH = {
  title: 'Tasmota schedules', chooseDevice: 'Choose Tasmota device',
  refresh: 'Refresh', addEntry: 'Add and complete a Tasmota Schedule Manager integration entry first.',
  loading: 'Loading timers…', readError: 'Could not read timers', noTimers: 'No timer data returned. Check MQTT and press Refresh.',
  timer: 'Timer', enabled: 'Enabled', enableTimer: 'Enable Timer {id}', time: 'Time or offset', mode: 'Schedule mode',
  nameLabel: 'Name for Timer {id}', nameSaved: 'Timer {id} name saved.',
  clock: 'Clock time', sunrise: 'Sunrise offset', sunset: 'Sunset offset', repeat: 'Repeat', advanced: 'Advanced options',
  randomWindow: 'Random window (minutes)', repeatBehavior: 'Repeat behavior', repeating: 'Repeating', oneTime: 'One time',
  output: 'Output / relay', action: 'Action', off: 'Turn OFF', on: 'Turn ON', toggle: 'TOGGLE', rule: 'RULE / BLINK',
  enableTimers: 'Enable timers',
  save: 'Save timer', clear: 'Clear timer', clearConfirm: 'Clear Timer {id}?', saved: 'Timer {id} saved successfully.',
  cleared: 'Timer {id} cleared successfully.', created: 'Timer {id} created successfully.',
  timersEnabled: 'Timer function enabled successfully.', timersDisabled: 'Timer function disabled successfully.',
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
  mqttTopic: 'MQTT topic', notLoaded: ' — not loaded', timeFor: 'Time for Timer {id}', modeFor: 'Mode for Timer {id}',
};

export class TasmotaScheduleCard extends HTMLElement {
  get _strings() { return ENGLISH; }

  _t(key, values = {}) {
    let text = this._strings[key] || ENGLISH[key] || key;
    Object.entries(values).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  }

  setConfig(config) {
    this.config = config;
    this.entry = config.entry_id || null;
    this.data = null;
    this.error = null;
    this.notice = null;
    this.attachShadow({mode: 'open'});
    this.load();
  }

  set hass(value) {
    this._hass = value;
    if (!this.data && !this.error) this.load();
    // Do not rebuild an already-loaded form on every Home Assistant state
    // update. Timer drafts live in the rendered inputs until the user saves,
    // so rebuilding here would reset partially configured timers.
  }

  get hass() { return this._hass; }

  async call(type, extra = {}) {
    return this.hass.callWS({type: `tasmota_schedule_manager/${type}`, entry_id: this.entry, ...extra});
  }

  async load() {
    if (!this.hass) return;
    try {
      const result = await this.hass.callWS({type: 'tasmota_schedule_manager/entries'});
      this.entries = result.entries || [];
      this.entry = this.entry || this.config?.entry_id || this.entries[0]?.entry_id;
      if (this.entry) this.data = await this.call('list');
      this.error = null;
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  el(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'value') element.value = value;
      else if (key === 'checked') element.checked = Boolean(value);
      else if (key === 'disabled') element.disabled = Boolean(value);
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, value);
    }
    for (const child of children) if (child) element.append(child);
    return element;
  }

  async selectEntry(entry) {
    this.entry = entry;
    this.data = null;
    this.error = null;
    this.render();
    await this.load();
  }

  async refresh() {
    try {
      this.data = await this.call('refresh');
      this.error = null;
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async createTimer() {
    const timers = this.data?.timers || [];
    const free = [...Array(16)].map((_, index) => index + 1)
      .find(id => !timers.some(timer => timer.id === id) || timers.find(timer => timer.id === id)?.Enable === 0);
    if (!free) return;
    try {
      this.data = await this.call('set_timer', {
        timer: free,
        values: {Enable: 0, Mode: 0, Time: '00:00', Window: 0, Days: 'SMTWTFS', Repeat: 1, Output: 1, Action: 1},
      });
      this.error = null;
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async saveTimer(id, values) {
    try {
      this.data = await this.call('set_timer', {timer: id, values});
      this.error = null;
      this.notice = {text: this._t('saved', {id}), kind: 'success'};
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async saveTimerName(id, name) {
    try {
      this.data = await this.call('set_timer_name', {timer: id, name});
      this.error = null;
      this.notice = {text: this._t('nameSaved', {id}), kind: 'success'};
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async clearTimer(id) {
    if (!confirm(this._t('clearConfirm', {id}))) return;
    try {
      this.data = await this.call('clear_timer', {timer: id});
      // Read the complete timer state back from the device after clearing.
      this.data = await this.call('refresh');
      this.error = null;
      this.notice = {text: this._t('cleared', {id}), kind: 'success'};
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async setTimersEnabled(enabled) {
    try {
      this.data = await this.call('set_timers_enabled', {enabled});
      this.error = null;
      this.notice = {text: enabled ? this._t('timersEnabled') : this._t('timersDisabled'), kind: 'success'};
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  _actionLabel(timer) {
    const output = Number(timer.Output || 1);
    const action = Number(timer.Action || 0);
    const actions = {0: this._t('off'), 1: this._t('on'), 2: this._t('toggle'), 3: this._t('rule')};
    return `Power${output} ${actions[action] || this._t('action')}`;
  }

  _modeLabel(mode) {
    return ({0: this._t('clock'), 1: this._t('sunrise'), 2: this._t('sunset')})[Number(mode)] || this._t('clock');
  }

  _days(timer) {
    const chars = String(timer.Days || 'SMTWTFS').padEnd(7, '-').slice(0, 7);
    return chars.split('').map((char, index) => char !== '-' && char !== '0' ? index : -1).filter(index => index >= 0);
  }

  _renderDays(container, draft) {
    const names = [this._t('sun'), this._t('mon'), this._t('tue'), this._t('wed'), this._t('thu'), this._t('fri'), this._t('sat')];
    const buttons = [];
    const sync = () => {
      const selected = new Set(this._days(draft));
      buttons.forEach(({button, index}) => {
        button.classList.toggle('active', selected.has(index));
        button.setAttribute('aria-pressed', selected.has(index) ? 'true' : 'false');
      });
    };
    const row = this.el('div', {className: 'weekday-row'});
    row.append(this.el('span', {className: 'weekday-label', text: this._t('repeat')}));
    names.forEach((name, index) => {
      const button = this.el('button', {className: 'day', text: name, type: 'button', 'aria-pressed': 'false'});
      button.onclick = () => {
        const selected = new Set(this._days(draft));
        if (selected.has(index)) {
          if (selected.size === 1) return;
          selected.delete(index);
        } else selected.add(index);
        draft.Days = names.map((_, day) => selected.has(day) ? names[day][0].toUpperCase() : '-').join('');
        sync();
      };
      buttons.push({button, index});
      row.append(button);
    });
    container.append(row);
    sync();
  }

  _timerRow(timer) {
    const draft = {...timer};
    const row = this.el('section', {className: 'timer-row'});
    const heading = this.el('div', {className: 'timer-heading'});
    const defaultName = `${this._t('timer')} ${timer.id}`;
    const name = this.el('input', {type: 'text', className: 'timer-name', value: timer.name || defaultName, maxlength: '80',
      'aria-label': this._t('nameLabel', {id: timer.id}), title: this._t('nameLabel', {id: timer.id}),
      onchange: event => this.saveTimerName(timer.id, event.target.value)});
    const title = this.el('div', {},
      name,
      this.el('div', {className: 'timer-action', text: this._actionLabel(timer)}));
    const enabled = this.el('input', {type: 'checkbox', className: 'switch', checked: Number(timer.Enable) === 1, 'aria-label': this._t('enableTimer', {id: timer.id})});
    enabled.onchange = () => { draft.Enable = enabled.checked ? 1 : 0; };
    heading.append(title, this.el('label', {className: 'enabled'}, enabled, this.el('span', {text: this._t('enabled')})));
    row.append(heading);

    const main = this.el('div', {className: 'main-fields'});
    const timeValue = String(draft.Time || '00:00');
    const timeField = this.el('input', {type: 'time', step: '1', value: /^\d{2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : timeValue, 'aria-label': this._t('timeFor', {id: timer.id})});
    timeField.onchange = () => { draft.Time = timeField.value.trim(); };
    const mode = this.el('select', {'aria-label': this._t('modeFor', {id: timer.id})});
    [[0, this._t('clock')], [1, this._t('sunrise')], [2, this._t('sunset')]].forEach(([value, label]) => mode.append(this.el('option', {value, text: label})));
    mode.value = String(draft.Mode ?? 0);
    mode.onchange = () => { draft.Mode = Number(mode.value); };
    const action = this.el('select');
    [[0, this._t('off')], [1, this._t('on')], [2, this._t('toggle')], [3, this._t('rule')]].forEach(([value, label]) => action.append(this.el('option', {value, text: label})));
    action.value = String(draft.Action ?? 0);
    action.onchange = () => { draft.Action = Number(action.value); };
    main.append(this.el('label', {className: 'field'}, this.el('span', {text: this._t('time')}), timeField));
    main.append(this.el('label', {className: 'field'}, this.el('span', {text: this._t('mode')}), mode));
    main.append(this.el('label', {className: 'field'}, this.el('span', {text: this._t('action')}), action));
    row.append(main);
    this._renderDays(row, draft);

    const details = this.el('details');
    details.append(this.el('summary', {text: this._t('advanced')}));
    const advanced = this.el('div', {className: 'advanced'});
    const windowInput = this.el('input', {type: 'number', min: '0', max: '15', value: draft.Window ?? 0});
    windowInput.onchange = () => { draft.Window = Number(windowInput.value); };
    const repeat = this.el('select');
    [[1, this._t('repeating')], [0, this._t('oneTime')]].forEach(([value, label]) => repeat.append(this.el('option', {value, text: label})));
    repeat.value = String(draft.Repeat ?? 1);
    repeat.onchange = () => { draft.Repeat = Number(repeat.value); };
    const output = this.el('input', {type: 'number', min: '1', max: '16', value: draft.Output ?? 1});
    output.onchange = () => { draft.Output = Number(output.value); };
    advanced.append(
      this.el('label', {className: 'field'}, this.el('span', {text: this._t('randomWindow')}), windowInput),
      this.el('label', {className: 'field'}, this.el('span', {text: this._t('repeatBehavior')}), repeat),
      this.el('label', {className: 'field'}, this.el('span', {text: this._t('output')}), output));
    details.append(advanced);
    row.append(details);

    const buttons = this.el('div', {className: 'row-actions'});
    buttons.append(this.el('button', {className: 'primary', text: this._t('save'), type: 'button', onclick: () => this.saveTimer(timer.id, {
      Enable: Number(draft.Enable ?? 0), Mode: Number(draft.Mode ?? 0), Time: String(draft.Time || '00:00'),
      Window: Number(draft.Window ?? 0), Days: String(draft.Days || 'SMTWTFS'), Repeat: Number(draft.Repeat ?? 1),
      Output: Number(draft.Output ?? 1), Action: Number(draft.Action ?? 0),
    })}));
    buttons.append(this.el('button', {text: this._t('clear'), type: 'button', onclick: () => this.clearTimer(timer.id)}));
    row.append(buttons);
    return row;
  }

  render() {
    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Arial,sans-serif)}
      ha-card{display:block;padding:18px;background:var(--ha-card-background,var(--card-background-color));border-radius:var(--ha-card-border-radius,12px)}
      .header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}.heading{font-size:20px;font-weight:650}
      select,input{background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color,#8886);border-radius:7px;padding:8px;font:inherit;box-sizing:border-box}
      select{max-width:100%}.toolbar,.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}button{border:0;border-radius:8px;padding:9px 13px;font:inherit;cursor:pointer;background:var(--secondary-background-color,#eee);color:var(--primary-text-color)}button.primary,.day.active{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .muted,.timer-action,.status{color:var(--secondary-text-color);font-size:12px}.error{color:var(--error-color);padding:8px 0}.timer-row{border-top:1px solid var(--divider-color,#ddd);padding:14px 0}.timer-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.timer-title{font-size:14px;font-weight:700}.timer-name{width:100%;max-width:280px;font-size:14px;font-weight:700}.enabled{display:flex;align-items:center;gap:7px;font-size:12px}.switch{width:22px;height:22px;accent-color:var(--primary-color)}
      .main-fields,.advanced{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--secondary-text-color)}.field input,.field select{width:100%;margin-top:auto}.weekday-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px}.weekday-label{font-size:12px;color:var(--secondary-text-color);margin-right:4px}.day{padding:7px 9px;border:1px solid var(--divider-color,#ddd);background:transparent;font-size:12px}.day.active{border-color:var(--primary-color)}details{margin-top:12px}summary{cursor:pointer;color:var(--secondary-text-color);font-size:12px}.advanced{padding-top:10px}.row-actions{margin-bottom:0}.topic{margin:4px 0 12px}.notice{padding:8px 10px;border-radius:6px;margin:8px 0;color:var(--primary-text-color);background:color-mix(in srgb,var(--success-color,#43a047) 18%,transparent)}
      @media(max-width:650px){.main-fields,.advanced{grid-template-columns:1fr}.header{align-items:flex-start;flex-direction:column}}
    </style>`;
    const card = this.el('ha-card');
    const header = this.el('div', {className: 'header'}, this.el('div', {className: 'heading', text: this.config.title || this._t('title')}));
    if (this.entries?.length) {
      const selector = this.el('select', {'aria-label': this._t('chooseDevice')});
      this.entries.forEach(entry => selector.append(this.el('option', {value: entry.entry_id, text: `${entry.title} (${entry.topic})${entry.loaded ? '' : this._t('notLoaded')}`})));
      selector.value = this.entry;
      selector.onchange = () => this.selectEntry(selector.value);
      header.append(selector);
    }
    card.append(header);
    if (this.notice) card.append(this.el('div', {className: 'notice', role: 'status', text: this.notice.text}));
    if (this.error) card.append(this.el('div', {className: 'error', text: this.error}));
    if (!this.entry) {
      card.append(this.el('p', {text: this._t('addEntry')}));
      root.append(card);
      return;
    }
    if (!this.data) {
      card.append(this.el('p', {className: 'muted', text: this._t('loading')}));
      root.append(card);
      return;
    }
    if (this.data.error) card.append(this.el('div', {className: 'error', text: `${this._t('readError')}: ${this.data.error}`}));
    card.append(this.el('div', {className: 'toolbar'},
      this.el('button', {text: this._t('refresh'), type: 'button', onclick: () => this.refresh()}),
      this.el('label', {className: 'global-timers'},
        this.el('input', {type: 'checkbox', checked: this.data.timers_enabled === true,
          onchange: event => this.setTimersEnabled(event.target.checked)}),
        this.el('span', {text: this._t('enableTimers')}))));
    card.append(this.el('div', {className: 'muted topic', text: `${this._t('mqttTopic')}: ${this.data.topic}`}));
    if (!this.data.timers.length) card.append(this.el('p', {className: 'muted', text: this._t('noTimers')}));
    this.data.timers.forEach(timer => card.append(this._timerRow(timer)));
    root.append(card);
  }
}

if (!customElements.get('tasmota-schedule-card')) customElements.define('tasmota-schedule-card', TasmotaScheduleCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'tasmota-schedule-card')) {
  window.customCards.push({type: 'tasmota-schedule-card', name: 'Tasmota Schedule Manager', description: 'Manage Tasmota timers over MQTT'});
}
