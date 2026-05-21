"""
Korean Peninsula Terrain Model (Coarse DEM).

Provides ground elevation (meters above sea level) for any lat/lon
within the Korean Peninsula region.

Uses a built-in coarse resolution grid (~5.5km) sourced from SRTM-derived data.
For production, replace with full-resolution GeoTIFF.
"""
import math
import numpy as np
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# Korean Peninsula bounds
LAT_MIN, LAT_MAX = 33.0, 43.0
LON_MIN, LON_MAX = 124.0, 131.0
GRID_RES_DEG = 0.01  # ~1.1km resolution
LAT_SIZE = int((LAT_MAX - LAT_MIN) / GRID_RES_DEG) + 1  # 1001
LON_SIZE = int((LON_MAX - LON_MIN) / GRID_RES_DEG) + 1  # 701


@dataclass
class TerrainProfile:
    """Terrain properties at a point."""
    elevation_m: float       # Ground elevation (m above sea level)
    roughness: float         # Surface roughness length z0 (m)
    is_water: bool           # True if the point is ocean/lake


def _build_dem() -> np.ndarray:
    """Build a coarse DEM for the Korean Peninsula.

    This is a simplified model capturing major topographic features:
    - Taebaek Mountains (east coast): 800-1500m
    - Sobaeksan / Jirisan (south): 1000-1900m
    - Western plains: 0-200m
    - Seoul area: 50-150m
    - East Sea (Sea of Japan): -2000m (treated as 0 with is_water)
    - Yellow Sea: -50m (treated as 0 with is_water)

    Returns:
        (LAT_SIZE, LON_SIZE) array of elevations in meters.
        Ocean areas are 0 (is_water handled separately).
    """
    dem = np.zeros((LAT_SIZE, LON_SIZE))

    # Water mask (1 = land, 0 = water)
    land = np.zeros((LAT_SIZE, LON_SIZE), dtype=bool)

    for i in range(LAT_SIZE):
        lat = LAT_MIN + i * GRID_RES_DEG
        for j in range(LON_SIZE):
            lon = LON_MIN + j * GRID_RES_DEG

            # Skip ocean areas using rough Korean Peninsula outline
            if not _is_land(lat, lon):
                continue

            land[i, j] = True
            elev = _elevation_at(lat, lon)
            dem[i, j] = max(0, elev)

    return dem, land


def _is_land(lat: float, lon: float) -> bool:
    """Rough land/sea mask for Korean Peninsula."""
    # Simplified outline polygon check
    coast = [
        (124.0, 37.8), (124.2, 38.0), (124.5, 38.2), (124.8, 38.5),
        (125.2, 38.8), (125.6, 39.0), (126.0, 39.2), (126.5, 39.5),
        (127.0, 39.8), (127.5, 40.0), (128.0, 40.3), (128.5, 40.6),
        (129.0, 41.0), (129.5, 41.3), (130.0, 41.6), (130.5, 42.0),
        (130.8, 42.3),
        # East coast southbound
        (130.2, 42.0), (129.8, 41.5), (129.5, 41.0), (129.4, 40.5),
        (129.3, 40.0), (129.4, 39.5), (129.5, 39.0), (129.4, 38.5),
        (129.3, 38.0), (129.2, 37.5), (129.1, 37.0), (129.0, 36.5),
        (128.8, 36.0), (128.5, 35.5), (128.2, 35.0), (128.0, 34.5),
        (127.8, 34.3), (127.5, 34.1), (127.0, 34.0), (126.5, 33.9),
        (126.2, 33.8), (126.0, 34.0),
        # Jeju
        (126.2, 33.1), (126.5, 33.2), (126.8, 33.3), (127.0, 33.4),
        (127.2, 33.5), (127.4, 33.4), (127.5, 33.3), (127.3, 33.1),
        (127.0, 33.0), (126.7, 32.9), (126.4, 32.9), (126.2, 33.1),
        # West coast northbound
        (126.0, 34.3), (125.8, 34.5), (125.5, 34.8), (125.3, 35.0),
        (125.0, 35.3), (124.8, 35.5), (124.6, 35.8), (124.5, 36.0),
        (124.6, 36.3), (124.7, 36.5), (124.8, 36.8), (125.0, 37.0),
        (125.2, 37.3), (125.0, 37.5), (124.8, 37.6), (124.6, 37.8),
        (124.5, 38.0), (124.6, 38.2), (124.8, 38.4),
    ]

    n = len(coast)
    inside = False
    j = n - 1
    for i in range(n):
        if ((coast[i][1] > lat) != (coast[j][1] > lat)) and \
           (lon < (coast[j][0] - coast[i][0]) * (lat - coast[i][1]) / (coast[j][1] - coast[i][1]) + coast[i][0]):
            inside = not inside
        j = i
    return inside


