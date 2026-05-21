declare const Cesium: any;

export function createViewer(container: HTMLElement): any {
  const DAEJEON_LAT = 36.35;
  const DAEJEON_LON = 127.38;

  try {
    // Default access token (empty = basic tiles work)
    Cesium.Ion.defaultAccessToken = '';

    const viewer = new Cesium.Viewer(container, {
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
      imageryProvider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maximumZoomLevel: 20,
      }),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 2000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-25),
        roll: 0,
      },
      duration: 0,
    });

    return viewer;
  } catch (err) {
    console.error('Failed to create Cesium viewer:', err);
    container.innerHTML = `<div style="color:#e0e0e0;padding:20px;text-align:center;">
      <h2>NBC RAMS</h2>
      <p>3D viewer failed to initialize: ${err instanceof Error ? err.message : 'Unknown error'}</p>
    </div>`;
    return null;
  }
}
