import type { AnalysisModel, AnalysisResult } from '../../core/analysis/Model';
import type { BenchmarkId } from '../../core/analysis/Benchmarks';
import type { Support } from '../../core/analysis/Model';
import type { DeadLoadMode } from '../../core/analysis/Loads';
import type { SurfaceLoad } from '../../core/analysis/SurfaceLoads';
import type { LoadFilter } from './LoadBalanceView';
import type { KernelParityReport } from '../../core/analysis/KernelAdapter';

export type AnalysisPanelTab = 'nodes' | 'members' | 'surfaces' | 'loads' | 'results';
export type AnalysisDraftKey = 'plane' | 'ordinate' | 'tolerance' | 'elasticModulusMPa' | 'unitWeight';
export type AnalysisDraft = {
  plane: 'XY' | 'ZY';
  ordinate: number;
  tolerance: number;
  elasticModulusMPa: number;
  unitWeight: number;
};

export interface AnalysisPanelSnapshot {
  open: boolean;
  model: AnalysisModel | null;
  result: AnalysisResult | null;
  draft: AnalysisDraft;
  factors: { dead: number; live: number; nodal: number };
  caseName: string;
  benchmark?: BenchmarkId;
  loadFilter: LoadFilter;
  tab: AnalysisPanelTab;
  pending: boolean;
  stale: boolean;
  canCalculate: boolean;
  kernelAvailable: boolean;
  canCompareKernel: boolean;
  kernelStatus: 'idle' | 'running' | 'passed' | 'mismatch' | 'error';
  kernelMessage: string;
  kernelReport: KernelParityReport | null;
  canExport: boolean;
  canReport: boolean;
  status: string;
  stateVersion: number;
}

export interface AnalysisPanelCommands {
  close(): void;
  setTab(tab: AnalysisPanelTab): void;
  saveSurfaceLoad(surface: SurfaceLoad): string;
  deleteSurfaceLoad(sourceId: string): void;
  setLoadFilter(filter: LoadFilter): void;
  exportLoadLedger(format: 'csv' | 'json'): void;
  updateNode(index: number, key: 'fx' | 'fy' | 'moment', value: number): void;
  updateSupport(index: number, support: Support): void;
  updateMember(index: number, key: 'dead' | 'live', value: number): void;
  updateRelease(index: number, end: 'releaseStart' | 'releaseEnd', checked: boolean): void;
  updateDeadLoadMode(index: number, mode: DeadLoadMode): void;
  updateLoadReference(index: number, reference: string): void;
  focusElement(id: string): void;
  updateDraft<K extends AnalysisDraftKey>(key: K, value: AnalysisDraft[K]): void;
  updateFactor(key: 'dead' | 'live' | 'nodal', value: number): void;
  updateCase(value: string): void;
  generate(): void;
  fixBases(): void;
  exportModel(): void;
  exportReport(): void;
  solve(): void;
  compareKernel(): void;
}

const initialSnapshot: AnalysisPanelSnapshot = {
  open: false,
  model: null,
  result: null,
  draft: { plane: 'XY', ordinate: 0, tolerance: 0.001, elasticModulusMPa: 25000, unitWeight: 24 },
  factors: { dead: 1, live: 1, nodal: 1 },
  caseName: 'Servicio D + L',
  loadFilter: 'applied',
  tab: 'nodes',
  pending: false,
  stale: true,
  canCalculate: false,
  kernelAvailable: false,
  canCompareKernel: false,
  kernelStatus: 'idle',
  kernelMessage: '',
  kernelReport: null,
  canExport: false,
  canReport: false,
  status: '',
  stateVersion: 0,
};

let snapshot = initialSnapshot;
let commands: AnalysisPanelCommands | null = null;
const listeners = new Set<() => void>();

export const analysisPanelStore = {
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
  connect(nextCommands: AnalysisPanelCommands) {
    commands = nextCommands;
  },
  disconnect(currentCommands: AnalysisPanelCommands) {
    if (commands === currentCommands) commands = null;
  },
  publish(next: AnalysisPanelSnapshot) {
    snapshot = next;
    listeners.forEach(listener => listener());
  },
};
