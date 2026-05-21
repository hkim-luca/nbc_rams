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

  // Satellite base map
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maximumZoomLevel: 20,
    }),
  );

  // Set initial view: camera positioned southeast of Daejeon, looking toward Daejeon
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(DAEJEON_LON + 0.05, DAEJEON_LAT - 0.15, 25000),
    orientation: {
      direction: Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(
          Cesium.Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 0),
          Cesium.Cartesian3.fromDegrees(DAEJEON_LON + 0.05, DAEJEON_LAT - 0.15, 25000),
          new Cesium.Cartesian3(),
        ),
        new Cesium.Cartesian3(),
      ),
      up: Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_Z),
    },
  });

  // Load Korean boundary GeoJSON
  const geoUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
  fetch(geoUrl)
    .then(r => r.json())
    .then((data: any) => {
      const kor = data.features.find((f: any) =>
        f.properties?.ISO_A3 === 'KOR' || f.properties?.ADM0_A3 === 'KOR'
      );
      if (kor) {
        return Cesium.GeoJsonDataSource.load(
          JSON.stringify({ type: 'FeatureCollection', features: [kor] }),
          { stroke: Cesium.Color.YELLOW, strokeWidth: 3, fill: Cesium.Color.YELLOW.withAlpha(0.04), clampToGround: true }
        );
      }
    })
    .then((ds: any) => { if (ds) viewer.dataSources.add(ds); })
    .catch(() => {});

  return viewer;
}
