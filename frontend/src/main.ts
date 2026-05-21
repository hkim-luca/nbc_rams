import './style.css';
import { createViewer } from './cesium/Viewer';
import { createInputGroup, bindInputs } from './dashboard/InputPanel';
import { createMetricsPanel } from './dashboard/MetricsPanel';
import { connect, disconnect } from './websocket/client';
import { updatePuffs, clearPuffs } from './layers/PuffLayer';
import { updateConcentration, clearConcentration } from './layers/ConcentrationLayer';
import { useSimStore } from './store';

const container = document.getElementById('root')!;
const viewer = createViewer(container);

// Append dashboard panels
const inputGroup = createInputGroup();
document.body.appendChild(inputGroup);
const metricsPanel = createMetricsPanel();
document.body.appendChild(metricsPanel);
bindInputs(inputGroup);

// Start button
document.getElementById('btn-start')!.addEventListener('click', () => {
  if (useSimStore.getState().running) return;
  clearPuffs(viewer);
  clearConcentration(viewer);
  connect();
});

// Stop button
document.getElementById('btn-stop')!.addEventListener('click', () => {
  disconnect();
  clearPuffs(viewer);
  clearConcentration(viewer);
});

// Bind UI button states
const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
useSimStore.subscribe((state) => {
  startBtn.disabled = state.running || state.connected;
  stopBtn.disabled = !state.running;
});

// Render loop: watch store for new frames and update Cesium layers
let lastFrameT = -1;
function renderLoop(): void {
  requestAnimationFrame(renderLoop);
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

// Expose for debugging
(window as any).__viewer = viewer;
