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
        delta_h = 21.425 * F ** 0.75 / m.wind_speed_10m
    else:
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
    wind_dir_rad = math.radians(270 - m.wind_dir_deg)

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
