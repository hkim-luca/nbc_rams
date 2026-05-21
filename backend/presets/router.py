"""FastAPI router for preset scenarios."""
from fastapi import APIRouter
from . import load_scenarios

router = APIRouter(prefix="/api/presets", tags=["presets"])


@router.get("/scenarios")
async def get_scenarios():
    """Return all preset scenario configurations."""
    scenarios = load_scenarios()
    return {"scenarios": scenarios}
