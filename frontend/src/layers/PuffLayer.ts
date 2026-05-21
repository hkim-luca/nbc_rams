import {
  Color, Cartesian3, NearFarScalar,
} from 'cesium';
import type { Viewer } from 'cesium';
import type { PuffData } from '../store';

const puffEntities: Map<number, any> = new Map();
const REF_LAT = 36.35;
const REF_LON = 127.38;
const METERS_PER_DEG_LAT = 111111;

function metersToDegrees(x: number, y: number): [number, number] {
  const dlat = y / METERS_PER_DEG_LAT;
  const dlon = x / (METERS_PER_DEG_LAT * Math.cos(REF_LAT * Math.PI / 180));
  return [REF_LAT + dlat, REF_LON + dlon];
}

export function updatePuffs(viewer: Viewer, puffs: PuffData[]): void {
  const activeIds = new Set(puffs.map((p) => p.id));

  for (const [id, entity] of puffEntities) {
    if (!activeIds.has(id)) {
      viewer.entities.remove(entity);
      puffEntities.delete(id);
    }
  }

  for (const puff of puffs) {
    const [lat, lon] = metersToDegrees(puff.x, puff.y);
    const intensity = Math.min(1, puff.mass / 500);
    const color = Color.fromHsl(0.08 - intensity * 0.08, 0.9, 0.5 + intensity * 0.3, 0.7);

    let entity = puffEntities.get(puff.id);
    if (!entity) {
      entity = viewer.entities.add({
        position: Cartesian3.fromDegrees(lon, lat, puff.z),
        point: {
          pixelSize: Math.max(2, puff.sig_y * 0.05),
          color,
          outlineColor: Color.WHITE.withAlpha(0.2),
          outlineWidth: 0,
          scaleByDistance: new NearFarScalar(1e3, 1, 1e6, 0.1),
        } as any,
      });
      puffEntities.set(puff.id, entity);
    } else {
      entity.position!.setValue(Cartesian3.fromDegrees(lon, lat, puff.z));
      (entity.point as any).pixelSize = Math.max(2, puff.sig_y * 0.05);
      entity.point!.color = color;
    }
  }
}

export function clearPuffs(viewer: Viewer): void {
  for (const entity of puffEntities.values()) {
    viewer.entities.remove(entity);
  }
  puffEntities.clear();
}
