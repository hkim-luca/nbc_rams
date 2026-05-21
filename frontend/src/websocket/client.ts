import { useSimStore, type FrameData } from '../store';
import { setSimStatus, updateMetrics } from '../dashboard/MetricsPanel';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connect(): void {
  const store = useSimStore.getState();
  store.setConnected(false);

  ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onopen = () => {
    console.log('[WS] Connected');
    store.setConnected(true);
    const el = document.getElementById('ws-status');
    if (el) { el.textContent = 'Connected'; el.style.color = '#81c784'; }

    const msg = buildStartMessage();
    ws!.send(JSON.stringify(msg));
    store.setRunning(true);
    store.resetFrames();
    setSimStatus('Running...');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'done') {
      store.setRunning(false);
      setSimStatus('Completed');
      return;
    }
    if (data.type === 'error') {
      console.error('[WS] Error:', data.message);
      store.setRunning(false);
      setSimStatus('Error');
      return;
    }
    if (data.type === 'frame') {
      const frame: FrameData = {
        t: data.t,
        puffs: data.puffs || [],
        grid: data.grid || null,
        max_conc: data.max_conc || 0,
        max_conc_lat: data.max_conc_lat || 0,
        max_conc_lon: data.max_conc_lon || 0,
      };
      store.addFrame(frame);
      updateMetrics(frame);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    store.setConnected(false);
    store.setRunning(false);
    const el = document.getElementById('ws-status');
    if (el) { el.textContent = 'Disconnected'; el.style.color = '#aaa'; }
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function disconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  useSimStore.getState().setRunning(false);
  setSimStatus('Stopped');
}

function scheduleReconnect(): void {
  reconnectTimer = setTimeout(() => {
    if (!useSimStore.getState().running) return;
    connect();
  }, 2000);
}

function buildStartMessage(): Record<string, unknown> {
  const { source, weather, sim } = useSimStore.getState();
  return {
    type: 'start',
    source: {
      lat: source.lat, lon: source.lon,
      height: source.height, diameter: source.diameter,
      velocity: source.velocity, exit_temp: source.exit_temp,
      rate: source.rate, substance: source.substance,
      half_life: source.half_life,
    },
    weather: {
      wind_dir: weather.wind_dir, wind_speed: weather.wind_speed,
      stability: weather.stability, mix_height: weather.mix_height,
      temp: weather.temp, roughness: weather.roughness,
    },
    sim: {
      model: sim.model, domain_km: sim.domain_km,
      grid_m: sim.grid_m, n_puffs: sim.n_puffs,
      dt: sim.dt, duration: sim.duration,
      release_type: sim.release_type,
      release_duration: sim.release_duration,
    },
  };
}
