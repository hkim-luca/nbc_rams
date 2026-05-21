export function createViewer(container: HTMLElement): any {
  const DAEJEON_LAT = 36.35;
  const DAEJEON_LON = 127.38;

  if (typeof Cesium === 'undefined') {
    container.innerHTML = '<div style="color:#ff8a65;padding:40px;text-align:center;font-family:sans-serif"><h2>NBC RAMS</h2><p style="margin-top:12px">Cesium library loading failed. Check network/CDN access.</p></div>';
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

  // Remove default Bing layer, add Google satellite
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maximumZoomLevel: 20,
    }),
  );

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
