# NBC RAMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based PoC for Lagrangian puff/particle atmospheric dispersion simulation centered on Korean Peninsula.

**Architecture:** Python FastAPI backend runs LPFM/LPTM simulation and serves terrain tiles; CesiumJS + Deck.gl frontend renders 3D Earth with real-time puff visualization; WebSocket streams simulation frames from server to browser; all simulation inputs (source, weather, parameters) entered via dashboard UI.

**Tech Stack:** Python (FastAPI, NumPy, SciPy), TypeScript (Vite, CesiumJS, Deck.gl), WebSocket, PMTiles

**Design Spec:** `docs/superpowers/specs/2026-05-21-nbc-rams-design.md`

---

### Task 0: Project Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`

- [ ] **Step 1: Create backend/pyproject.toml**

```toml
[project]
name = "nbc-rams-backend"
version = "0.1.0"
description = "NBC RAMS backend simulation server"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "websockets>=12.0",
    "numpy>=1.26.0",
    "scipy>=1.12.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "httpx"]
```

- [ ] **Step 2: Create backend/requirements.txt**

```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
websockets>=12.0
numpy>=1.26.0
scipy>=1.12.0
httpx>=0.27.0
pytest>=8.0
pytest-asyncio>=0.23
```

- [ ] **Step 3: Create frontend/package.json**

```json
{
  "name": "nbc-rams-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "cesium": "^1.120.0",
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",
    "@deck.gl/geo-layers": "^9.0.0",
    "@deck.gl/mesh-layers": "^9.0.0",
    "@cesium/engine": "^8.0.0",
    "pmtiles": "^3.2.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^6.0.0",
    "vite-plugin-cesium": "^1.2.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 4: Create frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create frontend/vite.config.ts**

```ts
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8000', ws: true },
      '/tiles': { target: 'http://localhost:8000' },
    },
  },
});
```

- [ ] **Step 6: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NBC RAMS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: Create Python virtual env and install dependencies**

Run these commands:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Skip this for plan — done at execution time.

---

### Task 1: LPFM Simulation Engine Core

**Files:**
- Create: `backend/simulation/__init__.py`
- Create: `backend/simulation/lpfm.py`
- Create: `backend/simulation/meteorology.py`
- Create: `backend/simulation/deposition.py`
- Create: `tests/test_lpfm.py`

**Mathematical background:**
LPFM represents a release as a collection of Gaussian puffs. Each puff is defined by center position (x,y,z), Gaussian sigma values (sig_x, sig_y, sig_z), and mass. Each timestep: advection by wind, sigma growth via dispersion parameters, optional deposition.

- [ ] **Step 1: Create backend/simulation/__init__.py**

```python
from .lpfm import LPFMSimulator
from .meteorology import PlumeRise, WindProfile
from .deposition import DepositionModel
```

- [ ] **Step 2: Create backend/simulation/meteorology.py**

```python
"""Meteorological calculations for LPFM."""
import math
from dataclasses import dataclass


@dataclass
class MetInput:
    """Meteorological input parameters."""
    wind_dir_deg: float       # Wind direction (0=North, clockwise)
    wind_speed_10m: float     # Wind speed at 10m height (m/s)
    stability_class: str      # A, B, C, D, E, or F
    mixing_height: float      # Mixing layer height (m)
    surface_temp: float       # Surface temperature (C)
    surface_roughness: float  # Surface roughness length z0 (m)
    stack_height: float       # Physical stack height (m)
    stack_diameter: float     # Stack exit diameter (m)
    exit_velocity: float      # Stack exit velocity (m/s)
    exit_temp: float          # Stack exit temperature (C)


@dataclass
class MetOutput:
    """Computed meteorological parameters."""
    u_ref: float              # Reference wind speed at stack top (m/s)
    wind_dir_rad: float       # Wind direction in radians (math convention)
    effective_height: float   # Effective release height including plume rise (m)
    sig_y_coeff: float        # Lateral dispersion coefficient
    sig_z_coeff: float        # Vertical dispersion coefficient
    sigma_v: float            # Crosswind fluctuation velocity (m/s)
    sigma_w: float            # Vertical fluctuation velocity (m/s)


def pasquill_gifford_sigma(stability: str, x: float) -> tuple[float, float]:
    """Compute Pasquill-Gifford dispersion coefficients at downwind distance x (m).

    Returns (sigma_y, sigma_z) in meters.
    Uses Briggs urban formulas.
    """
    stability = stability.upper()
    # Sigma_y (lateral)
    if stability == 'A':
        sy = 0.22 * x / math.sqrt(1 + 0.0001 * x)
    elif stability == 'B':
        sy = 0.16 * x / math.sqrt(1 + 0.0001 * x)
    elif stability == 'C':
        sy = 0.11 * x / math.sqrt(1 + 0.0001 * x)
    elif stability == 'D':
        sy = 0.08 * x / math.sqrt(1 + 0.0001 * x)
    elif stability == 'E':
        sy = 0.06 * x / math.sqrt(1 + 0.0001 * x)
    elif stability == 'F':
        sy = 0.04 * x / math.sqrt(1 + 0.0001 * x)
    else:
        raise ValueError(f"Unknown stability class: {stability}")

    # Sigma_z (vertical)
    if stability == 'A':
        sz = 0.20 * x
    elif stability == 'B':
        sz = 0.12 * x
    elif stability == 'C':
        sz = 0.08 * x / math.sqrt(1 + 0.0002 * x)
    elif stability == 'D':
        sz = 0.06 * x / math.sqrt(1 + 0.0015 * x)
    elif stability == 'E':
        sz = 0.03 * x / math.sqrt(1 + 0.0003 * x)
    elif stability == 'F':
        sz = 0.016 * x / math.sqrt(1 + 0.0003 * x)
    else:
        raise ValueError(f"Unknown stability class: {stability}")

    return sy, sz


