import { useSimStore } from '../store';

export function createInputGroup(): HTMLDivElement {
  const div = document.createElement('div');

  div.innerHTML = `
    <div id="input-panel" class="panel" style="top:12px;left:12px;width:320px;">
      <div class="panel-title">Source Parameters</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <div><div class="label">Latitude</div><input id="in-lat" type="number" step="0.01"></div>
        <div><div class="label">Longitude</div><input id="in-lon" type="number" step="0.01"></div>
        <div><div class="label">Stack Height (m)</div><input id="in-height" type="number" step="1"></div>
        <div><div class="label">Diameter (m)</div><input id="in-diameter" type="number" step="0.1"></div>
        <div><div class="label">Exit Velocity (m/s)</div><input id="in-velocity" type="number" step="1"></div>
        <div><div class="label">Exit Temp (°C)</div><input id="in-exit-temp" type="number" step="1"></div>
        <div style="grid-column:1/3"><div class="label">Release Rate (g/s)</div><input id="in-rate" type="number" step="1"></div>
        <div style="grid-column:1/3">
          <div class="label">Substance</div>
          <select id="in-substance">
            <option value="SO2">SO₂</option>
            <option value="NO2">NO₂</option>
            <option value="HF">HF (Hydrogen Fluoride)</option>
            <option value="Cl2">Cl₂ (Chlorine)</option>
            <option value="NH3">NH₃ (Ammonia)</option>
            <option value="CO">CO (Carbon Monoxide)</option>
          </select>
        </div>
      </div>

      <div class="panel-title">Weather Conditions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <div><div class="label">Wind Dir (°)</div><input id="in-wind-dir" type="number" min="0" max="360"></div>
        <div><div class="label">Wind Speed (m/s)</div><input id="in-wind-speed" type="number" min="0" step="0.1"></div>
        <div><div class="label">Stability</div>
          <select id="in-stability">
            <option value="A">A — Very Unstable</option>
            <option value="B">B — Moderately Unstable</option>
            <option value="C">C — Slightly Unstable</option>
            <option value="D" selected>D — Neutral</option>
            <option value="E">E — Slightly Stable</option>
            <option value="F">F — Very Stable</option>
          </select>
        </div>
        <div><div class="label">Mix Height (m)</div><input id="in-mix-height" type="number" min="0"></div>
        <div><div class="label">Temp (°C)</div><input id="in-temp" type="number"></div>
        <div><div class="label">Roughness</div>
          <select id="in-roughness">
            <option value="0.0002">Ocean (0.0002)</option>
            <option value="0.03">Flat Open (0.03)</option>
            <option value="0.1">Rural (0.1)</option>
            <option value="0.5" selected>Suburban (0.5)</option>
            <option value="2.0">Urban (2.0)</option>
          </select>
        </div>
      </div>

      <div class="panel-title">Simulation</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="grid-column:1/3">
          <div class="label">Model</div>
          <select id="in-model">
            <option value="LPFM">LPFM — Lagrangian Puff</option>
            <option value="LPTM">LPTM — Lagrangian Particle</option>
          </select>
        </div>
        <div><div class="label">Domain (km)</div><input id="in-domain" type="number"></div>
        <div><div class="label">Grid (m)</div><input id="in-grid" type="number"></div>
        <div><div class="label">Puffs</div><input id="in-puffs" type="number"></div>
        <div><div class="label">Time Step (s)</div><input id="in-dt" type="number"></div>
        <div><div class="label">Duration (s)</div><input id="in-duration" type="number"></div>
        <div><div class="label">Release Type</div>
          <select id="in-release-type">
            <option value="continuous">Continuous</option>
            <option value="instantaneous">Instant</option>
          </select>
        </div>
        <div><div class="label">Release Dur (s)</div><input id="in-release-dur" type="number"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button id="btn-start" style="flex:1">Run Simulation</button>
        <button id="btn-stop" class="danger" style="flex:1" disabled>Stop</button>
      </div>
    </div>
  `;

  return div;
}

