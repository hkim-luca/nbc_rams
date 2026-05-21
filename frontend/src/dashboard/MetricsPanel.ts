export function createMetricsPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'metrics-panel';
  panel.className = 'panel';
  panel.style.cssText = 'top:12px;right:12px;width:240px;';

  panel.innerHTML = `
    <div class="panel-title">Simulation Metrics</div>
    <div style="font-size:13px;line-height:1.8;">
      <div>Status: <span id="metrics-status">Idle</span></div>
      <div>Elapsed: <span id="metrics-time">0</span>s</div>
      <div>Puffs: <span id="metrics-puffs">0</span></div>
      <div>Max Conc: <span id="metrics-maxconc">0</span> g/m³</div>
    </div>
    <div style="margin-top:8px;">
      <div class="panel-title">Connection</div>
      <div style="font-size:13px;">
        WS: <span id="ws-status" style="color:#aaa;">Disconnected</span>
      </div>
    </div>
  `;

  return panel;
}

export function updateMetrics(frame: { t: number; puffs: unknown[]; max_conc: number }): void {
  const el = (id: string) => document.getElementById(id);
  const timeEl = el('metrics-time');
  const puffsEl = el('metrics-puffs');
  const concEl = el('metrics-maxconc');
  if (timeEl) timeEl.textContent = String(Math.round(frame.t));
  if (puffsEl) puffsEl.textContent = String(frame.puffs.length);
  if (concEl) concEl.textContent = frame.max_conc.toExponential(2);
}

export function setSimStatus(text: string): void {
  const el = document.getElementById('metrics-status');
  if (el) el.textContent = text;
}

export function setConnectionStatus(connected: boolean): void {
  const el = document.getElementById('ws-status');
  if (el) {
    if (connected) {
      el.textContent = 'Connected';
      el.style.color = '#81c784';
    } else {
      el.textContent = 'Disconnected';
      el.style.color = '#aaa';
    }
  }
}
