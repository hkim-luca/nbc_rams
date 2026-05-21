"""NBC RAMS Backend: FastAPI application with WebSocket simulation endpoint."""
import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from simulation import LPFMSimulator, SimConfig, MetInput
from presets.router import router as presets_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nbc-rams")

app = FastAPI(title="NBC RAMS", version="0.1.0")
app.include_router(presets_router)


async def _step_sim(simulator, loop):
    """Run a simulation step in a thread to avoid blocking the event loop."""
    return await loop.run_in_executor(None, simulator.step)


async def run_simulation(websocket: WebSocket, config: SimConfig) -> None:
    """Run LPFM simulation and stream frames via WebSocket."""
    simulator = LPFMSimulator(config)
    simulator.initialize()
    loop = asyncio.get_event_loop()

    # Push initial state
    initial = await _step_sim(simulator, loop)
    await websocket.send_json({
        "type": "frame",
        "t": initial.t, "puffs": initial.puffs, "grid": initial.grid,
        "max_conc": initial.max_conc,
        "max_conc_lat": initial.max_conc_lat,
        "max_conc_lon": initial.max_conc_lon,
    })

    while not simulator.completed:
        await asyncio.sleep(0.05)

        frame = await _step_sim(simulator, loop)
        puffs = frame.puffs
        if len(puffs) > 500:
            puffs = puffs[::max(1, len(puffs) // 500)]

        await websocket.send_json({
            "type": "frame",
            "t": round(frame.t, 1),
            "puffs": puffs,
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
