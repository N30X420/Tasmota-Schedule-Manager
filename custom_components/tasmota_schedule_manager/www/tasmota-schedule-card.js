class TasmotaScheduleCard extends HTMLElement {
  setConfig(config) { this.config = config; this.entry = config.entry_id || null; this.data = null; this.attachShadow({mode:'open'}); this.load(); }
  set hass(value) { this._hass = value; if (!this.data && !this.error) this.load(); else if (this.data) this.render(); }
  get hass() { return this._hass; }
  async call(type, extra={}) { return this.hass.callWS({type:`tasmota_schedule_manager/${type}`, entry_id:this.entry, ...extra}); }
  async load() {
    if (!this.hass) return;
    try {
      const result = await this.hass.callWS({type:'tasmota_schedule_manager/entries'});
      this.entries = result.entries || [];
      this.entry = this.entry || this.config?.entry_id || this.entries[0]?.entry_id;
      if (this.entry) this.data = await this.call('list');
      this.render();
    } catch(e) { this.error = e.message; this.render(); }
  }
  el(tag, props={}, children=[]) { const e=document.createElement(tag); Object.assign(e,props); children.forEach(c=>e.append(c)); return e; }
  async selectEntry(entry) { this.entry=entry; this.data=null; this.render(); await this.load(); }
  async refresh() { this.data=await this.call('refresh'); this.render(); }
  async saveTimer(id, values) { this.data=await this.call('set_timer',{timer:id,values}); this.render(); }
  async clearTimer(id) { if(confirm(`Clear Timer ${id}?`)) { this.data=await this.call('clear_timer',{timer:id}); this.render(); } }
  render() {
    const s=this.shadowRoot; if(!s) return; s.innerHTML=`<style>
      :host{display:block}ha-card{padding:16px}header{display:flex;gap:8px;align-items:center;margin-bottom:12px}select,input{padding:7px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color)}button{padding:7px 10px;border:0;border-radius:4px;background:var(--primary-color);color:white;cursor:pointer}.timer{border-top:1px solid var(--divider-color);padding:10px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px}.muted{color:var(--secondary-text-color)}.error{color:var(--error-color)}</style>`;
    const card=this.el('ha-card'); const title=this.el('h2',{textContent:this.config.title||'Tasmota schedules'}); card.append(title);
    if(!this.entry) { card.append(this.el('p',{textContent:'Configure a Tasmota Schedule Manager device first.'})); s.append(card); return; }
    const selector=this.el('select'); for(const entry of (this.entries||[])) { const option=this.el('option',{value:entry.entry_id,textContent:`${entry.title} (${entry.topic})`}); option.selected=entry.entry_id===this.entry; selector.append(option); } selector.onchange=()=>this.selectEntry(selector.value); card.insertBefore(selector, card.children[1]);
    if(this.error) card.append(this.el('p',{className:'error',textContent:this.error}));
    const head=this.el('header'); head.append(this.el('span',{textContent:this.data?.title||'Loading…'})); const reload=this.el('button',{textContent:'Refresh'}); reload.onclick=()=>this.refresh(); head.append(reload); card.append(head);
    if(!this.data) { card.append(this.el('p',{className:'muted',textContent:'Loading timers…'})); s.append(card); return; }
    card.append(this.el('p',{className:'muted',textContent:`MQTT topic: ${this.data.topic}`}));
    for(const timer of this.data.timers) {
      const row=this.el('div',{className:'timer'}); row.append(this.el('strong',{textContent:`Timer ${timer.id}`}));
      const grid=this.el('div',{className:'grid'}); const values={Enable:timer.Enable??0,Mode:timer.Mode??0,Time:timer.Time??'00:00',Window:timer.Window??0,Days:timer.Days??'SMTWTFS',Repeat:timer.Repeat??1,Output:timer.Output??1,Action:timer.Action??0}; const inputs={};
      for(const key of ['Enable','Mode','Time','Window','Days','Repeat','Output','Action']) { const input=this.el('input',{value:values[key],title:key,placeholder:key}); input.dataset.key=key; inputs[key]=input; grid.append(input); }
      row.append(grid); const save=this.el('button',{textContent:'Save'}); save.onclick=()=>{const out={}; for(const [k,i] of Object.entries(inputs)) out[k]=['Time','Days'].includes(k)?i.value:Number(i.value); this.saveTimer(timer.id,out);}; const clear=this.el('button',{textContent:'Clear'}); clear.style.marginLeft='8px'; clear.onclick=()=>this.clearTimer(timer.id); row.append(save,clear); card.append(row);
    }
    s.append(card);
  }
}
if(!customElements.get('tasmota-schedule-card')) customElements.define('tasmota-schedule-card',TasmotaScheduleCard);
window.customCards=window.customCards||[]; if(!window.customCards.some(c=>c.type==='tasmota-schedule-card')) window.customCards.push({type:'tasmota-schedule-card',name:'Tasmota Schedule Manager',description:'Manage Tasmota timers over MQTT'});
