import type { FrameData } from '../store';

let heatmapLayer: any = null;

const HEAT_COLORS = [
  [0, 0, 0, 0],       // transparent
  [0, 128, 255, 140],   // blue
  [0, 255, 200, 160],   // cyan
  [0, 255, 50, 180],    // green-yellow
  [255, 255, 0, 200],   // yellow
  [255, 128, 0, 220],   // orange
  [255, 0, 0, 240],     // red
  [200, 0, 100, 255],   // magenta
];

function getHeatColor(norm: number): [number, number, number, number] {
  const idx = norm * (HEAT_COLORS.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, HEAT_COLORS.length - 1);
  const t = idx - i0;
  const c0 = HEAT_COLORS[i0];
  const c1 = HEAT_COLORS[i1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * t),
    Math.round(c0[1] + (c1[1] - c0[1]) * t),
    Math.round(c0[2] + (c1[2] - c0[2]) * t),
    Math.round(c0[3] + (c1[3] - c0[3]) * t),
  ];
}

export function updateConcentration(viewer: any, frame: FrameData): void {
  if (!frame.grid || !frame.grid.values.length || !frame.grid.values[0]?.length) return;

  const { lats, lons, values } = frame.grid;
  if (lats.length < 2 || lons.length < 2) return;

  const nx = lons.length;
  const ny = lats.length;
  const canvas = document.createElement('canvas');
  canvas.width = nx;
  canvas.height = ny;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(nx, ny);

  let maxVal = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = values[j]?.[i] ?? 0;
      if (v > maxVal) maxVal = v;
    }

  if (maxVal < 1e-10) return;

  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = values[ny - 1 - j]?.[i] ?? 0;
      const norm = Math.log10(1 + v) / Math.log10(1 + maxVal);
      const idx = (j * nx + i) * 4;
      if (norm > 0.005) {
        const [r, g, b, a] = getHeatColor(Math.min(1, norm));
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = a;
      }
    }
  ctx.putImageData(imageData, 0, 0);

  const bounds = Cesium.Rectangle.fromDegrees(
    Math.min(...lons), Math.min(...lats),
    Math.max(...lons), Math.max(...lats),
  );

  if (heatmapLayer) viewer.imageryLayers.remove(heatmapLayer, false);
  heatmapLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.SingleTileImageryProvider({ url: canvas.toDataURL(), rectangle: bounds }),
  );
}

export function clearConcentration(viewer: any): void {
  if (heatmapLayer) { viewer.imageryLayers.remove(heatmapLayer, true); heatmapLayer = null; }
}
