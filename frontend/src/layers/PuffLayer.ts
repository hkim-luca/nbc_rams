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

export function updatePuffs(viewer: any, puffs: PuffData[]): void {
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
    const color = Cesium.Color.fromHsl(0.08 - intensity * 0.08, 0.9, 0.5 + intensity * 0.3, 0.7);

    let entity = puffEntities.get(puff.id);
    if (!entity) {
      entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, puff.z),
        point: {
          pixelSize: Math.max(3, puff.sig_y * 0.1),
          color,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
          outlineWidth: 1,
        },
        // Add bounding circle on ground
        ellipse: {
          semiMajorAxis: puff.sig_y * 2,
          semiMinorAxis: puff.sig_x * 2,
          material: color.withAlpha(0.08),
          outline: true,
          outlineColor: color.withAlpha(0.3),
          outlineWidth: 1,
          height: 0,
        },
      });
      puffEntities.set(puff.id, entity);
    } else {
      entity.position.setValue(Cesium.Cartesian3.fromDegrees(lon, lat, puff.z));
      entity.point.pixelSize = Math.max(3, puff.sig_y * 0.1);
      entity.point.color = color;
      entity.ellipse.semiMajorAxis = puff.sig_y * 2;
      entity.ellipse.semiMinorAxis = puff.sig_x * 2;
      entity.ellipse.material = color.withAlpha(0.08);
      entity.ellipse.outlineColor = color.withAlpha(0.3);
    }
  }
}

export function clearPuffs(viewer: any): void {
  for (const entity of puffEntities.values()) {
    viewer.entities.remove(entity);
  }
  puffEntities.clear();
}
