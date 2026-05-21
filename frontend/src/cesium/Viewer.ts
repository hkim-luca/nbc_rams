import {
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  UrlTemplateImageryProvider,
  Ion,
} from 'cesium';

export function createViewer(container: HTMLElement): Viewer | null {
  const DAEJEON_LAT = 36.35;
  const DAEJEON_LON = 127.38;

  try {
    Ion.defaultAccessToken = '';

    const viewer = new Viewer(container, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
    });

    // Replace default imagery with Google satellite
    const layer = viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maximumZoomLevel: 20,
      }),
    );
    // Move satellite layer below default (or remove default)
    viewer.imageryLayers.raiseToTop(layer);

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 5000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-35),
        roll: 0,
      },
      duration: 0,
    });

    return viewer;
  } catch (err) {
    console.error('Cesium error:', err);
    container.innerHTML =
      `<div style="color:#e0e0e0;padding:30px;text-align:center;font-family:sans-serif">
        <h2 style="margin-bottom:12px">NBC RAMS</h2>
        <p style="color:#ff8a65">3D viewer error</p>
        <pre style="font-size:12px;margin-top:12px;color:#aaa">${String(err)}</pre>
      </div>`;
    return null;
  }
}