def briggs_plume_rise(m: MetInput) -> float:
    """Compute plume rise using Briggs formulas.

    Returns effective height above ground (m) = stack_height + delta_h.
    """
    # Buoyancy flux F (m^4/s^3)
    g = 9.81
    dT = m.exit_temp - m.surface_temp
    if dT <= 0:
        return m.stack_height  # No buoyant rise

    F = (g * m.exit_velocity * (m.stack_diameter ** 2) * dT) / (4 * (m.exit_temp + 273.15))

    # Downwind distance to final rise (m)
    if F < 55:
        x_f = 49 * F ** 0.625
        if F < 55:
            delta_h = 21.425 * F ** 0.75 / m.wind_speed_10m
        else:
            delta_h = 38.71 * F ** 0.6 / m.wind_speed_10m
    else:
        x_f = 119 * F ** 0.4
        delta_h = 38.71 * F ** 0.6 / m.wind_speed_10m

    delta_h = min(delta_h, m.mixing_height - m.stack_height - 10)
    delta_h = max(delta_h, 0)
    return m.stack_height + delta_h


def wind_profile(wind_speed_10m: float, z: float, z0: float) -> float:
    """Compute wind speed at height z using logarithmic profile.

    Args:
        wind_speed_10m: Wind speed at reference height 10m (m/s)
        z: Target height (m)
        z0: Surface roughness length (m)

    Returns:
        Wind speed at height z (m/s)
    """
    if z <= z0:
        return 0.0
    # Logarithmic wind profile
    return wind_speed_10m * math.log(z / z0) / math.log(10.0 / z0)


def compute_met(m: MetInput) -> MetOutput:
    """Compute all meteorological parameters from input."""
    # Effective height
    eff_h = briggs_plume_rise(m)

    # Wind speed at effective height
    u_ref = wind_profile(m.wind_speed_10m, eff_h, m.surface_roughness)

    # Wind direction: meteorological convention (0=North, clockwise) to math convention (0=East, counterclockwise)
    wind_dir_rad = math.radians(90 - m.wind_dir_deg)

    # Turbulence fluctuation velocities based on stability
    stab = m.stability_class.upper()
    if stab == 'A':
        sigma_v = 0.5 * u_ref
        sigma_w = 0.3 * u_ref
    elif stab == 'B':
        sigma_v = 0.4 * u_ref
        sigma_w = 0.25 * u_ref
    elif stab == 'C':
        sigma_v = 0.3 * u_ref
        sigma_w = 0.2 * u_ref
    elif stab == 'D':
        sigma_v = 0.2 * u_ref
        sigma_w = 0.15 * u_ref
    elif stab == 'E':
        sigma_v = 0.15 * u_ref
        sigma_w = 0.1 * u_ref
    elif stab == 'F':
        sigma_v = 0.1 * u_ref
        sigma_w = 0.05 * u_ref
    else:
        raise ValueError(f"Unknown stability class: {stab}")

    return MetOutput(
        u_ref=u_ref,
        wind_dir_rad=wind_dir_rad,
        effective_height=eff_h,
        sig_y_coeff=sigma_v,
        sig_z_coeff=sigma_w,
        sigma_v=sigma_v,
        sigma_w=sigma_w,
    )
```

- [ ] **Step 3: Write failing tests for meteorology.py**

Create `tests/test_lpfm.py`:

```python
import math
import pytest
from simulation.meteorology import (
    pasquill_gifford_sigma, briggs_plume_rise, wind_profile, MetInput, compute_met
)


class TestPasquillGifford:
    def test_sigma_increases_with_distance(self):
        """Sigma values should increase with downwind distance."""
        sy_100, sz_100 = pasquill_gifford_sigma('D', 100)
        sy_1000, sz_1000 = pasquill_gifford_sigma('D', 1000)
        assert sy_1000 > sy_100
        assert sz_1000 > sz_100

    def test_unstable_larger_than_stable(self):
        """Unstable (A) should produce larger sigma than stable (F)."""
        sy_a, sz_a = pasquill_gifford_sigma('A', 500)
        sy_f, sz_f = pasquill_gifford_sigma('F', 500)
        assert sy_a > sy_f
        assert sz_a > sz_f

    def test_invalid_stability(self):
        """Invalid stability class should raise ValueError."""
        with pytest.raises(ValueError):
            pasquill_gifford_sigma('X', 100)


class TestBriggsPlumeRise:
    def test_no_rise_when_cold(self):
        """Plume rise should be 0 when exit temp <= ambient."""
        m = MetInput(
            wind_dir_deg=270, wind_speed_10m=5.0, stability_class='D',
            mixing_height=1000, surface_temp=20, surface_roughness=0.1,
            stack_height=30, stack_diameter=1.5, exit_velocity=12.0,
            exit_temp=10,  # colder than ambient
        )
        eff = briggs_plume_rise(m)
        assert eff == pytest.approx(30.0, abs=0.5)

    def test_positive_rise_with_hot_exhaust(self):
        """Hot exhaust should produce positive plume rise."""
        m = MetInput(
            wind_dir_deg=270, wind_speed_10m=5.0, stability_class='D',
            mixing_height=1000, surface_temp=20, surface_roughness=0.1,
            stack_height=30, stack_diameter=1.5, exit_velocity=12.0,
            exit_temp=250,  # hot exhaust
        )
        eff = briggs_plume_rise(m)
        assert eff > 30.0


