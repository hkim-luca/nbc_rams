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