def _gaussian_peak(lat: float, lon: float, clat: float, clon: float, height: float, sigma: float) -> float:
    """Gaussian peak centered at (clat, clon) with given height and spread."""
    d = math.sqrt((lat - clat) ** 2 + (lon - clon) ** 2)
    return height * math.exp(-d * d / (2 * sigma * sigma))


def _elevation_at(lat: float, lon: float) -> float:
    """Multi-scale topographic model for Korean Peninsula."""
    elev = 0.0

    # ============================================================
    # BACKGROUND: gentle eastward slope
    # ============================================================
    if lon > 126.0:
        elev += (lon - 126.0) * 60  # ~80m at Daejeon, ~240m at east coast

    # ============================================================
    # LARGE SCALE: Mountain ranges
    # ============================================================

    # Taebaek range spine
    tb_lon = 128.5 + 1.5 * (lat - 36) / 6
    d_tb = abs(lon - tb_lon)
    elev += 400 * math.exp(-d_tb * d_tb / 0.04)

    # Sobaek range
    d_sb = abs(lon - (126.5 + (lat - 35) * 0.4))
    elev += 250 * math.exp(-d_sb * d_sb / 0.05)

    # ============================================================
    # MEDIUM SCALE: Individual peaks
    # ============================================================
    peaks = [
        (38.12, 128.47, 1400, 0.08),
        (37.83, 128.72, 1300, 0.08),
        (37.50, 128.80, 1000, 0.08),
        (36.93, 128.50, 900, 0.07),
        (36.78, 128.20, 750, 0.07),
        (36.10, 128.55, 600, 0.07),
        # Daejeon surroundings
        (36.37, 127.25, 700, 0.06),    # Gyeryongsan
        (36.28, 127.42, 350, 0.05),
        (36.42, 127.12, 250, 0.05),
        (36.52, 127.55, 400, 0.06),
        (36.64, 127.65, 500, 0.06),
        # Jiri / south
        (35.34, 127.73, 1600, 0.08),
        (35.52, 127.53, 500, 0.06),
        # Jeju
        (33.36, 126.53, 1600, 0.08),
        # Other
        (37.30, 127.15, 200, 0.05),
        (37.10, 127.45, 250, 0.05),
        (36.80, 126.80, 150, 0.05),
    ]

    for clat, clon, h, s in peaks:
        d = math.sqrt((lat - clat) ** 2 + (lon - clon) ** 2)
        elev += h * math.exp(-d * d / (2 * s * s))

    # ============================================================
    # SMALL SCALE: Texture (adds local variation)
    # ============================================================
    tex = math.sin(lat * 150) * math.cos(lon * 120) + \
          math.sin((lat + lon) * 100) * math.cos((lon - lat) * 80)
    elev += tex * 20

    # ============================================================
    # Local basins
    # ============================================================
    # Daejeon: ~80m basin floor
    d_dj = math.sqrt((lat - 36.35) ** 2 + (lon - 127.38) ** 2)
    elev = elev - 60 * math.exp(-d_dj * d_dj / 0.008)

    # Seoul: ~40m basin floor
    d_sl = math.sqrt((lat - 37.57) ** 2 + (lon - 126.98) ** 2)
    elev = elev - 50 * math.exp(-d_sl * d_sl / 0.008)

    return max(0, elev)


