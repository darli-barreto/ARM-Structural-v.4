import type { GridElement } from '../../config/structural.config';
import type { Level } from '../../core/level/types/LevelTypes';

export interface GridPropertiesSnapshot {
  id: string;
  uniqueId: string | null;
  elementId: string;
  name: string;
  family: string;
  geomType: GridElement['geomType'];
  length: string;
  radius: number | null;
  showStartBubble: boolean;
  showEndBubble: boolean;
  isLocked: boolean;
  startElbowActive: boolean;
  endElbowActive: boolean;
}

export interface LevelPropertiesSnapshot {
  id: string;
  uniqueId: string | null;
  elementId: string;
  name: string;
  shortName: string;
  elevation: number;
  formattedElevation: string;
  family: string;
  hasPlanView: boolean;
  showStartBubble: boolean;
  showEndBubble: boolean;
  isLocked: boolean;
  startElbowActive: boolean;
  endElbowActive: boolean;
}

export interface ElementPropertiesSnapshot {
  id: string;
  uniqueId: string;
  elementId: string;
  icon: string;
  familyType: string;
  categoryName: string;
  family: string;
  ifcEntity: string;
  material: string;
  unitCost: number;
  mark: string;
  sector: string;
  concreteStrength: number;
  phase: 'Nueva Construcción' | 'Existente' | 'Demolición';
  baseOffset: number;
  levelName: string;
  dimensions: string;
  quantityState: 'pending' | 'ready' | 'error';
  volume: number;
  grossVolume: number;
  overlapVolume: number | null;
  steelMass: number | null;
  surfaceArea: number;
  estimatedCost: number;
  category: import('../../core/database/BimDatabaseTypes').BimCategory;
}

export type SidebarPropertiesSnapshot =
  | { kind: 'empty' }
  | { kind: 'grid'; grid: GridPropertiesSnapshot }
  | { kind: 'level'; level: LevelPropertiesSnapshot }
  | { kind: 'element'; element: ElementPropertiesSnapshot };

export type SidebarPropertiesAction =
  | { type: 'grid-name'; id: string; value: string }
  | { type: 'grid-bubble'; id: string; end: 'start' | 'end'; value: boolean }
  | { type: 'grid-lock'; id: string; value: boolean }
  | { type: 'grid-elbow'; id: string; end: 'start' | 'end'; value: boolean }
  | { type: 'grid-delete'; id: string }
  | { type: 'level-name'; id: string; value: string }
  | { type: 'level-elevation'; id: string; value: string }
  | { type: 'level-bubble'; id: string; end: 'start' | 'end'; value: boolean }
  | { type: 'level-lock'; id: string; value: boolean }
  | { type: 'level-elbow'; id: string; end: 'start' | 'end'; value: boolean }
  | { type: 'level-delete'; id: string }
  | { type: 'element-mark'; id: string; value: string }
  | { type: 'element-sector'; id: string; value: string }
  | { type: 'element-concrete-strength'; id: string; value: number }
  | { type: 'element-phase'; id: string; value: ElementPropertiesSnapshot['phase'] }
  | { type: 'element-base-offset'; id: string; value: string }
  | { type: 'element-open-schedule'; id: string }
  | { type: 'element-delete'; id: string };

export type ElementPropertiesAction = Extract<SidebarPropertiesAction, { type: `element-${string}` }>;

const emptySnapshot: SidebarPropertiesSnapshot = { kind: 'empty' };
export const SIDEBAR_PROPERTIES_ACTION_EVENT = 'arm:sidebar-properties:action';

let snapshot: SidebarPropertiesSnapshot = emptySnapshot;
const listeners = new Set<() => void>();

export const sidebarPropertiesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  getServerSnapshot() {
    return emptySnapshot;
  },
  set(next: SidebarPropertiesSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  },
  setGrid(grid: GridPropertiesSnapshot) {
    this.set({ kind: 'grid', grid });
  },
  setLevel(level: LevelPropertiesSnapshot) {
    this.set({ kind: 'level', level });
  },
  setElement(element: ElementPropertiesSnapshot) {
    this.set({ kind: 'element', element });
  },
  setEmpty() {
    this.set(emptySnapshot);
  },
};

export function requestSidebarPropertiesAction(action: SidebarPropertiesAction): void {
  window.dispatchEvent(new CustomEvent<SidebarPropertiesAction>(SIDEBAR_PROPERTIES_ACTION_EVENT, { detail: action }));
}

export function levelPropertiesFromModel(
  level: Level,
  data: Omit<LevelPropertiesSnapshot, 'id' | 'name' | 'shortName' | 'elevation' | 'showStartBubble' | 'showEndBubble' | 'isLocked' | 'startElbowActive' | 'endElbowActive' | 'hasPlanView'>,
): LevelPropertiesSnapshot {
  return {
    ...data,
    id: level.id,
    name: level.name,
    shortName: level.name.split('(')[0]?.trim() || level.name,
    elevation: level.elevation,
    hasPlanView: level.hasPlanView,
    showStartBubble: level.showStartBubble,
    showEndBubble: level.showEndBubble,
    isLocked: level.isLocked,
    startElbowActive: Boolean(level.startElbow?.active),
    endElbowActive: Boolean(level.endElbow?.active),
  };
}
