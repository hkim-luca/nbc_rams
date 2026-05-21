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
    // Brighter: from cyan (low) through yellow to red (high)
    const hue = 0.55 - intensity * 0.5;
    const color = Cesium.Color.fromHsl(Math.max(0, hue), 1.0, 0.6, 0.9);
    const outlineColor = Cesium.Color.fromHsl(Math.max(0, hue), 1.0, 0.8, 0.6);

    let entity = puffEntities.get(puff.id);
    if (!entity) {
      entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(puff.z, 10)),
        point: {
          pixelSize: Math.max(6, puff.sig_y * 0.3),
          color,
          outlineColor,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ellipse: {
          semiMajorAxis: Math.max(puff.sig_y * 3, 50),
          semiMinorAxis: Math.max(puff.sig_x * 3, 50),
          material: color.withAlpha(0.15),
          outline: true,
          outlineColor: color.withAlpha(0.4),
          outlineWidth: 2,
          height: 0,
        },
      });
      puffEntities.set(puff.id, entity);
    } else {
      entity.position.setValue(Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(puff.z, 10)));
      entity.point.pixelSize = Math.max(6, puff.sig_y * 0.3);
      entity.point.color = color;
      entity.point.outlineColor = outlineColor;
      entity.ellipse.semiMajorAxis = Math.max(puff.sig_y * 3, 50);
      entity.ellipse.semiMinorAxis = Math.max(puff.sig_x * 3, 50);
      entity.ellipse.material = color.withAlpha(0.15);
      entity.ellipse.outlineColor = color.withAlpha(0.4);
    }
  }
}

export function clearPuffs(viewer: any): void {
  for (const entity of puffEntities.values()) {
    viewer.entities.remove(entity);
  }
  puffEntities.clear();
}
