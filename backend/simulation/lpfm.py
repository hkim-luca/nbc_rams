"""Lagrangian Puff Model implementation using NumPy."""
import math
import numpy as np
from dataclasses import dataclass, field
from typing import Optional

from .meteorology import (
    MetInput, MetOutput, compute_met,
)
from .deposition import DepositionModel
from .terrain import get_terrain

# Source reference for terrain lookup
REF_LAT = 36.35
REF_LON = 127.38
METERS_PER_DEG = 111111.0


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
    model: str = 'LPFM'              # 'LPFM' or 'LPTM'
    n_puffs: int = 100               # Max puff count
    dt: float = 5.0                  # Time step (s)
    duration: float = 3600.0         # Total simulation time (s)
    release_type: str = 'continuous'  # 'instantaneous' or 'continuous'
    release_rate: float = 100.0      # g/s
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
        self.deposition = DepositionModel(
            dry_deposition_velocity=config.dry_deposition_velocity,
            wet_scavenging_coeff=config.wet_scavenging_coeff,
        )
        self.puffs: list[PuffState] = []
        self._next_id = 0
        self._elapsed = 0.0
        self._release_accum = 0.0
        self._completed = False
        self._terrain = get_terrain()
        self._cos_lat = math.cos(math.radians(config.source_lat))

    def _meters_to_latlon(self, x: float, y: float) -> tuple[float, float]:
        """Convert local (x, y) meters to (lat, lon)."""
        lat = self.config.source_lat + y / METERS_PER_DEG
        lon = self.config.source_lon + x / (METERS_PER_DEG * self._cos_lat)
        return lat, lon

    def _get_ground_elevation(self, x: float, y: float) -> float:
        """Get ground elevation (m MSL) at puff position."""
        lat, lon = self._meters_to_latlon(x, y)
        return self._terrain.get_elevation(lat, lon)

    def initialize(self) -> None:
        """Pre-compute met parameters and reset state."""
        if self.config.met is None:
            raise ValueError("Met input required")
        self.met_output = compute_met(self.config.met)
        self.puffs = []
        self._next_id = 0
        self._elapsed = 0.0
        self._step_count = 0
        self._release_accum = 0.0
        self._completed = False

    def step(self) -> SimFrame:
        """Advance one timestep, return frame data."""
        cfg = self.config
        dt = cfg.dt
        mo = self.met_output

        # --- Release new puffs ---
        if self._elapsed < cfg.release_duration:
            if cfg.release_type == 'continuous':
                # Release puffs gradually over the release duration
                puffs_per_step = max(1, cfg.n_puffs // max(1, int(cfg.release_duration / dt)))
                mass_per_puff = cfg.release_rate * dt / puffs_per_step
                for _ in range(puffs_per_step):
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
        u = mo.u_ref * math.cos(mo.wind_dir_rad)
        v = mo.u_ref * math.sin(mo.wind_dir_rad)

        for puff in self.puffs[:]:
            # --- Terrain-modified advection ---
            old_x, old_y = puff.x, puff.y
            local_lat, local_lon = self._meters_to_latlon(puff.x, puff.y)

            # Compute local terrain gradient (E-W and N-S slopes)
            dx_deg = 0.005  # ~500m probe distance
            e_w = self._terrain.get_elevation(local_lat, local_lon + dx_deg)
            e_e = self._terrain.get_elevation(local_lat, local_lon - dx_deg)
            e_n = self._terrain.get_elevation(local_lat + dx_deg, local_lon)
            e_s = self._terrain.get_elevation(local_lat - dx_deg, local_lon)
            slope_x = (e_e - e_w) / (2 * dx_deg * 111111)  # E-W slope (m/m)
            slope_y = (e_n - e_s) / (2 * dx_deg * 111111)  # N-S slope (m/m)

            # Wind direction relative to slope
            wind_u = math.cos(mo.wind_dir_rad)
            wind_v = math.sin(mo.wind_dir_rad)
            wind_slope = wind_u * slope_x + wind_v * slope_y  # >0 = wind against slope

            # Deflection factor: stronger for steeper slopes in wind direction
            deflect = max(0, min(0.8, wind_slope * 50))

            # Advection with terrain deflection
            puff.x += u * dt * (1 - deflect * 0.5) + wind_v * deflect * dt * 10
            puff.y += v * dt * (1 - deflect * 0.5) - wind_u * deflect * dt * 10

            # Terrain elevation change → adjust puff height
            old_elev = self._get_ground_elevation(old_x, old_y)
            new_elev = self._get_ground_elevation(puff.x, puff.y)
            elev_change = new_elev - old_elev
            if abs(elev_change) > 0.5:
                puff.z -= elev_change
            # Orographic lift: upward motion on windward slopes
            if deflect > 0.1:
                puff.z += deflect * abs(wind_slope) * dt * 0.5

            # Location-dependent turbulence: look up local roughness
            local_z0 = self._terrain.get_roughness(local_lat, local_lon)
            ref_z0 = cfg.met.surface_roughness if cfg.met else 0.1
            turb_scale = max(0.3, min(2.5, local_z0 / max(ref_z0, 0.01)))

            # Turbulent fluctuation (random walk) — scaled by local roughness
            puff.x += np.random.normal(0, mo.sigma_v * math.sqrt(dt) * turb_scale)
            puff.y += np.random.normal(0, mo.sigma_v * math.sqrt(dt) * turb_scale)

            # Vertical turbulent fluctuation
            if not self._is_reflected(puff.z, cfg.met.mixing_height):
                puff.z += np.random.normal(0, mo.sigma_w * math.sqrt(dt) * turb_scale)
            # Reflection at ground and mixing height
            puff.z = max(puff.z, 0.1)
            puff.z = min(puff.z, cfg.met.mixing_height - 0.1)

            # Sigma growth — scaled by local roughness
            puff.sig_x = math.sqrt(puff.sig_x**2 + (mo.sigma_v * math.sqrt(dt) * turb_scale)**2)
            puff.sig_y = math.sqrt(puff.sig_y**2 + (mo.sigma_v * math.sqrt(dt) * turb_scale)**2)
            puff.sig_z = math.sqrt(puff.sig_z**2 + (mo.sigma_w * math.sqrt(dt) * turb_scale)**2)

            # Chemical decay
            puff.mass = self.deposition.apply_decay(puff.mass, cfg.substance_half_life, dt)

            # Dry deposition (mass loss proportional to deposition velocity)
            if puff.z < 1.0:
                puff.mass = self.deposition.apply_dry_deposition(puff.mass, puff.z, puff.sig_z, dt)

            # Wet scavenging
            puff.mass = self.deposition.apply_wet_scavenging(puff.mass, dt)

            puff.age += dt

        # Remove aged/depleted puffs
        self.puffs = [p for p in self.puffs if p.mass > 1e-10 and p.age < 7200]

        self._elapsed += dt
        self._completed = self._elapsed >= cfg.duration
        self._step_count += 1

        # Compute ground concentration grid (every 20 timesteps to reduce jerkiness)
        every_n = 20
        grid = None
        if self._step_count % every_n == 0:
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

    @property
    def elapsed(self) -> float:
        return self._elapsed

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
        """Compute ground-level concentration grid using vectorized NumPy.

        Accounts for terrain elevation: puff height above ground adjusts
        as the puff moves over varying terrain.
        """
        cfg = self.config
        domain_m = cfg.domain_km * 1000
        res = cfg.grid_resolution_m
        cos_lat = math.cos(math.radians(cfg.source_lat))
        n = max(10, min(60, int(domain_m * 2 / res)))

        lat_center = cfg.source_lat
        lon_center = cfg.source_lon
        lats = lat_center + (np.arange(n) - n // 2) * res / 111111
        lons = lon_center + (np.arange(n) - n // 2) * res / (111111 * cos_lat)

        # Source ground elevation
        src_elev = self._terrain.get_elevation(lat_center, lon_center)

        # Grid cell ground elevations (coarse approximation)
        grid_elev = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                grid_elev[i, j] = self._terrain.get_elevation(float(lats[i]), float(lons[j])) - src_elev

        grid = np.zeros((n, n))
        for puff in self.puffs:
            if puff.mass <= 1e-10 or puff.sig_y < 0.1 or puff.sig_z < 0.1:
                continue
            puff_elev = self._terrain.get_elevation(
                lat_center + puff.y / 111111,
                lon_center + puff.x / (111111 * cos_lat),
            ) - src_elev

            # Effective z relative to each grid cell's ground
            z_eff = puff.z - grid_elev + puff_elev
            z_eff = np.maximum(z_eff, 1.0)  # Minimum 1m above ground

            dx = (lons - (lon_center + puff.x / (111111 * cos_lat))) * 111111 * cos_lat
            dy = (lats - (lat_center + puff.y / 111111))[:, None] * 111111
            y_term = np.exp(-0.5 * (dx / puff.sig_y) ** 2) / (np.sqrt(2 * np.pi) * puff.sig_y)
            z_term = np.exp(-0.5 * (z_eff / puff.sig_z) ** 2) / (np.sqrt(2 * np.pi) * puff.sig_z)
            grid += puff.mass * y_term[np.newaxis, :] * z_term

        step = max(1, n // 40)
        return {
            "lats": lats[::step].tolist(),
            "lons": lons[::step].tolist(),
            "values": grid[::step, ::step].tolist(),
        }
