import type { ToolType } from '../../config/structural.config';

const listeners = new Set<() => void>();
let activeTool: ToolType = 'select';

function publish(next: ToolType) {
  if (activeTool === next) return;
  activeTool = next;
  listeners.forEach(listener => listener());
}

export const ribbonToolStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return activeTool;
  },
  getServerSnapshot() {
    return 'select' as ToolType;
  },
  setActiveTool: publish,
};
