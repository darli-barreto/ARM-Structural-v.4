import type { GridDrawMode, ToolType } from '../../config/structural.config';
import type { QuickGenerateLevelConfig, LevelDrawMode, LevelTemplateType } from '../../core/level/types/LevelTypes';
import type { ManagedElement, ArrayOptions } from '../../tools/structural/types';

export type ContextualBarMode = 'general' | 'grid' | 'level' | 'structural' | 'selected' | 'align' | 'array';

export interface ContextualSubheaderSnapshot {
  mode: ContextualBarMode;
  tool: ToolType;
  levelName: string;
  element: ManagedElement | null;
  alignStep: string;
  gridDrawMode: GridDrawMode;
  gridOffset: number;
  gridOffsetInput: string;
  gridChain: boolean;
  gridRadius: number;
  gridRadiusInput: string;
  gridTemplate: '5x5' | '4x4' | '6x6';
  gridSpacingX: string;
  gridSpacingZ: string;
  levelDrawMode: LevelDrawMode;
  levelOffset: number;
  levelOffsetInput: string;
  levelMakePlanView: boolean;
  levelTemplate: LevelTemplateType;
  arrayType: 'linear' | 'radial';
  arraySpacing: 'second' | 'last';
  arrayCount: string;
  arrayAngle: string;
  arrayDeltaX: string;
  quickLevelModalOpen: boolean;
}

export interface ContextualSubheaderCommands {
  updateGridDrawMode(mode: GridDrawMode): void;
  updateGridOffset(value: string): void;
  updateGridChain(value: boolean): void;
  updateGridRadius(value: string): void;
  updateGridTemplate(value: '5x5' | '4x4' | '6x6'): void;
  updateGridSpacing(axis: 'x' | 'z', value: string): void;
  updateLevelDrawMode(mode: LevelDrawMode): void;
  updateLevelOffset(value: string): void;
  updateLevelMakePlanView(value: boolean): void;
  updateLevelTemplate(value: LevelTemplateType): void;
  updateArrayType(value: 'linear' | 'radial'): void;
  updateArraySpacing(value: 'second' | 'last'): void;
  updateArrayCount(value: string): void;
  updateArrayAngle(value: string): void;
  updateArrayDeltaX(value: string): void;
  applyGridTemplate(): void;
  applyLevelTemplate(): void;
  executeArray(): void;
  openQuickLevelModal(): void;
  closeQuickLevelModal(): void;
  generateQuickLevels(config: QuickGenerateLevelConfig): void;
  clearSelection(): void;
  deleteSelected(): void;
  toggleGrid(): void;
  cancel(): void;
  atGrid(): void;
  startAlign(): void;
  cancelAlign(): void;
  startArray(): void;
  cancelArray(): void;
  toggleColumnStyle(): void;
  startSketch(): void;
  addVoidSketch(): void;
}

const initialSnapshot: ContextualSubheaderSnapshot = {
  mode: 'general', tool: 'select', levelName: 'Nivel 1 (+3.50m)', element: null, alignStep: '',
  gridDrawMode: 'line', gridOffset: 0, gridOffsetInput: '0.00', gridChain: false, gridRadius: 0, gridRadiusInput: '0.00',
  gridTemplate: '5x5', gridSpacingX: '6', gridSpacingZ: '6', levelDrawMode: 'line', levelOffset: 0,
  levelOffsetInput: '0.00', levelMakePlanView: true, levelTemplate: 'residential', arrayType: 'linear',
  arraySpacing: 'second', arrayCount: '3', arrayAngle: '360', arrayDeltaX: '6.00', quickLevelModalOpen: false,
};

let snapshot = initialSnapshot;
let commands: ContextualSubheaderCommands | null = null;
const listeners = new Set<() => void>();

export const contextualSubheaderStore = {
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
  getCommands() {
    return commands;
  },
  connect(nextCommands: ContextualSubheaderCommands) {
    commands = nextCommands;
  },
  publish(next: ContextualSubheaderSnapshot) {
    snapshot = next;
    listeners.forEach(listener => listener());
  },
};
