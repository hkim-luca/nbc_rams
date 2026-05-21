declare const Cesium: any;
import type { FrameData } from '../store';

let heatmapLayer: any = null;

export function updateConcentration(viewer: any, frame: FrameData): void {
  if (!frame.grid || !frame.grid.values.length) return;

  const { lats, lons, values } = frame.grid;
  const nx = lons.length;
  const ny = lats.length;

  const canvas = document.createElement('canvas');
  canvas.width = nx;
  canvas.height = ny;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(nx, ny);
  let maxVal = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = values[j]?.[i] ?? 0;
      if (v > maxVal) maxVal = v;
    }
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = values[ny - 1 - j]?.[i] ?? 0;
      const norm = maxVal > 0 ? Math.log10(1 + v) / Math.log10(1 + maxVal) : 0;
      const idx = (j * nx + i) * 4;

      if (norm > 0.001) {
        const r = Math.min(255, Math.round(norm * 255));
        const g = Math.min(255, Math.round(norm * 128));
        const b = Math.min(255, Math.round((1 - norm) * 200));
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = Math.round(Math.min(180, norm * 255));
      } else {
        imageData.data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const bounds = Cesium.Rectangle.fromDegrees(
    Math.min(...lons), Math.min(...lats),
    Math.max(...lons), Math.max(...lats),
  );

  if (heatmapLayer) {
    viewer.imageryLayers.remove(heatmapLayer, false);
  }

  heatmapLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.SingleTileImageryProvider({ url: canvas.toDataURL(), rectangle: bounds }),
  );
}

export function clearConcentration(viewer: any): void {
  if (heatmapLayer) {
    viewer.imageryLayers.remove(heatmapLayer, true);
    heatmapLayer = null;
  }
}
