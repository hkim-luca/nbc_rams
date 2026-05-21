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


def pasquill_gifford_sigma(stability: str, x: float, roughness: float = 0.1) -> tuple[float, float]:
    """Compute Pasquill-Gifford dispersion coefficients at downwind distance x (m).

    Uses Briggs urban formulas. For urban areas (roughness > 0.5m),
    applies enhanced dispersion from building-induced turbulence.

    Returns (sigma_y, sigma_z) in meters.
    """
    is_urban = roughness > 0.5
    stability = stability.upper()

    # Base sigma_y (lateral)
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

    # Base sigma_z (vertical)
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

    if is_urban:
        # Urban enhancement: building-induced turbulence increases dispersion
        # Coefficients from McElroy-Pooler urban dispersion study
        urban_factor_y = 1.0 + 0.5 * (roughness / 2.0)
        urban_factor_z = 1.0 + 0.8 * (roughness / 2.0)

        # Building wake effect: initial mixing from building wakes
        building_height = roughness * 5  # Approximate building height from roughness
        wake_sy = building_height * 0.3
        wake_sz = building_height * 0.2

        sy = math.sqrt(sy**2 * urban_factor_y**2 + wake_sy**2)
        sz = math.sqrt(sz**2 * urban_factor_z**2 + wake_sz**2)

        # Urban heat island: slightly more unstable (reduces stability)
        if stability in ('E', 'F'):
            # Stable classes become near-neutral in urban areas
            sz *= 1.5
            sy *= 1.3

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
        delta_h = 21.425 * F ** 0.75 / m.wind_speed_10m
    else:
        delta_h = 38.71 * F ** 0.6 / m.wind_speed_10m

    delta_h = min(delta_h, m.mixing_height - m.stack_height - 10)
    delta_h = max(delta_h, 0)
    return m.stack_height + delta_h


def wind_profile(wind_speed_10m: float, z: float, z0: float) -> float:
    """Compute wind speed at height z using logarithmic profile.

    For urban areas (z0 > 0.5m), applies displacement height d ~ 0.7 * z0
    to account for the urban canopy effect where wind starts from above
    the building layer.

    Args:
        wind_speed_10m: Wind speed at reference height 10m (m/s)
        z: Target height (m)
        z0: Surface roughness length (m)

    Returns:
        Wind speed at height z (m/s)
    """
    if z <= z0:
        return 0.0

    if z0 > 0.5:
        # Urban canopy: displacement height d = 0.7 * building_height
        building_h = z0 * 5
        d = 0.7 * building_h
        z_eff = z - d
        z0_eff = z0 * 0.3  # Reduced effective roughness above canopy
        if z_eff <= z0_eff:
            return wind_speed_10m * 0.3  # Within canopy: greatly reduced
        return wind_speed_10m * math.log(z_eff / z0_eff) / math.log((10.0 - d) / z0_eff)

    # Standard log profile for open terrain
    return wind_speed_10m * math.log(z / z0) / math.log(10.0 / z0)


def compute_met(m: MetInput) -> MetOutput:
    """Compute all meteorological parameters from input."""
    # Effective height
    eff_h = briggs_plume_rise(m)

    # Wind speed at effective height
    u_ref = wind_profile(m.wind_speed_10m, eff_h, m.surface_roughness)

    # Wind direction: meteorological convention (0=North, clockwise) to math convention (0=East, counterclockwise)
    wind_dir_rad = math.radians(270 - m.wind_dir_deg)

    # Turbulence fluctuation velocities based on stability and urban effects
    stab = m.stability_class.upper()
    is_urban = m.surface_roughness > 0.5

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

    if is_urban:
        # Building-induced turbulence: extra TKE from building wakes
        building_h = m.surface_roughness * 5
        sigma_v = math.sqrt(sigma_v**2 + (0.2 * u_ref * building_h / 30)**2)
        sigma_w = math.sqrt(sigma_w**2 + (0.15 * u_ref * building_h / 30)**2)
        # Urban stable classes get extra mixing
        if stab in ('E', 'F'):
            sigma_v *= 1.4
            sigma_w *= 1.5

    return MetOutput(
        u_ref=u_ref,
        wind_dir_rad=wind_dir_rad,
        effective_height=eff_h,
        sig_y_coeff=sigma_v,
        sig_z_coeff=sigma_w,
        sigma_v=sigma_v,
        sigma_w=sigma_w,
    )
