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

  viewer.imageryLayers.removeAll();

  // Base: Google Satellite (shows land/sea naturally)
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maximumZoomLevel: 20,
    }),
  );

  // Load accurate Korean administrative boundaries via GeoJSON
  const geoJsonUrl = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-geo.json';

  Cesium.GeoJsonDataSource.load(geoJsonUrl, {
    stroke: Cesium.Color.YELLOW,
    strokeWidth: 2,
    fill: Cesium.Color.YELLOW.withAlpha(0.05),
    clampToGround: true,
  }).then((dataSource: any) => {
    viewer.dataSources.add(dataSource);
  }).catch(() => {
    // Fallback: load country boundary from Natural Earth if provinces fail
    Cesium.GeoJsonDataSource.load(
      'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson',
      {
        stroke: Cesium.Color.YELLOW,
        strokeWidth: 2,
        fill: Cesium.Color.YELLOW.withAlpha(0.03),
        clampToGround: true,
      }
    ).then((ds: any) => {
      // Filter to just South Korea
      const entity = ds.entities.values.find((e: any) =>
        e.properties?.name?.getValue() === 'South Korea' ||
        e.properties?.ISO_A3?.getValue() === 'KOR'
      );
      if (entity) {
        viewer.dataSources.add(ds);
      }
    }).catch(() => {});
  });

  // Camera positioned AWAY from Daejeon, looking AT Daejeon
  const target = Cesium.Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 0);
  const offset = new Cesium.Cartesian3(5000, -15000, 12000);
  viewer.camera.lookAt(target, offset);

  return viewer;
}
