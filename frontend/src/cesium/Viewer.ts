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

  // Draw Korean administrative boundaries as yellow polylines
  drawKoreanBoundaries(viewer);

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 300000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
    duration: 0,
  });

  return viewer;
}

function drawKoreanBoundaries(viewer: any): void {
  // Each boundary is [lon, lat] pairs
  const regions: Array<{ name: string; corners: number[][] }> = [
    // South Korea national border (simplified outline)
    {
      name: 'ROK',
      corners: [
        [126.0, 34.0], [126.5, 33.9], [127.0, 34.0], [127.5, 34.1],
        [128.0, 34.3], [128.6, 34.5], [129.0, 34.8], [129.3, 35.1],
        [129.5, 35.5], [129.4, 35.8], [129.2, 36.0], [129.5, 36.5],
        [129.4, 37.0], [129.2, 37.3], [129.0, 37.5], [128.8, 37.7],
        [128.6, 38.0], [128.5, 38.3], [128.3, 38.5], [128.0, 38.6],
        [127.8, 38.4], [127.5, 38.3], [127.2, 38.2], [127.0, 38.3],
        [126.8, 38.2], [126.5, 38.1], [126.2, 38.0], [126.0, 37.8],
        [125.8, 37.6], [125.5, 37.5], [125.2, 37.3], [125.0, 37.1],
        [124.8, 36.8], [124.6, 36.5], [124.8, 36.2], [125.0, 36.0],
        [125.3, 35.8], [125.5, 35.5], [125.8, 35.3], [126.0, 35.0],
        [126.0, 34.6], [126.0, 34.3], [126.0, 34.0],
      ],
    },
    // Jeju Island
    {
      name: 'Jeju',
      corners: [
        [126.2, 33.1], [126.5, 33.2], [126.8, 33.3], [127.0, 33.4],
        [127.2, 33.5], [127.4, 33.4], [127.5, 33.3], [127.3, 33.1],
        [127.0, 33.0], [126.7, 32.9], [126.4, 32.9], [126.2, 33.1],
      ],
    },
    // Provincial boundaries (simplified major divisions)
    // Gyeonggi-do
    {
      name: 'Gyeonggi',
      corners: [
        [126.5, 37.0], [127.0, 37.0], [127.5, 37.0], [127.8, 37.2],
        [127.5, 37.5], [127.2, 38.0], [126.8, 38.2], [126.5, 38.0],
        [126.2, 37.5], [126.3, 37.2], [126.5, 37.0],
      ],
    },
    // Gangwon-do
    {
      name: 'Gangwon',
      corners: [
        [127.2, 38.2], [127.8, 38.5], [128.3, 38.5], [128.8, 38.3],
        [129.2, 37.8], [129.5, 37.5], [129.2, 37.0], [128.8, 37.0],
        [128.5, 37.0], [128.0, 37.2], [127.5, 37.5], [127.2, 38.0],
        [127.2, 38.2],
      ],
    },
    // Chungcheongnam-do
    {
      name: 'Chungnam',
      corners: [
        [126.0, 36.0], [126.5, 36.0], [127.0, 36.0], [127.5, 36.0],
        [127.5, 36.5], [127.2, 36.8], [127.0, 36.8], [126.5, 36.5],
        [126.0, 36.4], [126.0, 36.0],
      ],
    },
    // Gyeongsangbuk-do
    {
      name: 'Gyeongbuk',
      corners: [
        [128.0, 36.0], [128.5, 36.0], [129.0, 36.0], [129.5, 36.0],
        [129.5, 36.5], [129.2, 37.0], [128.8, 37.0], [128.5, 37.0],
        [128.0, 37.0], [128.0, 36.5], [128.0, 36.0],
      ],
    },
    // Jeollanam-do
    {
      name: 'Jeonnam',
      corners: [
        [126.0, 34.0], [126.5, 34.0], [127.0, 34.0], [127.5, 34.5],
        [127.8, 35.0], [128.0, 35.0], [128.0, 35.5], [127.5, 35.5],
        [127.0, 35.5], [126.5, 35.0], [126.0, 34.8], [126.0, 34.4], [126.0, 34.0],
      ],
    },
  ];

  regions.forEach((region) => {
    const positions = region.corners.map(
      ([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    );

    viewer.entities.add({
      polyline: {
        positions,
        width: 1.5,
        material: Cesium.Color.YELLOW.withAlpha(0.6),
        clampToGround: true,
      },
    });
  });
}
