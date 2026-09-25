import { BimDatabase } from '../../core/database/BimDatabase';
import { AnalysisModel, AnalysisResult, AnalysisSetup, deriveAnalysis, validateAnalysis, matchesAnalyticalGeometry, type Support } from '../../core/analysis/Model';
import { download } from '../../shared/ui/dom';
import { analysisReport } from '../../core/analysis/Report';
import type { BenchmarkId } from '../../core/analysis/Benchmarks';
import { buildLoadLedger, loadLedgerCsv } from '../../core/analysis/LoadLedger';
import { compileSurfaceLoads, type SurfaceLoad } from '../../core/analysis/SurfaceLoads';
import type { LoadFilter } from './LoadBalanceView';
import type { DeadLoadMode } from '../../core/analysis/Loads';
import {
  analysisPanelStore,
  type AnalysisDraft,
  type AnalysisDraftKey,
  type AnalysisPanelCommands,
  type AnalysisPanelTab,
} from './AnalysisPanelStore';
import { AnalysisWorkerClient, type AnalysisExecutor } from './AnalysisWorkerClient';
import { renderAnalysisCanvas } from './AnalysisCanvasRenderer';
import type { WasmBridge } from '../../kernel/WasmBridge';
import { compareFrame2dResults, toFrame2dKernelInput, type KernelParityReport } from '../../core/analysis/KernelAdapter';

export class AnalysisPanel implements AnalysisPanelCommands {
  public stateVersion = 0;
  private model: AnalysisModel | null = null;
  private result: AnalysisResult | null = null;
  private kernelAbort: AbortController | undefined;
  private kernelPending = false;
  private kernelStatus: 'idle' | 'running' | 'passed' | 'mismatch' | 'error' = 'idle';
  private kernelMessage = '';
  private kernelReport: KernelParityReport | null = null;
  private pending = false;
  private panelOpen = false;
  private needsGeneration = false;
  private benchmark: BenchmarkId | undefined;
  private loadFilter: LoadFilter = 'applied';
  private factors = { dead: 1, live: 1, nodal: 1 };
  private caseName = 'Servicio D + L';
  private draft: AnalysisDraft = { plane: 'XY', ordinate: 0, tolerance: 0.001, elasticModulusMPa: 25000, unitWeight: 24 };
  private tab: AnalysisPanelTab = 'nodes';
  private statusText = '';
  private unsubscribeDatabase: () => void;
  private disposed = false;