export function bindInputs(div: HTMLDivElement): void {
  const bind = (id: string, setter: (v: number) => void) => {
    const el = div.querySelector<HTMLInputElement>(`#${id}`);
    if (el) {
      el.addEventListener('input', () => setter(parseFloat(el.value) || 0));
    }
  };

  const bindSelect = (id: string, setter: (v: string) => void) => {
    const el = div.querySelector<HTMLSelectElement>(`#${id}`);
    if (el) {
      el.addEventListener('change', () => setter(el.value));
    }
  };

  // Source
  bind('in-lat', (v) => useSimStore.getState().setSource({ lat: v }));
  bind('in-lon', (v) => useSimStore.getState().setSource({ lon: v }));
  bind('in-height', (v) => useSimStore.getState().setSource({ height: v }));
  bind('in-diameter', (v) => useSimStore.getState().setSource({ diameter: v }));
  bind('in-velocity', (v) => useSimStore.getState().setSource({ velocity: v }));
  bind('in-exit-temp', (v) => useSimStore.getState().setSource({ exit_temp: v }));
  bind('in-rate', (v) => useSimStore.getState().setSource({ rate: v }));
  bindSelect('in-substance', (v) => useSimStore.getState().setSource({ substance: v }));

  // Weather
  bind('in-wind-dir', (v) => useSimStore.getState().setWeather({ wind_dir: v }));
  bind('in-wind-speed', (v) => useSimStore.getState().setWeather({ wind_speed: v }));
  bindSelect('in-stability', (v) => useSimStore.getState().setWeather({ stability: v as any }));
  bind('in-mix-height', (v) => useSimStore.getState().setWeather({ mix_height: v }));
  bind('in-temp', (v) => useSimStore.getState().setWeather({ temp: v }));
  bindSelect('in-roughness', (v) => useSimStore.getState().setWeather({ roughness: parseFloat(v) }));

  // Simulation
  bindSelect('in-model', (v) => useSimStore.getState().setSim({ model: v as any }));
  bind('in-domain', (v) => useSimStore.getState().setSim({ domain_km: v }));
  bind('in-grid', (v) => useSimStore.getState().setSim({ grid_m: v }));
  bind('in-puffs', (v) => useSimStore.getState().setSim({ n_puffs: v }));
  bind('in-dt', (v) => useSimStore.getState().setSim({ dt: v }));
  bind('in-duration', (v) => useSimStore.getState().setSim({ duration: v }));
  bindSelect('in-release-type', (v) => useSimStore.getState().setSim({ release_type: v as any }));
  bind('in-release-dur', (v) => useSimStore.getState().setSim({ release_duration: v }));

  // Set initial values from store
  const s = useSimStore.getState();
  setInputValue(div, 'in-lat', s.source.lat);
  setInputValue(div, 'in-lon', s.source.lon);
  setInputValue(div, 'in-height', s.source.height);
  setInputValue(div, 'in-diameter', s.source.diameter);
  setInputValue(div, 'in-velocity', s.source.velocity);
  setInputValue(div, 'in-exit-temp', s.source.exit_temp);
  setInputValue(div, 'in-rate', s.source.rate);
  setSelectValue(div, 'in-substance', s.source.substance);
  setInputValue(div, 'in-wind-dir', s.weather.wind_dir);
  setInputValue(div, 'in-wind-speed', s.weather.wind_speed);
  setSelectValue(div, 'in-stability', s.weather.stability);
  setInputValue(div, 'in-mix-height', s.weather.mix_height);
  setInputValue(div, 'in-temp', s.weather.temp);
  setSelectValue(div, 'in-roughness', String(s.weather.roughness));
  setSelectValue(div, 'in-model', s.sim.model);
  setInputValue(div, 'in-domain', s.sim.domain_km);
  setInputValue(div, 'in-grid', s.sim.grid_m);
  setInputValue(div, 'in-puffs', s.sim.n_puffs);
  setInputValue(div, 'in-dt', s.sim.dt);
  setInputValue(div, 'in-duration', s.sim.duration);
  setSelectValue(div, 'in-release-type', s.sim.release_type);
  setInputValue(div, 'in-release-dur', s.sim.release_duration);
}

function setInputValue(div: HTMLDivElement, id: string, value: number) {
  const el = div.querySelector<HTMLInputElement>(`#${id}`);
  if (el) el.value = String(value);
}

function setSelectValue(div: HTMLDivElement, id: string, value: string) {
  const el = div.querySelector<HTMLSelectElement>(`#${id}`);
  if (el) el.value = value;
}
