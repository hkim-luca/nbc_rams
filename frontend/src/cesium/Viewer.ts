import { Viewer, Ion, Cartesian3, Math as CesiumMath } from 'cesium';

Ion.defaultAccessToken = '';

export function createViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: true,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
  });

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(127.5, 36.5, 300000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-45),
      roll: 0,
    },
    duration: 1,
  });

  return viewer;
}
