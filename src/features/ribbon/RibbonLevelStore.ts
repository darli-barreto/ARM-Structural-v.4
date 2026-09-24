export interface RibbonLevelOption {
  value: number;
  label: string;
}

export interface RibbonLevelSnapshot {
  options: RibbonLevelOption[];
  selectedIndex: number;
  disabled: boolean;
}

const initialSnapshot: RibbonLevelSnapshot = {
  options: [
    { value: 0, label: 'Nivel 0: Cimientos (0.00m)' },
    { value: 1, label: 'Nivel 1: Piso 1 (+3.50m)' },
    { value: 2, label: 'Nivel 2: Piso 2 (+7.00m)' },
    { value: 3, label: 'Nivel 3: Piso 3 (+10.50m)' },
    { value: 4, label: 'Nivel 4: Piso 4 (+14.00m)' },
    { value: 5, label: 'Nivel 5: Cubierta (+17.50m)' },
  ],
  selectedIndex: 0,
  disabled: false,
};

let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function publish(next: RibbonLevelSnapshot) {
  if (snapshot.selectedIndex === next.selectedIndex && snapshot.disabled === next.disabled &&
      snapshot.options.length === next.options.length && snapshot.options.every((option, index) =>
        option.value === next.options[index].value && option.label === next.options[index].label)) return;
  snapshot = next;
  listeners.forEach(listener => listener());
}

export const ribbonLevelStore = {
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
  setLevels(levels: { name: string; elevation: number }[], requestedIndex: number) {
    if (!levels.length) {
      publish({ options: [{ value: -1, label: '(Sin niveles - Usa Quick Generate o Dibuja)' }], selectedIndex: -1, disabled: true });
      return -1;
    }
    const selectedIndex = Math.min(Math.max(requestedIndex, 0), levels.length - 1);
    publish({
      options: levels.map((level, value) => ({
        value,
        label: `${level.name} (${level.elevation >= 0 ? '+' : ''}${level.elevation.toFixed(2)}m)`,
      })),
      selectedIndex,
      disabled: false,
    });
    return selectedIndex;
  },
  setSelected(index: number) {
    if (snapshot.disabled || !snapshot.options.some(option => option.value === index)) return;
    publish({ ...snapshot, selectedIndex: index });
  },
};
