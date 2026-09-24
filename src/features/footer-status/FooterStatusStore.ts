export interface FooterStatusSnapshot {
  message: string;
  coordinates: string;
  count: number;
  volume: number;
  calcMs: number;
  fps: number;
}

const initialSnapshot: FooterStatusSnapshot = {
  message: 'Listo',
  coordinates: 'X: 0.00m | Z: 0.00m | Y: 0.00m',
  count: 0,
  volume: 0,
  calcMs: 0,
  fps: 0,
};

let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function update(patch: Partial<FooterStatusSnapshot>) {
  const next = { ...snapshot, ...patch };
  if (Object.keys(patch).every(key => snapshot[key as keyof FooterStatusSnapshot] === next[key as keyof FooterStatusSnapshot])) return;
  snapshot = next;
  listeners.forEach(listener => listener());
}

export const footerStatusStore = {
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
  setMessage(message: string) {
    update({ message });
  },
  setCoordinates(x: number, z: number, y: number) {
    update({ coordinates: `X: ${x.toFixed(2)}m  |  Z: ${z.toFixed(2)}m  |  Elev (Y): ${y.toFixed(2)}m` });
  },
  updateMetrics(count: number, volume: number, calcMs: number, fps: number) {
    update({ count, volume, calcMs, fps });
  },
};
