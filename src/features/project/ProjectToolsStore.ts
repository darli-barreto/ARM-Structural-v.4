export interface ProjectToolsSnapshot {
  status: string;
  ready: boolean;
}

const initialSnapshot: ProjectToolsSnapshot = { status: 'Proyecto local', ready: false };
let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function update(patch: Partial<ProjectToolsSnapshot>) {
  const next = { ...snapshot, ...patch };
  if (Object.keys(patch).every(key => snapshot[key as keyof ProjectToolsSnapshot] === next[key as keyof ProjectToolsSnapshot])) return;
  snapshot = next;
  listeners.forEach(listener => listener());
}

export const projectToolsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  getServerSnapshot() {
    return initialSnapshot;
  },
  setStatus(message: string) {
    update({ status: message });
  },
  setReady(ready: boolean) {
    update({ ready });
  },
};
