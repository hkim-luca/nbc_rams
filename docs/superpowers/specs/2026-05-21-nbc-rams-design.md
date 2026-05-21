# NBC RAMS Design Specification

Date: 2026-05-21 | Status: Approved

## Overview

NBC RAMS (Nuclear-Biological-Chemical Risk Assessment & Modeling System) is a web-based atmospheric dispersion simulation platform centered on the Korean Peninsula. It uses Lagrangian Puff Models (LPFM) and Lagrangian Particle Models (LPTM) to simulate hazardous substance dispersion with 3D terrain visualization.

**Scope:** Proof of Concept (PoC)

## Architecture

```
Browser (CesiumJS + Deck.gl)
  ├── 3D Earth View (DEM + Buildings + Trees)
  ├── Puff/Particle Layer (Deck.gl)
  └── Dashboard Panel (Input, Metrics, Control)
         │
         │ WebSocket
         ▼
Python Backend (FastAPI)
  ├── Simulation Engine (NumPy/SciPy)
  ├── Terrain Tile Server (PMTiles)
  └── OSINT Data Pipeline (Static YAML Presets)
```

- Python FastAPI backend runs simulation on server
- Results streamed to browser via WebSocket
- All simulation inputs entered via Dashboard UI
- Terrain served as pre-processed static tiles

## Dashboard Input Parameters

### Source
- Lat/Lon (map click input)
- Release type: instantaneous / continuous
- Release rate: g/s (continuous) or g (instantaneous)
- Substance: dropdown with auto-filled half-life
- Stack height (m), diameter (m), exit velocity (m/s), exit temperature (C)
- Calculated effective height (Briggs plume rise)

### Weather
- Wind direction (deg), wind speed (m/s at 10m)
- Atmospheric stability: A/B/C/D/E/F (Pasquill-Gifford)
- Mixing height (m)
- Temperature (C)
- Surface roughness (m) with presets: ocean(0.0001) / flat(0.03) / rural(0.1) / suburban(0.5) / urban(2.0)

### Simulation
- Model: LPFM / LPTM
- Domain radius (km), grid resolution (m)
- Number of puffs/particles, time step (s), total duration (s)

### Deposition (optional)
- Dry deposition velocity (m/s)
- Wet scavenging coefficient (1/s)

### Terrain Display
- DEM toggle, Buildings toggle, Trees toggle

## Dashboard Monitoring Output
- Real-time concentration heatmap overlay
- Maximum ground-level concentration tracking
- Puff/particle 3D trajectory lines
- Vertical cross-section profile at selected point

## Data Flow & WebSocket Protocol

### Client → Server (start simulation)
```json
{
  "type": "start",
  "source": { "lat": 37.5, "lon": 127.0, "height": 30, "diameter": 1.5,
              "velocity": 12.0, "temp": 250.0, "rate": 100.0, "substance": "SO2" },
  "weather": { "wind_dir": 270, "wind_speed": 3.5, "stability": "D",
               "mix_height": 800, "temp": 20.0, "roughness": 0.5 },
  "sim": { "model": "LPFM", "domain_km": 50, "grid_m": 200,
           "n_puffs": 100, "dt": 5, "duration": 3600 }
}
```

### Server → Client (per timestep)
```json
{
  "type": "frame",
  "t": 300,
  "puffs": [
    { "id": 0, "x": ..., "y": ..., "z": ..., "sig_x": ..., "sig_y": ..., "sig_z": ..., "mass": ... }
  ],
  "grid": { "lats": [...], "lons": [...], "values": [[...]] },
  "metrics": { "max_conc": 0.0012, "max_conc_loc": [37.52, 127.05] }
}
```

- `puffs`: every frame for real-time animation
- `grid`: every N frames for concentration heatmap (reduced bandwidth)

## 3D Terrain Pipeline (Korean Peninsula)

Bounds: 33-43N, 124-132E

| Layer | Source | Processing | Format |
|-------|--------|------------|--------|
| DEM | SRTM 30m / ASTER | GDAL → PMTiles CLI | PMTiles (quantized-mesh) |
| Buildings | Overture Maps (OSM-based) | Custom script → 3D Tiles | b3dm |
| Trees | Global Forest Watch / Korea Forest Service | Instanced 3D Tiles | pnts |

- All tiles pre-processed before PoC runtime
- Served statically by FastAPI

## OSINT Data Pipeline

| Data | Source | Purpose |
|------|--------|---------|
| Historical chemical accidents | KOSHA, OECD E-chemportal | Scenario presets |
| Industrial complex locations | Korea Industrial Complex Corp OpenAPI, Overture Maps | Source location presets |
| Hazardous material facilities | MOE PRTR | Substance defaults |
| Weather stations | KMA ASOS (historical) | Scenario validation |

- All data pre-collected as YAML presets
- Dashboard "Load Scenario" dropdown populates all input fields

## Technology Stack

| Layer | Technology |
|-------|-----------|
| 3D Globe | CesiumJS 1.120+ |
| Overlay Layers | Deck.gl 9.0+ |
| Frontend | TypeScript 5.x, Vite 6.x |
| Backend | FastAPI 0.110+, uvicorn |
| Simulation | NumPy, SciPy |
| Real-time | WebSocket (websockets) |
| Terrain | PMTiles, 3D Tiles (b3dm, pnts) |
| Data Processing | GDAL, PMTiles CLI |

## Project Structure

```
nbc_rams/
├── frontend/
│   ├── src/
│   │   ├── cesium/          # CesiumJS Viewer, TerrainProvider
│   │   ├── layers/          # Deck.gl particle/concentration layers
│   │   ├── dashboard/       # Input forms, real-time metrics, charts
│   │   └── websocket/       # WebSocket client
│   └── public/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket endpoint
│   ├── simulation/
│   │   ├── lpfm.py          # Lagrangian Puff Model
│   │   ├── lptm.py          # Lagrangian Particle Model
│   │   ├── meteorology.py   # Plume rise, stability, wind profile
│   │   └── deposition.py    # Dry/wet deposition
│   ├── terrain/             # PMTiles serving
│   └── presets/             # OSINT scenario YAML presets
├── data/
│   ├── terrain/             # Processed PMTiles (.pmtiles)
│   └── presets/             # Accident scenarios, facility data
└── tools/
    ├── fetch_dem.py
    ├── build_tiles.py
    └── fetch_osint.py
```

## Testing Strategy

| Layer | Target | Tool | Criteria |
|-------|--------|------|-----------|
| Numerical | LPFM/LPTM engine | pytest | Gaussian plume comparison (steady-state), mass conservation < 5% |
| Regression | Simulation output | pytest + snapshot | Known scenario input → expected concentration range |
| Integration | WebSocket protocol | pytest-asyncio | Message serialization, frame loss, reconnect |
| E2E | Dashboard → 3D render | Playwright | Full pipeline: input → WebSocket → visualization |

## Scenarios

1. **Custom**: User-defined source and weather
2. **2019 Gumi HF leak**: Historical recreation
3. **2020 Yeosu Cl2 leak**: Historical recreation
4. **Hypothetical Seoul NH3**: Urban dispersion scenario
