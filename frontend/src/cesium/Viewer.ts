export function createViewer(container: HTMLElement): any {
  const DAEJEON_LAT = 36.35;
  const DAEJEON_LON = 127.38;

  if (typeof Cesium === 'undefined') {
    container.innerHTML = '<div style="color:#ff8a65;padding:40px;text-align:center;font-family:sans-serif"><h2>NBC RAMS</h2><p style="margin-top:12px">Cesium library loading failed.</p></div>';
    return null;
  }

  Cesium.Ion.defaultAccessToken = '';

  const viewer = new Cesium.Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
  });

  // Remove default Bing layer
  viewer.imageryLayers.removeAll();

  // Layer 0: Google Satellite
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maximumZoomLevel: 20,
    }),
  );

  // Layer 1: Korean administrative boundaries (yellow)
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minimumZoomLevel: 8,
      maximumZoomLevel: 18,
    }),
  );
  // Make boundary layer transparent with yellow lines using an overlay trick
  // Instead, use a simpler approach: add a styled tile layer
  const boundLayer = viewer.imageryLayers.get(1);
  boundLayer.alpha = 0.3; // Subtle overlay to show OSM roads/boundaries on top of satellite

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 20000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 0,
  });

  return viewer;
}
