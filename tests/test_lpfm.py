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
