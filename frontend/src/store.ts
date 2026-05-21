import { create } from 'zustand';

export type StabilityClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type ReleaseType = 'continuous' | 'instantaneous';

export interface SourceParams {
  lat: number;
  lon: number;
  height: number;
  diameter: number;
  velocity: number;
  exit_temp: number;
  rate: number;
  substance: string;
  half_life: number;
}

export interface WeatherParams {
  wind_dir: number;
  wind_speed: number;
  stability: StabilityClass;
  mix_height: number;
  temp: number;
  roughness: number;
}

export interface SimParams {
  model: 'LPFM' | 'LPTM';
  domain_km: number;
  grid_m: number;
  n_puffs: number;
  dt: number;
  duration: number;
  release_type: ReleaseType;
  release_duration: number;
}

export interface PuffData {
  id: number;
  x: number;
  y: number;
  z: number;
  sig_x: number;
  sig_y: number;
  sig_z: number;
  mass: number;
  age: number;
}

export interface FrameData {
  t: number;
  puffs: PuffData[];
  grid: { lats: number[]; lons: number[]; values: number[][] } | null;
  max_conc: number;
  max_conc_lat: number;
  max_conc_lon: number;
}

export interface SimState {
  source: SourceParams;
  setSource: (s: Partial<SourceParams>) => void;
  weather: WeatherParams;
  setWeather: (w: Partial<WeatherParams>) => void;
  sim: SimParams;
  setSim: (s: Partial<SimParams>) => void;
  connected: boolean;
  running: boolean;
  currentFrame: FrameData | null;
  frames: FrameData[];
  setConnected: (v: boolean) => void;
  setRunning: (v: boolean) => void;
  addFrame: (f: FrameData) => void;
  resetFrames: () => void;
}

export const useSimStore = create<SimState>((set) => ({
  source: {
    lat: 37.5, lon: 127.0,
    height: 30, diameter: 1.5, velocity: 12.0,
    exit_temp: 250, rate: 100,
    substance: 'SO2', half_life: 0,
  },
  setSource: (s) => set((st) => ({ source: { ...st.source, ...s } })),

  weather: {
    wind_dir: 270, wind_speed: 5.0,
    stability: 'D', mix_height: 800,
    temp: 20, roughness: 0.5,
  },
  setWeather: (w) => set((st) => ({ weather: { ...st.weather, ...w } })),

  sim: {
    model: 'LPFM', domain_km: 50, grid_m: 200,
    n_puffs: 100, dt: 5, duration: 3600,
    release_type: 'continuous', release_duration: 600,
  },
  setSim: (s) => set((st) => ({ sim: { ...st.sim, ...s } })),

  connected: false,
  running: false,
  currentFrame: null,
  frames: [],
  setConnected: (v) => set({ connected: v }),
  setRunning: (v) => set({ running: v }),
  addFrame: (f) => set((st) => ({
    currentFrame: f,
    frames: st.frames.length > 100
      ? [...st.frames.slice(-50), f]
      : [...st.frames, f],
  })),
  resetFrames: () => set({ frames: [], currentFrame: null }),
}));