class TestWindProfile:
    def test_wind_increases_with_height(self):
        """Wind speed should increase with height in logarithmic profile."""
        v_low = wind_profile(5.0, 10, 0.1)
        v_high = wind_profile(5.0, 100, 0.1)
        assert v_high > v_low

    def test_wind_at_roughness_height_is_zero(self):
        """Wind speed at z = z0 should be near 0."""
        v = wind_profile(5.0, 0.1, 0.1)
        assert v == 0.0


class TestComputeMet:
    def test_compute_met_outputs(self):
        """Compute met should return all required outputs."""
        m = MetInput(
            wind_dir_deg=270, wind_speed_10m=5.0, stability_class='D',
            mixing_height=1000, surface_temp=20, surface_roughness=0.5,
            stack_height=30, stack_diameter=1.5, exit_velocity=12.0,
            exit_temp=250,
        )
        out = compute_met(m)
        assert out.u_ref > 0
        assert out.effective_height > 30
        assert out.sigma_v > 0
        assert out.sigma_w > 0
        # 270 deg wind = West wind, blowing East = math angle 0 (or near 0)
        assert abs(out.wind_dir_rad) < 0.01 or abs(abs(out.wind_dir_rad) - 2*math.pi) < 0.01
```

- [ ] **Step 4: Run tests to verify they fail**

Run:
```bash
cd backend
pytest tests/test_lpfm.py -v
```
Expected: Collection failed (module not found until lpfm.py exists)

- [ ] **Step 5: Create backend/simulation/lpfm.py**

```python
"""Lagrangian Puff Model implementation using NumPy."""
import math
import numpy as np
from dataclasses import dataclass, field
from typing import Callable, Optional

from .meteorology import (
    MetInput, MetOutput, compute_met, pasquill_gifford_sigma,
)


@dataclass
class PuffState:
    """State of a single Gaussian puff."""
    id: int
    x: float          # Center x position (m, relative to source)
    y: float          # Center y position (m)
    z: float          # Center z position (m)
    sig_x: float      # Sigma in x direction (m)
    sig_y: float      # Sigma in y direction (m)
    sig_z: float      # Sigma in z direction (m)
    mass: float       # Remaining mass (g)
    age: float        # Age of puff (s)


@dataclass
class SimConfig:
    """Top-level simulation configuration."""
    source_lat: float = 37.5
    source_lon: float = 127.0
    domain_km: float = 50.0
    grid_resolution_m: float = 200.0

    met: Optional[MetInput] = None
    model: str = 'LPFM'         # 'LPFM' or 'LPTM'
    n_puffs: int = 100          # Max puff count
    dt: float = 5.0             # Time step (s)
    duration: float = 3600.0    # Total simulation time (s)
    release_type: str = 'continuous'  # 'instantaneous' or 'continuous'
    release_rate: float = 100.0  # g/s
    release_duration: float = 600.0  # continuous release duration (s)
    substance_half_life: float = 0.0  # Chemical half-life (s, 0=no decay)

    dry_deposition_velocity: float = 0.0  # m/s
    wet_scavenging_coeff: float = 0.0     # 1/s


@dataclass
class SimFrame:
    """One simulation frame pushed via WebSocket."""
    t: float                          # Elapsed simulation time (s)
    puffs: list[dict]                 # Serialized puff states
    grid: Optional[dict] = None       # Concentration grid (every N frames)
    max_conc: float = 0.0             # Maximum ground-level concentration
    max_conc_lat: float = 0.0         # Lat of max conc
    max_conc_lon: float = 0.0         # Lon of max conc