  constructor(
    private select: (id: string) => void,
    private readonly kernelBridge?: Pick<WasmBridge, 'solveKernelFrame2d'>,
    private readonly analysisWorker: AnalysisExecutor = new AnalysisWorkerClient(),
  ) {
    analysisPanelStore.connect(this);
    this.sync();
    this.unsubscribeDatabase = BimDatabase.getInstance().subscribe(action => {
      if (action === 'quantities') {
        this.stateVersion++;
        this.sync();
        return;
      }
      this.stateVersion++;
      if (this.model) {
        this.result = null;
        this.analysisWorker.cancel();
        this.cancelKernelCheck();
        this.pending = false;
        if (this.panelOpen) {
          this.status('El modelo BIM cambió. Regenerar el plano analítico.');
          this.paint();
        }
      }
      this.sync();
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeDatabase();
    this.analysisWorker.cancel();
    this.cancelKernelCheck();
    this.pending = false;
    this.panelOpen = false;
    analysisPanelStore.disconnect(this);
    this.sync();
  }

  public getVisualization() {
    const stale = this.isStale();
    return { model: this.model, result: stale ? null : this.result, factors: this.factors, stale };
  }

  public open(): void {
    this.panelOpen = true;
    this.tab = this.benchmark ? 'results' : 'nodes';
    this.sync();
    this.paint();
  }

  public close(): void {
    this.panelOpen = false;
    this.sync();
  }

  public setTab(tab: AnalysisPanelTab): void {
    this.tab = tab;
    this.sync();
  }

  public saveSurfaceLoad(surface: SurfaceLoad): string {
    if (!this.model) return 'Sin plano analítico.';
    const next = [...(this.model.surfaceLoads ?? []).filter(item => item.sourceId !== surface.sourceId), surface];
    compileSurfaceLoads({ ...this.model, surfaceLoads: next }, false);
    this.model.surfaceLoads = next;
    this.changed();
    let message = 'Fuente guardada. Reparto completo; calcular para actualizar resultados.';
    try {
      compileSurfaceLoads(this.model);
    } catch (error) {
      message = `Borrador guardado. ${(error as Error).message}`;
    }
    this.status(message);
    return message;
  }

  public deleteSurfaceLoad(sourceId: string): void {
    if (!this.model || !window.confirm('Eliminar esta fuente y sus cargas transferidas?')) return;
    this.model.surfaceLoads = (this.model.surfaceLoads ?? []).filter(surface => surface.sourceId !== sourceId);
    this.changed();
  }

  public setLoadFilter(filter: LoadFilter): void {
    this.loadFilter = filter;
    this.sync();
  }

  public exportLoadLedger(format: 'csv' | 'json'): void {
    if (!this.model) return;
    try {
      const ledger = buildLoadLedger(this.model, this.factors, BimDatabase.getInstance().getAllElements(), this.result ?? undefined);
      if (format === 'csv') download(loadLedgerCsv(ledger), 'balance-cargas.csv', 'text/csv;charset=utf-8');
      else download(JSON.stringify({ ...ledger, caseName: this.caseName, generatedAt: new Date().toISOString() }, null, 2), 'balance-cargas.json');
    } catch (error) {
      this.status((error as Error).message);
    }
  }

  public updateNode(index: number, key: 'fx' | 'fy' | 'moment', value: number): void {
    const node = this.model?.nodes[index];
    if (!node) return;
    node[key] = value;
    this.changed();
  }

  public updateSupport(index: number, support: Support): void {
    const node = this.model?.nodes[index];
    if (!node) return;
    node.support = support;
    this.changed();
  }

  public updateMember(index: number, key: 'dead' | 'live', value: number): void {
    const member = this.model?.members[index];
    if (!member) return;
    member[key] = value;
    this.changed();
  }

  public updateRelease(index: number, end: 'releaseStart' | 'releaseEnd', checked: boolean): void {
    const member = this.model?.members[index];
    if (!member) return;
    member[end] = checked;
    this.changed();
  }

  public updateDeadLoadMode(index: number, mode: DeadLoadMode): void {
    const member = this.model?.members[index];
    if (!member) return;
    member.deadLoadMode = mode;
    this.changed();
  }

  public updateLoadReference(index: number, reference: string): void {
    const member = this.model?.members[index];
    if (!member) return;
    member.loadReference = reference;
    this.changed();
  }

  public focusElement(id: string): void {
    this.close();
    this.select(id);
  }

  public updateDraft<K extends AnalysisDraftKey>(key: K, value: AnalysisDraft[K]): void {
    this.draft = { ...this.draft, [key]: value };
    this.needsGeneration = true;
    this.changed();
    this.status('Parámetros del plano modificados. Generar plano para aplicarlos.');
  }

  public updateFactor(key: 'dead' | 'live' | 'nodal', value: number): void {
    this.factors = { ...this.factors, [key]: value };
    this.changed();
  }

  public updateCase(value: string): void {
    this.caseName = value;
    this.changed();
  }

  public generate(): void {
    try {
      if (this.model && !window.confirm('Regenerar el plano reinicia apoyos, cargas, fuentes superficiales y liberaciones. Continuar?')) return;
      const db = BimDatabase.getInstance();
      this.model = deriveAnalysis(db.getAllElements(), db.revision, {
        plane: this.draft.plane,
        ordinate: this.draft.ordinate,
        tolerance: this.draft.tolerance,
        elasticModulusMPa: this.draft.elasticModulusMPa,
        unitWeight: this.draft.unitWeight,
      });
      this.draft = { ...this.draft };
      this.benchmark = undefined;
      this.needsGeneration = false;
      this.changed();
      this.setTab('nodes');
      this.status(`${this.model.nodes.length} nudos / ${this.model.members.length} tramos / ${this.model.omitted} elementos fuera del alcance`);
    } catch (error) {
      this.status((error as Error).message);
    }
  }

  public fixBases(): void {
    if (!this.model?.nodes.length) return;
    const y = Math.min(...this.model.nodes.map(node => node.y));
    this.model.nodes.forEach(node => { if (Math.abs(node.y - y) < 0.001) node.support = 'fixed'; });
    this.changed();
    this.setTab('nodes');
  }

  public exportModel(): void {
    if (this.model) download(JSON.stringify({ units: { length: 'm', force: 'kN', stress: 'MPa' }, model: this.model, factors: this.factors, result: this.result }, null, 2), 'modelo-analitico.json');
  }

  public exportReport(): void {
    if (!this.model || !this.result) return;
    const canvas = document.getElementById('analysis-canvas') as HTMLCanvasElement | null;
    const ledger = buildLoadLedger(this.model, this.factors, BimDatabase.getInstance().getAllElements(), this.result);
    download(analysisReport(this.model, this.result, this.factors, canvas?.toDataURL() ?? '', this.benchmark, ledger, this.kernelReport), 'memoria-portico.html', 'text/html;charset=utf-8');
  }

  public getSetup(): AnalysisSetup | undefined {
    if (!this.model) return undefined;
    return structuredClone({
      model: this.model,
      factors: this.factors,
      caseName: this.caseName,
      benchmark: this.benchmark,
      requiresRegeneration: this.needsGeneration || this.model.revision !== BimDatabase.getInstance().revision,
    });
  }

  public restoreSetup(setup?: AnalysisSetup): void {
    this.stateVersion++;
    this.analysisWorker.cancel();
    this.cancelKernelCheck();
    this.pending = false;
    this.result = null;
    this.benchmark = setup?.benchmark;
    if (!setup) {
      this.model = null;
      this.needsGeneration = false;
      this.factors = { dead: 1, live: 1, nodal: 1 };
      this.caseName = 'Servicio D + L';
      this.draft = { plane: 'XY', ordinate: 0, tolerance: 0.001, elasticModulusMPa: 25000, unitWeight: 24 };
      this.sync();
      return;
    }
    const copy = structuredClone(setup);
    this.model = copy.model;
    this.needsGeneration = !!copy.requiresRegeneration || !matchesAnalyticalGeometry(this.model, BimDatabase.getInstance().getAllElements());
    this.model.revision = BimDatabase.getInstance().revision;
    this.factors = copy.factors;
    this.caseName = copy.caseName;
    const member = this.model.members[0];
    this.draft = {
      plane: this.model.plane,
      ordinate: this.model.ordinate,
      tolerance: this.model.tolerance,
      elasticModulusMPa: member?.elasticModulusMPa ?? 25000,
      unitWeight: member ? member.weight / member.area : 24,
    };
    this.sync();
  }

  public solve(): void {
    if (!this.model || this.needsGeneration || this.pending || this.model.revision !== BimDatabase.getInstance().revision) return;
    try {
      validateAnalysis(this.model);
      if (!Object.values(this.factors).every(Number.isFinite)) throw new Error('Factores no válidos.');
    } catch (error) {
      this.status((error as Error).message);
      return;
    }
    this.cancelKernelCheck();
    this.pending = true;
    this.status('Calculando...');
    const revision = this.model.revision;
    this.analysisWorker.run(this.model, this.factors, this.caseName, {
      onSettled: () => {
        this.pending = false;
        this.sync();
      },
      onError: message => this.status(message),
      onResult: result => {
        if (revision !== BimDatabase.getInstance().revision) return;
        this.result = result;
        this.stateVersion++;
        this.setTab('results');
        this.paint();
        this.status(`Equilibrio relativo: ${this.result.residual.toExponential(2)} / revisión ${revision}`);
      },
    });
  }

  public async compareKernel(): Promise<void> {
    if (!this.kernelBridge || !this.model || !this.result || this.isStale() || this.pending || this.kernelPending) return;
    const model = structuredClone(this.model);
    const reference = structuredClone(this.result);
    const factors = { ...this.factors };
    const revision = model.revision;
    const abort = new AbortController();
    this.cancelKernelCheck();
    this.kernelAbort = abort;
    this.kernelPending = true;
    this.kernelStatus = 'running';
    this.kernelMessage = 'Contraste Rust/WASM en curso...';
    this.kernelReport = null;
    this.sync();

    try {
      const input = toFrame2dKernelInput(model, factors);
      const kernelResult = await this.kernelBridge.solveKernelFrame2d(input, { revision, signal: abort.signal });
      if (this.kernelAbort !== abort || this.isStale() || this.model?.revision !== revision) return;
      const report = compareFrame2dResults(model, factors, reference, kernelResult);
      this.kernelReport = report;
      this.kernelStatus = report.passed ? 'passed' : 'mismatch';
      const total = report.rows.length + report.memberRows.length + report.diagramRows.length;
      const failures = [...report.rows, ...report.memberRows, ...report.diagramRows].filter(row => !row.passed).length;
      const deformationFailures = report.deformationRows.filter(row => !row.passed).length;
      const deformationSummary = report.deformationAvailable
        ? ` Deformada Timoshenko: ${deformationFailures} de ${report.deformationRows.length} componentes de estación fuera de tolerancia.`
        : ' Contraste incompleto: el módulo WASM no devolvió deformada por estaciones.';
      const responseSummary = report.responsePassed
        ? `${total} comparaciones de nudos, extremos y diagramas dentro de tolerancia.`
        : `${failures} de ${total} comparaciones de nudos, extremos y diagramas fuera de tolerancia.`;
      this.kernelMessage = responseSummary + deformationSummary;
      this.tab = 'results';
    } catch (error) {
      if (this.kernelAbort !== abort || abort.signal.aborted) return;
      this.kernelStatus = 'error';
      this.kernelMessage = error instanceof Error ? error.message : 'Falló el contraste Rust/WASM.';
    } finally {
      if (this.kernelAbort === abort) {
        this.kernelAbort = undefined;
        this.kernelPending = false;
        this.sync();
      }
    }
  }

  private isStale(): boolean {
    return this.needsGeneration || (!!this.model && this.model.revision !== BimDatabase.getInstance().revision);
  }

  private sync(): void {
    const stale = this.isStale();
    analysisPanelStore.publish({
      open: this.panelOpen,
      model: this.model ? structuredClone(this.model) : null,
      result: this.result ? structuredClone(this.result) : null,
      draft: { ...this.draft },
      factors: { ...this.factors },
      caseName: this.caseName,
      benchmark: this.benchmark,
      loadFilter: this.loadFilter,
      tab: this.tab,
      pending: this.pending,
      stale,
      canCalculate: !!this.model && !stale,
      kernelAvailable: !!this.kernelBridge,
      canCompareKernel: !!this.kernelBridge && !!this.result && !stale && !this.pending && !this.kernelPending,
      kernelStatus: this.kernelStatus,
      kernelMessage: this.kernelMessage,
      kernelReport: this.kernelReport ? structuredClone(this.kernelReport) : null,
      canExport: !!this.model && !stale,
      canReport: !!this.result && !stale,
      status: this.statusText,
      stateVersion: this.stateVersion,
    });
  }

  private status(message: string): void {
    this.statusText = message;
    this.sync();
  }

  private changed(): void {
    this.stateVersion++;
    this.result = null;
    this.analysisWorker.cancel();
    this.cancelKernelCheck();
    this.pending = false;
    this.sync();
    this.paint();
    this.status('Entradas modificadas. Calcular para actualizar resultados.');
  }

  private paint(): void {
    renderAnalysisCanvas(this.model, this.result);
  }

  private cancelKernelCheck(): void {
    this.kernelAbort?.abort();
    this.kernelAbort = undefined;
    this.kernelPending = false;
    this.kernelStatus = 'idle';
    this.kernelMessage = '';
    this.kernelReport = null;
  }
}
