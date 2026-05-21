"""Dry and wet deposition models for LPFM."""
import math
from dataclasses import dataclass


@dataclass
class DepositionModel:
    """Deposition parameters for puff mass removal."""
    dry_deposition_velocity: float = 0.0  # m/s
    wet_scavenging_coeff: float = 0.0     # 1/s

    def apply_dry_deposition(self, mass: float, z: float, sig_z: float, dt: float) -> float:
        """Apply dry deposition mass loss."""
        if self.dry_deposition_velocity <= 0 or z > 1.0:
            return mass
        dep_frac = self.dry_deposition_velocity * dt / max(sig_z, 0.1)
        return mass * max(0.0, 1.0 - dep_frac)

    def apply_wet_scavenging(self, mass: float, dt: float) -> float:
        """Apply wet scavenging mass loss."""
        if self.wet_scavenging_coeff <= 0:
            return mass
        return mass * math.exp(-self.wet_scavenging_coeff * dt)

    def apply_decay(self, mass: float, half_life: float, dt: float) -> float:
        """Apply chemical decay (first-order kinetics)."""
        if half_life <= 0:
            return mass
        decay = math.exp(-math.log(2) * dt / half_life)
        return mass * decay