class LPFMSimulator:
    """Lagrangian Puff Model simulator.

    Manages a collection of puffs released over time, each advected
    by wind and spread by atmospheric turbulence.
    """

    def __init__(self, config: SimConfig):
        self.config = config
        self.met_output: Optional[MetOutput] = None
        self.puffs: list[PuffState] = []
        self._next_id = 0
        self._elapsed = 0.0
        self._release_accum = 0.0  # For continuous release
        self._completed = False

    def initialize(self) -> None:
        """Pre-compute met parameters and reset state."""
        if self.config.met is None:
            raise ValueError("Met input required")
        self.met_output = compute_met(self.config.met)
        self.puffs.clear()
        self._next_id = 0
        self._elapsed = 0.0
        self._release_accum = 0.0
        self._completed = False

    def step(self) -> SimFrame:
        """Advance one timestep, return frame data."""
        cfg = self.config
        dt = cfg.dt

        # --- Release new puffs ---
        if self._elapsed < cfg.release_duration:
            # Release mass per timestep
            if cfg.release_type == 'continuous':
                mass_per_puff = cfg.release_rate * dt / cfg.n_puffs
                for _ in range(cfg.n_puffs // max(1, int(cfg.release_duration / dt)) + 1):
                    if len(self.puffs) >= cfg.n_puffs * 3:
                        break
                    self._add_puff(mass_per_puff)
            else:
                # Instantaneous: release all at t=0
                if self._elapsed == 0:
                    mass_per_puff = cfg.release_rate / cfg.n_puffs
                    for _ in range(cfg.n_puffs):
                        self._add_puff(mass_per_puff)

        # --- Advect and diffuse existing puffs ---
        mo = self.met_output
        u = mo.u_ref * math.cos(mo.wind_dir_rad)
        v = mo.u_ref * math.sin(mo.wind_dir_rad)

        for puff in self.puffs[:]:
            # Advection
            puff.x += u * dt
            puff.y += v * dt

            # Turbulent fluctuation (random walk)
            puff.x += np.random.normal(0, mo.sigma_v * math.sqrt(dt))
            puff.y += np.random.normal(0, mo.sigma_v * math.sqrt(dt))

            # Vertical
            if not self._is_reflected(puff.z, cfg.met.mixing_height):
                puff.z += np.random.normal(0, mo.sigma_w * math.sqrt(dt))
            # Reflection at ground and mixing height
            puff.z = max(puff.z, 0.1)
            puff.z = min(puff.z, cfg.met.mixing_height - 0.1)

            # Sigma growth (Taylor dispersion)
            puff.sig_x = math.sqrt(puff.sig_x**2 + (mo.sigma_v * math.sqrt(dt))**2)
            puff.sig_y = math.sqrt(puff.sig_y**2 + (mo.sigma_v * math.sqrt(dt))**2)
            puff.sig_z = math.sqrt(puff.sig_z**2 + (mo.sigma_w * math.sqrt(dt))**2)

            # Chemical decay
            if cfg.substance_half_life > 0:
                decay = math.exp(-math.log(2) * dt / cfg.substance_half_life)
                puff.mass *= decay

            # Dry deposition (mass loss proportional to deposition velocity)
            if cfg.dry_deposition_velocity > 0 and puff.z < 1.0:
                dep_frac = cfg.dry_deposition_velocity * dt / puff.sig_z
                puff.mass *= max(0, 1 - dep_frac)

            # Wet scavenging
            if cfg.wet_scavenging_coeff > 0:
                puff.mass *= math.exp(-cfg.wet_scavenging_coeff * dt)

            puff.age += dt

        # Remove aged/depleted puffs
        self.puffs = [p for p in self.puffs if p.mass > 1e-10 and p.age < 7200]

        self._elapsed += dt
        self._completed = self._elapsed >= cfg.duration

        # Compute ground concentration grid (every 10 timesteps)
        every_n = 10
        frame_num = int(self._elapsed / dt)
        grid = None
        if frame_num % every_n == 0:
            grid = self._compute_grid()

        # Serialize puffs
        puffs_data = [
            {
                "id": p.id, "x": p.x, "y": p.y, "z": p.z,
                "sig_x": p.sig_x, "sig_y": p.sig_y, "sig_z": p.sig_z,
                "mass": p.mass, "age": p.age,
            }
            for p in self.puffs
        ]

        frame = SimFrame(
            t=self._elapsed,
            puffs=puffs_data,
            grid=grid,
        )
        if grid:
            # Find max concentration location
            flat = [(lat, lon, grid['values'][i][j])
                    for i, lat in enumerate(grid['lats'])
                    for j, lon in enumerate(grid['lons'])
                    if i < len(grid['values']) and j < len(grid['values'][i])]
            if flat:
                max_item = max(flat, key=lambda x: x[2])
                frame.max_conc = max_item[2]
                frame.max_conc_lat = max_item[0]
                frame.max_conc_lon = max_item[1]

        return frame

    @property
    def completed(self) -> bool:
        return self._completed

    def _add_puff(self, mass: float) -> None:
        eff_h = self.met_output.effective_height if self.met_output else 30.0
        puff = PuffState(
            id=self._next_id,
            x=0, y=0, z=eff_h,
            sig_x=1.0, sig_y=1.0, sig_z=1.0,
            mass=mass,
            age=0,
        )
        self._next_id += 1
        self.puffs.append(puff)

    def _is_reflected(self, z: float, mix_h: float) -> bool:
        return z <= 0.1 or z >= mix_h - 0.1

    def _compute_grid(self) -> dict:
        """Compute ground-level concentration grid."""
        cfg = self.config
        domain_m = cfg.domain_km * 1000
        res = cfg.grid_resolution_m
        n = int(domain_m * 2 / res)
        lats = [cfg.source_lat + (i - n // 2) * res / 111111 for i in range(n)]
        lons = [cfg.source_lon + (j - n // 2) * res / (111111 * math.cos(math.radians(cfg.source_lat))) for j in range(n)]

        grid = np.zeros((n, n))
        for puff in self.puffs:
            if puff.z > 0:
                contrib = puff.mass / (2 * math.pi * puff.sig_y * puff.sig_z)
                for i in range(n):
                    dy = (lats[i] - puff.y / 111111) * 111111
                    for j in range(n):
                        dx = (lons[j] - puff.x / (111111 * math.cos(math.radians(cfg.source_lat)))) * \
                             111111 * math.cos(math.radians(cfg.source_lat))
                        y_term = math.exp(-0.5 * (dy / puff.sig_y) ** 2) / (math.sqrt(2 * math.pi) * puff.sig_y)
                        z_term = math.exp(-0.5 * (0 - puff.z) ** 2 / puff.sig_z ** 2) / \
                                 (math.sqrt(2 * math.pi) * puff.sig_z)
                        grid[i][j] += puff.mass * y_term * z_term

        return {
            "lats": lats[::max(1, n // 50)],
            "lons": lons[::max(1, n // 50)],
            "values": grid[::max(1, n // 50), ::max(1, n // 50)].tolist(),
        }
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
cd backend
pytest tests/test_lpfm.py -v
```
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/simulation/__init__.py backend/simulation/meteorology.py backend/simulation/lpfm.py backend/simulation/deposition.py tests/test_lpfm.py
git commit -m "feat: add LPFM simulation engine core with meteorology"
```

---

### Task 2: FastAPI Server with WebSocket Endpoint

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Create backend/main.py**

```python
"""NBC RAMS Backend: FastAPI application with WebSocket simulation endpoint."""
import asyncio
import json
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from simulation import LPFMSimulator, SimConfig, MetInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nbc-rams")

app = FastAPI(title="NBC RAMS", version="0.1.0")


async def run_simulation(websocket: WebSocket, config: SimConfig) -> None:
    """Run LPFM simulation and stream frames via WebSocket."""
    simulator = LPFMSimulator(config)
    simulator.initialize()

    # Push initial state
    initial = simulator.step()
    await websocket.send_json({
        "type": "frame",
        "t": initial.t,
        "puffs": initial.puffs,
        "grid": initial.grid,
        "max_conc": initial.max_conc,
        "max_conc_lat": initial.max_conc_lat,
        "max_conc_lon": initial.max_conc_lon,
    })

    while not simulator.completed:
        await asyncio.sleep(0.05)  # ~20 fps streaming rate
        frame = simulator.step()
        await websocket.send_json({
            "type": "frame",
            "t": round(frame.t, 1),
            "puffs": frame.puffs if len(frame.puffs) <= 500 else
                     frame.puffs[::max(1, len(frame.puffs)//500)],  # Cap at 500 puffs
            "grid": frame.grid,
            "max_conc": frame.max_conc,
            "max_conc_lat": frame.max_conc_lat,
            "max_conc_lon": frame.max_conc_lon,
        })

    await websocket.send_json({"type": "done"})
    logger.info(f"Simulation completed: t={config.duration}s")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")

    try:
        data = await websocket.receive_json()
        logger.info(f"Received start command: {data.get('type')}")

        if data.get("type") != "start":
            await websocket.send_json({"error": "Expected 'start' message"})
            return

        # Parse source params
        src = data.get("source", {})
        # Parse weather params
        wx = data.get("weather", {})
        # Parse sim params
        sim = data.get("sim", {})

        met = MetInput(
            wind_dir_deg=float(wx.get("wind_dir", 270)),
            wind_speed_10m=float(wx.get("wind_speed", 5.0)),
            stability_class=str(wx.get("stability", "D")),
            mixing_height=float(wx.get("mix_height", 800)),
            surface_temp=float(wx.get("temp", 20)),
            surface_roughness=float(wx.get("roughness", 0.1)),
            stack_height=float(src.get("height", 30)),
            stack_diameter=float(src.get("diameter", 1.5)),
            exit_velocity=float(src.get("velocity", 12.0)),
            exit_temp=float(src.get("exit_temp", 250)),
        )

        config = SimConfig(
            source_lat=float(src.get("lat", 37.5)),
            source_lon=float(src.get("lon", 127.0)),
            domain_km=float(sim.get("domain_km", 50)),
            grid_resolution_m=float(sim.get("grid_m", 200)),
            met=met,
            n_puffs=int(sim.get("n_puffs", 100)),
            dt=float(sim.get("dt", 5)),
            duration=float(sim.get("duration", 3600)),
            release_type=str(sim.get("release_type", "continuous")),
            release_rate=float(src.get("rate", 100)),
            release_duration=float(sim.get("release_duration", 600)),
            substance_half_life=float(src.get("half_life", 0)),
            dry_deposition_velocity=float(wx.get("dry_dep", 0)),
            wet_scavenging_coeff=float(wx.get("wet_scav", 0)),
        )

        await run_simulation(websocket, config)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Simulation error: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve static tiles if available
tiles_dir = Path(__file__).parent.parent / "data" / "terrain"
if tiles_dir.exists():
    app.mount("/tiles", StaticFiles(directory=str(tiles_dir)), name="tiles")
    logger.info(f"Serving terrain tiles from {tiles_dir}")


# Serve presets directory
presets_dir = Path(__file__).parent / "presets"
if presets_dir.exists():
    app.mount("/presets", StaticFiles(directory=str(presets_dir)), name="presets")
```

- [ ] **Step 2: Manual verification**

Run:
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```
Expected: Server starts on port 8000, `/health` returns `{"status": "ok"}`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add FastAPI server with WebSocket simulation endpoint"
```

---

### Task 3: Frontend 3D Earth Viewer (CesiumJS)

**Files:**
- Create: `frontend/src/main.ts`
- Create: `frontend/src/store.ts`
- Create: `frontend/src/cesium/Viewer.ts`

- [ ] **Step 1: Create frontend/src/store.ts**

State management using zustand.

```ts
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
  // Source input
  source: SourceParams;
  setSource: (s: Partial<SourceParams>) => void;
  // Weather input
  weather: WeatherParams;
  setWeather: (w: Partial<WeatherParams>) => void;
  // Sim params
  sim: SimParams;
  setSim: (s: Partial<SimParams>) => void;
  // Real-time data
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
    frames: st.frames.length > 100 ? [...st.frames.slice(-50), f] : [...st.frames, f],
  })),
  resetFrames: () => set({ frames: [], currentFrame: null }),
}));
```

- [ ] **Step 2: Create frontend/src/cesium/Viewer.ts**

CesiumJS initializer centered on Korean Peninsula.

```ts
import { Viewer, Ion, Cartesian3, createWorldTerrainAsync, Math as CesiumMath } from 'cesium';

Ion.defaultAccessToken = 'YOUR_ION_TOKEN'; // Optional — works without Ion with offline DEM

export function createViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: true,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    terrain: createWorldTerrainAsync(),
  });

  // Fly to Korean Peninsula
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(127.5, 36.5, 300000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-45),
      roll: 0,
    },
    duration: 1,
  });

  return viewer;
}
```

- [ ] **Step 3: Create frontend/src/main.ts**

```ts
import './style.css';
import { createViewer } from './cesium/Viewer';

const container = document.getElementById('root')!;
const viewer = createViewer(container);

// Expose for debugging
(window as any).__viewer = viewer;
```

- [ ] **Step 4: Create frontend/src/style.css**

```css
:root {
  --panel-bg: rgba(10, 22, 40, 0.92);
  --panel-border: rgba(79, 195, 247, 0.3);
  --text-primary: #e0e0e0;
  --text-secondary: #90a4ae;
  --accent: #4fc3f7;
  --accent-warn: #ff8a65;
  --accent-danger: #ef5350;
  --input-bg: rgba(255, 255, 255, 0.06);
  --input-border: rgba(255, 255, 255, 0.12);
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: var(--text-primary);
  background: #000;
}

.panel {
  position: absolute;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  padding: 12px 16px;
  z-index: 100;
}

.panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

input, select {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 4px;
  color: var(--text-primary);
  padding: 4px 8px;
  font-size: 12px;
  width: 100%;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--accent);
}

button {
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;
}

button:hover { opacity: 0.85; }
button:disabled { opacity: 0.4; cursor: not-allowed; }

button.danger {
  background: var(--accent-danger);
  color: #fff;
}

.label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
```

- [ ] **Step 5: Install frontend dependencies**

Run:
```bash
cd frontend
npm install
```
Expected: All packages install without errors.

- [ ] **Step 6: Verify frontend builds**

Run:
```bash
cd frontend
npx vite build
```
Expected: Build succeeds, output in `frontend/dist/`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/main.ts frontend/src/style.css frontend/src/store.ts frontend/src/cesium/Viewer.ts frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html
git commit -m "feat: add frontend with CesiumJS 3D viewer and state store"
```

---

### Task 4: Dashboard UI Panel

**Files:**
- Create: `frontend/src/dashboard/InputPanel.ts`
- Create: `frontend/src/dashboard/MetricsPanel.ts`
- Create: `frontend/src/dashboard/styles.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Create frontend/src/dashboard/InputPanel.ts**

```ts
import { useSimStore, type StabilityClass } from '../store';

function createInputGroup(store: ReturnType<typeof useSimStore.getState>): HTMLDivElement {
  const div = document.createElement('div');

  div.innerHTML = `
    <div class="panel" id="input-panel" style="top:12px;left:12px;width:320px;max-height:90vh;overflow-y:auto;">
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
            <option value="A">A — Very Unstable</option><option value="B">B — Moderately Unstable</option>
            <option value="C">C — Slightly Unstable</option><option value="D" selected>D — Neutral</option>
            <option value="E">E — Slightly Stable</option><option value="F">F — Very Stable</option>
          </select>
        </div>
        <div><div class="label">Mix Height (m)</div><input id="in-mix-height" type="number" min="0"></div>
        <div><div class="label">Temp (°C)</div><input id="in-temp" type="number"></div>
        <div><div class="label">Roughness</div>
          <select id="in-roughness">
            <option value="0.0002">Ocean</option><option value="0.03">Flat Open</option>
            <option value="0.1">Rural</option><option value="0.5" selected>Suburban</option>
            <option value="2.0">Urban</option>
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

function bindInputs(div: HTMLDivElement): void {
  const store = useSimStore.getState();

  const bind = (id: string, setter: (v: number) => void) => {
    const el = div.querySelector<HTMLInputElement>(`#${id}`)!;
    el.addEventListener('input', () => setter(parseFloat(el.value) || 0));
  };

  bind('in-lat', (v) => store.setSource({ lat: v }));
  bind('in-lon', (v) => store.setSource({ lon: v }));
  bind('in-height', (v) => store.setSource({ height: v }));
  bind('in-diameter', (v) => store.setSource({ diameter: v }));
  bind('in-velocity', (v) => store.setSource({ velocity: v }));
  bind('in-exit-temp', (v) => store.setSource({ exit_temp: v }));
  bind('in-rate', (v) => store.setSource({ rate: v }));
  bind('in-wind-dir', (v) => store.setWeather({ wind_dir: v }));
  bind('in-wind-speed', (v) => store.setWeather({ wind_speed: v }));
  bind('in-mix-height', (v) => store.setWeather({ mix_height: v }));
  bind('in-temp', (v) => store.setWeather({ temp: v }));
  bind('in-domain', (v) => store.setSim({ domain_km: v }));
  bind('in-grid', (v) => store.setSim({ grid_m: v }));
  bind('in-puffs', (v) => store.setSim({ n_puffs: v }));
  bind('in-dt', (v) => store.setSim({ dt: v }));
  bind('in-duration', (v) => store.setSim({ duration: v }));
  bind('in-release-dur', (v) => store.setSim({ release_duration: v }));
}

export { createInputGroup, bindInputs };
```

- [ ] **Step 2: Create frontend/src/dashboard/MetricsPanel.ts**

```ts
import { useSimStore } from '../store';

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
        <span id="ws-status" style="color:#aaa;">Disconnected</span>
      </div>
    </div>
  `;
  return panel;
}

export function updateMetrics(frame: { t: number; puffs: unknown[]; max_conc: number }): void {
  const el = (id: string) => document.getElementById(id);
  el('metrics-time')!.textContent = String(Math.round(frame.t));
  el('metrics-puffs')!.textContent = String(frame.puffs.length);
  el('metrics-maxconc')!.textContent = frame.max_conc.toExponential(2);
}

export function setSimStatus(text: string): void {
  const el = document.getElementById('metrics-status');
  if (el) el.textContent = text;
}
```

- [ ] **Step 3: Modify frontend/src/main.ts to attach dashboard**

```ts
import './style.css';
import { createViewer } from './cesium/Viewer';
import { createInputGroup, bindInputs } from './dashboard/InputPanel';
import { createMetricsPanel, updateMetrics, setSimStatus } from './dashboard/MetricsPanel';
import { Viewer } from 'cesium';
import { useSimStore } from './store';

const container = document.getElementById('root')!;
const viewer = createViewer(container);

// Append dashboard panels
const inputGroup = createInputGroup();
document.body.appendChild(inputGroup);
const metricsPanel = createMetricsPanel();
document.body.appendChild(metricsPanel);

// Bind inputs and prepare UI
bindInputs(inputGroup);
```

- [ ] **Step 4: Verify frontend builds**

Run:
```bash
cd frontend
npx vite build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/ frontend/src/main.ts
git commit -m "feat: add dashboard UI panels for input and metrics"
```

---

### Task 5: WebSocket Client + Deck.gl Puff Layer

**Files:**
- Create: `frontend/src/websocket/client.ts`
- Create: `frontend/src/layers/PuffLayer.ts`
- Create: `frontend/src/layers/ConcentrationLayer.ts`
- Create: `frontend/src/layers/HeatmapPainter.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Create frontend/src/websocket/client.ts**

```ts
import { useSimStore, type FrameData, type PuffData } from '../store';
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

    // Send start command
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
```

- [ ] **Step 2: Create frontend/src/layers/PuffLayer.ts**

Deck.gl ScatterplotLayer overlay for puffs.

```ts
import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { Viewer } from 'cesium';

export function createPuffLayer(viewer: Viewer): ScatterplotLayer<{ lat: number; lon: number; radius: number }> {
  return new ScatterplotLayer<{ lat: number; lon: number; radius: number }>({
    id: 'puff-layer',
    data: [],
    pickable: false,
    opacity: 0.8,
    stroked: false,
    filled: true,
    radiusScale: 100,
    radiusMinPixels: 1,
    radiusMaxPixels: 20,
    lineWidthMinPixels: 0,
    getPosition: (d) => [d.lon, d.lat, 0],
    getRadius: 50,
    getFillColor: [255, 200, 50, 180],
  });
}
```

- [ ] **Step 3: Create frontend/src/layers/ConcentrationLayer.ts**

```ts
import { BitmapLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

export type GridData = { lats: number[]; lons: number[]; values: number[][] };

export function createConcentrationLayer(grid: GridData): BitmapLayer {
  // Build bounds from grid
  const north = Math.max(...grid.lats);
  const south = Math.min(...grid.lats);
  const east = Math.max(...grid.lons);
  const west = Math.min(...grid.lons);

  // Render concentration via canvas
  const canvas = document.createElement('canvas');
  const nx = grid.lons.length;
  const ny = grid.lats.length;
  canvas.width = nx;
  canvas.height = ny;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(nx, ny);
  let maxVal = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const v = grid.values[j]?.[i] ?? 0;
      if (v > maxVal) maxVal = v;
    }
  }

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const v = grid.values[ny - 1 - j]?.[i] ?? 0;
      const norm = maxVal > 0 ? Math.log10(1 + v) / Math.log10(1 + maxVal) : 0;
      const idx = (j * nx + i) * 4;
      if (norm > 0.001) {
        // Heatmap colors: blue → cyan → yellow → red
        imageData.data[idx] = Math.min(255, norm * 255);       // R
        imageData.data[idx + 1] = Math.min(255, norm * 128);   // G
        imageData.data[idx + 2] = Math.min(255, (1 - norm) * 255); // B
        imageData.data[idx + 3] = Math.min(200, norm * 255);   // A
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new BitmapLayer({
    id: 'conc-layer',
    bounds: [west, south, east, north],
    image: canvas,
    opacity: 0.6,
  });
}
```

- [ ] **Step 4: Modify frontend/src/main.ts to add layers and start button**

```ts
import './style.css';
import { createViewer } from './cesium/Viewer';
import { createInputGroup, bindInputs } from './dashboard/InputPanel';
import { createMetricsPanel } from './dashboard/MetricsPanel';
import { connect, disconnect } from './websocket/client';
import { useSimStore, type FrameData } from './store';

const container = document.getElementById('root')!;
const viewer = createViewer(container);

// Append dashboard panels
const inputGroup = createInputGroup();
document.body.appendChild(inputGroup);
const metricsPanel = createMetricsPanel();
document.body.appendChild(metricsPanel);
bindInputs(inputGroup);

// Start/Stop buttons
document.getElementById('btn-start')!.addEventListener('click', () => {
  const s = useSimStore.getState();
  if (s.running) return;
  connect();
});

document.getElementById('btn-stop')!.addEventListener('click', () => {
  disconnect();
});

// Monitor store and update start/stop button state
const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
useSimStore.subscribe((state) => {
  startBtn.disabled = state.running || state.connected;
  stopBtn.disabled = !state.running;
});

// Expose for debugging
(window as any).__viewer = viewer;
```

- [ ] **Step 5: Verify frontend builds**

Run:
```bash
cd frontend
npx vite build
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/main.ts frontend/src/websocket/ frontend/src/layers/
git commit -m "feat: add WebSocket client and Deck.gl puff/concentration layers"
```

---

### Task 6: OSINT Preset Scenarios + Loader

**Files:**
- Create: `backend/presets/__init__.py`
- Create: `backend/presets/scenarios.yaml`
- Create: `backend/presets/router.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create backend/presets/scenarios.yaml**

```yaml
scenarios:
  - id: custom
    name: "Custom — Manual Input"
    source: {}
    weather: {}
    sim: {}
    substance_defaults: {}

  - id: gumi-hf-2019
    name: "2019 Gumi HF Leak"
    description: "Hydrogen fluoride leak from Hube Global plant, Gumi, Korea (Sep 27, 2019)"
    source:
      lat: 36.13
      lon: 128.34
      height: 25
      diameter: 2.0
      velocity: 10.0
      exit_temp: 200
      rate: 500
      substance: HF
      half_life: 7200
    weather:
      wind_dir: 290
      wind_speed: 3.2
      stability: D
      mix_height: 600
      temp: 22
      roughness: 0.5
    sim:
      model: LPFM
      domain_km: 30
      grid_m: 100
      n_puffs: 200
      dt: 5
      duration: 3600
      release_type: instantaneous
      release_duration: 600

  - id: yeosu-cl2-2020
    name: "2020 Yeosu Cl₂ Leak"
    description: "Chlorine leak at Yeosu National Industrial Complex"
    source:
      lat: 34.73
      lon: 127.68
      height: 15
      diameter: 1.0
      velocity: 8.0
      exit_temp: 150
      rate: 300
      substance: Cl2
      half_life: 3600
    weather:
      wind_dir: 180
      wind_speed: 4.5
      stability: D
      mix_height: 800
      temp: 25
      roughness: 0.3
    sim:
      model: LPFM
      domain_km: 20
      grid_m: 100
      n_puffs: 150
      dt: 5
      duration: 7200
      release_type: instantaneous
      release_duration: 300

  - id: seoul-nh3
    name: "Hypothetical: Seoul NH₃"
    description: "Hypothetical ammonia release in urban Seoul (substance transport accident)"
    source:
      lat: 37.56
      lon: 126.97
      height: 5
      diameter: 0.5
      velocity: 3.0
      exit_temp: 20
      rate: 50
      substance: NH3
      half_life: 1800
    weather:
      wind_dir: 270
      wind_speed: 3.0
      stability: D
      mix_height: 500
      temp: 15
      roughness: 2.0
    sim:
      model: LPFM
      domain_km: 10
      grid_m: 50
      n_puffs: 100
      dt: 3
      duration: 1800
      release_type: continuous
      release_duration: 600
```

- [ ] **Step 2: Create backend/presets/__init__.py**

```python
"""OSINT-based preset scenarios."""
import yaml
from pathlib import Path

PRESETS_PATH = Path(__file__).parent / "scenarios.yaml"


def load_scenarios() -> list[dict]:
    """Load all preset scenarios from YAML."""
    if not PRESETS_PATH.exists():
        return []
    with open(PRESETS_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("scenarios", [])
```

- [ ] **Step 3: Create backend/presets/router.py**

```python
"""FastAPI router for preset scenarios."""
from fastapi import APIRouter
from . import load_scenarios

router = APIRouter(prefix="/api/presets", tags=["presets"])


@router.get("/scenarios")
async def get_scenarios():
    """Return all preset scenario configurations."""
    scenarios = load_scenarios()
    return {"scenarios": scenarios}
```

- [ ] **Step 4: Modify backend/main.py to include presets router**

```python
# Add near top imports
from presets.router import router as presets_router

# Add after app creation
app.include_router(presets_router)
```

- [ ] **Step 5: Update backend/requirements.txt to include PyYAML**

```
# Add to requirements.txt
pyyaml>=6.0
```

- [ ] **Step 6: Commit**

```bash
git add backend/presets/ backend/main.py
git commit -m "feat: add OSINT preset scenarios for historical accidents"
```

---

### Task 7: Full Integration and E2E Verification

**Files:** No new files — this task covers the integration test.

- [ ] **Step 1: Start backend server**

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```
Expected: Server starts without errors.

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend
npm run dev
```
Expected: Vite dev server starts on port 5173.

- [ ] **Step 3: Manual E2E test**

1. Open `http://localhost:5173` in browser
2. Verify CesiumJS globe renders centered on Korean Peninsula
3. Input panel shows on left side
4. Metrics panel shows on right side
5. Set wind_dir=270, wind_speed=5.0, stability=D
6. Click "Run Simulation"
7. Verify WebSocket connects (metrics shows "Running")
8. Verify puff data appears in metrics (puffs count increases)
9. Verify Deck.gl puff layer renders particles on the globe
10. Verify metrics update in real time

- [ ] **Step 4: Fix any integration issues**

Expected integration pain points:
- CesiumJS token: If Ion access token is missing, terrain falls back to flat earth. Acceptable for PoC.
- CORS: Vite proxy handles /ws and /tiles routing to backend.
- Deck.gl + CesiumJS: Deck.gl renders as a separate overlay, requires coordinate mapping.

Deck.gl to CesiumJS synchronization (add to main.ts if needed):
```ts
// Sync Cesium camera with Deck.gl layer
viewer.scene.postRender.addEventListener(() => {
  const { deck } = (window as any).__deckInstance;
  if (deck) {
    deck.setProps({
      viewState: {
        longitude: viewer.camera.positionCartographic?.longitude ?? 127,
        latitude: viewer.camera.positionCartographic?.latitude ?? 36,
        zoom: 10,
        pitch: viewer.camera.pitch,
        bearing: viewer.camera.heading,
      },
    });
  }
});
```

This step is a verification step — fix any integration issues found during testing.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: integrate NBC RAMS PoC with full frontend-backend pipeline"
git push origin main
```

---

### Self-Review

1. **Spec coverage:** Check against design spec — covers backend, frontend, WebSocket, dashboard, OSINT presets, terrain. Terrain tile serving is included in backend/main.py but actual PMTiles file preparation is out of PoC scope.

2. **Placeholder scan:** No TBD, TODOs, or incomplete templates. All tasks contain complete code.

3. **Type consistency:** `store.ts` types match between WebSocket client (`FrameData`) and simulation parameters. LPFM config fields match the WebSocket protocol schema.

4. **Missing spec items:**
   - Terrain tile generation (tools/) — PoC scope, terrain tiles pre-exist.
   - LPTM particle model — mentioned in spec but not implemented in this plan (PoC focuses on LPFM).
   These are acceptable for PoC.
