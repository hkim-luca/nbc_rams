import './style.css';
import { createViewer } from './cesium/Viewer';
import { createInputGroup, bindInputs } from './dashboard/InputPanel';
import { createMetricsPanel } from './dashboard/MetricsPanel';
import { connect, disconnect } from './websocket/client';
import { useSimStore } from './store';
import { updatePuffs } from './layers/PuffLayer';
import { updateConcentration, clearConcentration } from './layers/ConcentrationLayer';

const container = document.getElementById('root')!;
const viewer: any = createViewer(container);

const inputGroup = createInputGroup();
document.body.appendChild(inputGroup);
const metricsPanel = createMetricsPanel();
document.body.appendChild(metricsPanel);
bindInputs(inputGroup);

document.getElementById('btn-start')!.addEventListener('click', () => {
  if (useSimStore.getState().running) return;
  connect();
});
document.getElementById('btn-stop')!.addEventListener('click', () => {
  disconnect();
});

const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
useSimStore.subscribe((state) => {
  startBtn.disabled = state.running;
  stopBtn.disabled = !state.running;
});

let lastFrameT = -1;
function renderLoop(): void {
  requestAnimationFrame(renderLoop);
  if (!viewer) return;
  const { currentFrame, running } = useSimStore.getState();
  if (currentFrame && running && currentFrame.t !== lastFrameT) {
    lastFrameT = currentFrame.t;
    updatePuffs(viewer, currentFrame.puffs);
    if (currentFrame.grid) updateConcentration(viewer, currentFrame);
  }
}
renderLoop();

(window as any).__viewer = viewer;
