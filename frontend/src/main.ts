import './style.css';
import { createViewer } from './cesium/Viewer';
import { createInputGroup, bindInputs } from './dashboard/InputPanel';
import { createMetricsPanel } from './dashboard/MetricsPanel';
import { connect, disconnect } from './websocket/client';
import { useSimStore } from './store';
import { updatePuffs, clearPuffs } from './layers/PuffLayer';
import { updateConcentration, clearConcentration } from './layers/ConcentrationLayer';

const container = document.getElementById('root')!;
const viewer: any = createViewer(container);

if (!viewer) {
  document.body.innerHTML +=
    '<div style="position:fixed;top:0;left:0;right:0;background:#d32f2f;color:white;padding:8px;text-align:center;z-index:9999;font-size:13px;">' +
    'Cesium 3D viewer failed to load. Check browser console for details.</div>';
}

// Append dashboard panels
const inputGroup = createInputGroup();
document.body.appendChild(inputGroup);
const metricsPanel = createMetricsPanel();
document.body.appendChild(metricsPanel);
bindInputs(inputGroup);

// Start button
document.getElementById('btn-start')!.addEventListener('click', () => {
  if (useSimStore.getState().running) return;
  clearLayers();
  connect();
});

// Stop button
document.getElementById('btn-stop')!.addEventListener('click', () => {
  disconnect();
  clearLayers();
});

// Bind UI button states
const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
useSimStore.subscribe((state) => {
  startBtn.disabled = state.running || state.connected;
  stopBtn.disabled = !state.running;
});

function clearLayers(): void {
  if (!viewer) return;
  viewer.entities.removeAll();
  while (viewer.imageryLayers.length > 1) {
    viewer.imageryLayers.remove(viewer.imageryLayers.get(1));
  }
}

// Render loop
let lastFrameT = -1;
function renderLoop(): void {
  requestAnimationFrame(renderLoop);
  if (!viewer) return;
  const { currentFrame, running } = useSimStore.getState();
  if (currentFrame && running && currentFrame.t !== lastFrameT) {
    lastFrameT = currentFrame.t;
    updatePuffs(viewer, currentFrame.puffs);
    if (currentFrame.grid) {
      updateConcentration(viewer, currentFrame);
    }
  }
}
renderLoop();

(window as any).__viewer = viewer;