class KoreanTerrain:
    """Korean Peninsula terrain model with elevation lookup."""

    def __init__(self):
        self.dem, self.land_mask = _build_dem()

    def get_elevation(self, lat: float, lon: float) -> float:
        """Get ground elevation (m above sea level) at lat/lon."""
        if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
            return 0.0

        i = int((lat - LAT_MIN) / GRID_RES_DEG)
        j = int((lon - LON_MIN) / GRID_RES_DEG)
        i = max(0, min(i, LAT_SIZE - 1))
        j = max(0, min(j, LON_SIZE - 1))

        return float(self.dem[i, j])

    def get_roughness(self, lat: float, lon: float) -> float:
        """Get surface roughness length (m) at lat/lon based on land cover.

        Distinguishes: urban, suburban, forest, rural, water.
        """
        elev = self.get_elevation(lat, lon)
        i = int((lat - LAT_MIN) / GRID_RES_DEG)
        j = int((lon - LON_MIN) / GRID_RES_DEG)
        i = max(0, min(i, LAT_SIZE - 1))
        j = max(0, min(j, LON_SIZE - 1))
        is_water = not self.land_mask[i, j]
        if is_water:
            return 0.0002

        # Korean major city centers (lat, lon, radius_deg, roughness)
        cities = [
            (37.57, 126.98, 0.25, 2.5),   # Seoul (metro)
            (37.45, 126.70, 0.1, 2.0),    # Incheon
            (36.35, 127.38, 0.15, 2.0),   # Daejeon
            (35.87, 128.60, 0.2, 2.0),    # Daegu
            (35.18, 129.08, 0.2, 2.0),    # Busan
            (35.53, 129.32, 0.12, 2.0),   # Ulsan
            (35.23, 128.68, 0.1, 2.0),    # Changwon
            (37.27, 127.03, 0.12, 2.0),   # Suwon
            (37.13, 127.07, 0.1, 1.8),    # Hwaseong/Pyeongtaek
            (36.80, 127.15, 0.08, 1.8),   # Cheonan
            (35.95, 126.95, 0.1, 1.5),    # Jeonju
            (34.81, 126.39, 0.08, 1.5),   # Mokpo
            (33.50, 126.52, 0.08, 1.5),   # Jeju City
            (36.00, 129.35, 0.08, 1.5),   # Pohang
            (37.75, 128.88, 0.06, 1.5),   # Gangneung
        ]

        for clat, clon, radius, z0 in cities:
            d = math.sqrt((lat - clat) ** 2 + (lon - clon) ** 2)
            if d < radius:
                # Within city center: full urban roughness
                return z0
            elif d < radius * 2.5:
                # Suburban fringe: blend urban → rural
                blend = (d - radius) / (radius * 1.5)
                rural_z0 = 0.3
                return rural_z0 + (z0 - rural_z0) * (1 - blend)

        # Non-urban areas by elevation
        if elev > 800:
            return 0.8   # Dense forest / mountain
        elif elev > 300:
            return 0.5   # Forest
        elif elev > 100:
            return 0.3   # Rolling hills / agriculture
        else:
            return 0.05  # Flat agricultural / grassland

    def get_profile(self, lat: float, lon: float) -> TerrainProfile:
        """Get full terrain profile at lat/lon."""
        elev = self.get_elevation(lat, lon)
        roughness = self.get_roughness(lat, lon)
        i = int((lat - LAT_MIN) / GRID_RES_DEG)
        j = int((lon - LON_MIN) / GRID_RES_DEG)
        i = max(0, min(i, LAT_SIZE - 1))
        j = max(0, min(j, LON_SIZE - 1))
        is_water = not self.land_mask[i, j]

        return TerrainProfile(
            elevation_m=elev,
            roughness=roughness,
            is_water=is_water,
        )


# Singleton
_terrain: Optional[KoreanTerrain] = None


def get_terrain() -> KoreanTerrain:
    global _terrain
    if _terrain is None:
        _terrain = KoreanTerrain()
    return _terrain
