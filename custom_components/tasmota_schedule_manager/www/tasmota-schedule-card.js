class TasmotaScheduleCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.entry = config.entry_id || null;
    this.data = null;
    this.error = null;
    this.attachShadow({mode: 'open'});
    this.load();
  }

  set hass(value) {
    this._hass = value;
    if (!this.data && !this.error) this.load();
    else if (this.data) this.render();
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
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  async clearTimer(id) {
    if (!confirm(`Clear Timer ${id}?`)) return;
    try {
      this.data = await this.call('clear_timer', {timer: id});
      this.error = null;
    } catch (error) {
      this.error = error?.message || String(error);
    }
    this.render();
  }

  _actionLabel(timer) {
    const output = Number(timer.Output || 1);
    const action = Number(timer.Action || 0);
    const actions = {0: 'OFF', 1: 'ON', 2: 'TOGGLE', 3: 'RULE / BLINK'};
    return `Power${output} ${actions[action] || 'UNKNOWN'}`;
  }

  _modeLabel(mode) {
    return ({0: 'Clock time', 1: 'Sunrise offset', 2: 'Sunset offset'})[Number(mode)] || 'Clock time';
  }

  _days(timer) {
    const chars = String(timer.Days || 'SMTWTFS').padEnd(7, '-').slice(0, 7);
    return chars.split('').map((char, index) => char !== '-' && char !== '0' ? index : -1).filter(index => index >= 0);
  }

  _renderDays(container, draft) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buttons = [];
    const sync = () => {
      const selected = new Set(this._days(draft));
      buttons.forEach(({button, index}) => {
        button.classList.toggle('active', selected.has(index));
        button.setAttribute('aria-pressed', selected.has(index) ? 'true' : 'false');
      });
    };
    const row = this.el('div', {className: 'weekday-row'});
    row.append(this.el('span', {className: 'weekday-label', text: 'Repeat'}));
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
    const title = this.el('div', {},
      this.el('div', {className: 'timer-title', text: `Timer ${timer.id}`}),
      this.el('div', {className: 'timer-action', text: this._actionLabel(timer)}));
    const enabled = this.el('input', {type: 'checkbox', className: 'switch', checked: Number(timer.Enable) === 1, 'aria-label': `Enable Timer ${timer.id}`});
    enabled.onchange = () => { draft.Enable = enabled.checked ? 1 : 0; };
    heading.append(title, this.el('label', {className: 'enabled'}, enabled, this.el('span', {text: 'Enabled'})));
    row.append(heading);

    const main = this.el('div', {className: 'main-fields'});
    const timeField = this.el('input', {type: 'text', value: draft.Time || '00:00', placeholder: '07:30', 'aria-label': `Time for Timer ${timer.id}`});
    timeField.onchange = () => { draft.Time = timeField.value.trim(); };
    const mode = this.el('select', {'aria-label': `Mode for Timer ${timer.id}`});
    [[0, 'Clock time'], [1, 'Sunrise offset'], [2, 'Sunset offset']].forEach(([value, label]) => mode.append(this.el('option', {value, text: label})));
    mode.value = String(draft.Mode ?? 0);
    mode.onchange = () => { draft.Mode = Number(mode.value); };
    main.append(this.el('label', {className: 'field'}, this.el('span', {text: 'Time or offset'}), timeField));
    main.append(this.el('label', {className: 'field'}, this.el('span', {text: 'Schedule mode'}), mode));
    row.append(main);
    this._renderDays(row, draft);

    const details = this.el('details');
    details.append(this.el('summary', {text: 'Advanced options'}));
    const advanced = this.el('div', {className: 'advanced'});
    const windowInput = this.el('input', {type: 'number', min: '0', max: '15', value: draft.Window ?? 0});
    windowInput.onchange = () => { draft.Window = Number(windowInput.value); };
    const repeat = this.el('select');
    [[1, 'Repeating'], [0, 'One time']].forEach(([value, label]) => repeat.append(this.el('option', {value, text: label})));
    repeat.value = String(draft.Repeat ?? 1);
    repeat.onchange = () => { draft.Repeat = Number(repeat.value); };
    const output = this.el('input', {type: 'number', min: '1', max: '16', value: draft.Output ?? 1});
    output.onchange = () => { draft.Output = Number(output.value); };
    const action = this.el('select');
    [[0, 'Turn OFF'], [1, 'Turn ON'], [2, 'TOGGLE'], [3, 'RULE / BLINK']].forEach(([value, label]) => action.append(this.el('option', {value, text: label})));
    action.value = String(draft.Action ?? 0);
    action.onchange = () => { draft.Action = Number(action.value); };
    advanced.append(
      this.el('label', {className: 'field'}, this.el('span', {text: 'Random window (minutes)'}), windowInput),
      this.el('label', {className: 'field'}, this.el('span', {text: 'Repeat behavior'}), repeat),
      this.el('label', {className: 'field'}, this.el('span', {text: 'Output / relay'}), output),
      this.el('label', {className: 'field'}, this.el('span', {text: 'Action'}), action));
    details.append(advanced);
    row.append(details);

    const buttons = this.el('div', {className: 'row-actions'});
    buttons.append(this.el('button', {className: 'primary', text: 'Save timer', type: 'button', onclick: () => this.saveTimer(timer.id, {
      Enable: Number(draft.Enable ?? 0), Mode: Number(draft.Mode ?? 0), Time: String(draft.Time || '00:00'),
      Window: Number(draft.Window ?? 0), Days: String(draft.Days || 'SMTWTFS'), Repeat: Number(draft.Repeat ?? 1),
      Output: Number(draft.Output ?? 1), Action: Number(draft.Action ?? 0),
    })}));
    buttons.append(this.el('button', {text: 'Clear timer', type: 'button', onclick: () => this.clearTimer(timer.id)}));
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
      .muted,.timer-action,.status{color:var(--secondary-text-color);font-size:12px}.error{color:var(--error-color);padding:8px 0}.timer-row{border-top:1px solid var(--divider-color,#ddd);padding:14px 0}.timer-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.timer-title{font-size:14px;font-weight:700}.enabled{display:flex;align-items:center;gap:7px;font-size:12px}.switch{width:22px;height:22px;accent-color:var(--primary-color)}
      .main-fields,.advanced{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--secondary-text-color)}.field input,.field select{width:100%;margin-top:auto}.weekday-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px}.weekday-label{font-size:12px;color:var(--secondary-text-color);margin-right:4px}.day{padding:7px 9px;border:1px solid var(--divider-color,#ddd);background:transparent;font-size:12px}.day.active{border-color:var(--primary-color)}details{margin-top:12px}summary{cursor:pointer;color:var(--secondary-text-color);font-size:12px}.advanced{padding-top:10px}.row-actions{margin-bottom:0}.topic{margin:4px 0 12px}
      @media(max-width:500px){.main-fields,.advanced{grid-template-columns:1fr}.header{align-items:flex-start;flex-direction:column}}
    </style>`;
    const card = this.el('ha-card');
    const header = this.el('div', {className: 'header'}, this.el('div', {className: 'heading', text: this.config.title || 'Tasmota schedules'}));
    if (this.entries?.length) {
      const selector = this.el('select', {'aria-label': 'Choose Tasmota device'});
      this.entries.forEach(entry => selector.append(this.el('option', {value: entry.entry_id, text: `${entry.title} (${entry.topic})${entry.loaded ? '' : ' — not loaded'}`})));
      selector.value = this.entry;
      selector.onchange = () => this.selectEntry(selector.value);
      header.append(selector);
    }
    card.append(header);
    if (this.error) card.append(this.el('div', {className: 'error', text: this.error}));
    if (!this.entry) {
      card.append(this.el('p', {text: 'Add and complete a Tasmota Schedule Manager integration entry first.'}));
      root.append(card);
      return;
    }
    if (!this.data) {
      card.append(this.el('p', {className: 'muted', text: 'Loading timers…'}));
      root.append(card);
      return;
    }
    if (this.data.error) card.append(this.el('div', {className: 'error', text: `Could not read timers: ${this.data.error}`}));
    card.append(this.el('div', {className: 'toolbar'},
      this.el('button', {text: 'Refresh', type: 'button', onclick: () => this.refresh()}),
      this.el('button', {className: 'primary', text: 'New timer', type: 'button', onclick: () => this.createTimer()})));
    card.append(this.el('div', {className: 'muted topic', text: `MQTT topic: ${this.data.topic}`}));
    if (!this.data.timers.length) card.append(this.el('p', {className: 'muted', text: 'No timer data returned. Check MQTT and press Refresh.'}));
    this.data.timers.forEach(timer => card.append(this._timerRow(timer)));
    root.append(card);
  }
}

if (!customElements.get('tasmota-schedule-card')) customElements.define('tasmota-schedule-card', TasmotaScheduleCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'tasmota-schedule-card')) {
  window.customCards.push({type: 'tasmota-schedule-card', name: 'Tasmota Schedule Manager', description: 'Manage Tasmota timers over MQTT'});
}
