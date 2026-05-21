import {
  Viewer, Ion, Cartesian3, Math as CesiumMath,
  OpenStreetMapImageryProvider, createWorldTerrainAsync,
} from 'cesium';

export function createViewer(container: HTMLElement): Viewer {
  // Daejeon, South Korea
  const DAEJEON_LAT = 36.35;
  const DAEJEON_LON = 127.38;

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
    // Use OSM tiles (no Ion token needed)
    imageryProvider: new OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    }),
    terrain: createWorldTerrainAsync(),
  });

  // Fly to Daejeon at street level
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(DAEJEON_LON, DAEJEON_LAT, 2000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-25),
      roll: 0,
    },
    duration: 0,
  });

  return viewer;
}
