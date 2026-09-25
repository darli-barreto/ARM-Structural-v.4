'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Calculator, Download, FileText, Scale, X } from 'lucide-react';
import type { LoadFilter } from '@/features/analysis/LoadBalanceView.ts';
import { buildLoadLedger } from '@/core/analysis/LoadLedger';
import { BimDatabase } from '@/core/database/BimDatabase';
import type { AnalysisModel, Support } from '@/core/analysis/Model';
import type { DeadLoadMode } from '@/core/analysis/Loads';
import { analysisPanelStore, type AnalysisDraftKey, type AnalysisPanelTab } from '@/features/analysis/AnalysisPanelStore.ts';
import { LoadBalanceTable as LoadBalanceTableView, SurfaceLoadEditor as SurfaceLoadEditorView } from './AnalysisPanelDataViews';
import { AnalysisResultsView } from './AnalysisResultsView';
import { useMobileViewerMode } from '@/shared/ui/useMobileViewerMode.ts';

const tableClasses = 'w-full border-collapse text-left text-xs [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-2';

const tabs: { id: AnalysisPanelTab; label: string }[] = [
  { id: 'nodes', label: 'Nudos y cargas' },
  { id: 'members', label: 'Barras' },
  { id: 'surfaces', label: 'Superficies' },
  { id: 'loads', label: 'Balance de cargas' },
  { id: 'results', label: 'Resultados' },
];

export default function AnalysisPanel() {
  const panel = useSyncExternalStore(analysisPanelStore.subscribe, analysisPanelStore.getSnapshot, analysisPanelStore.getServerSnapshot);
  const commands = analysisPanelStore.getCommands();
  const mobileViewer = useMobileViewerMode();
  const [numericDraft, setNumericDraft] = useState(() => ({
    ordinate: String(panel.draft.ordinate),
    tolerance: String(panel.draft.tolerance),
    elasticModulusMPa: String(panel.draft.elasticModulusMPa),
    unitWeight: String(panel.draft.unitWeight),
    dead: String(panel.factors.dead),
    live: String(panel.factors.live),
    nodal: String(panel.factors.nodal),
  }));
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (panel.open && !wasOpen.current) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => closeButton.current?.focus());
    } else if (!panel.open && wasOpen.current) {
      previousFocus.current?.focus();
      previousFocus.current = null;
    }
    wasOpen.current = panel.open;
  }, [panel.open]);

  useEffect(() => {
    setNumericDraft({
      ordinate: String(panel.draft.ordinate),
      tolerance: String(panel.draft.tolerance),
      elasticModulusMPa: String(panel.draft.elasticModulusMPa),
      unitWeight: String(panel.draft.unitWeight),
      dead: String(panel.factors.dead),
      live: String(panel.factors.live),
      nodal: String(panel.factors.nodal),
    });
  }, [panel.draft, panel.factors]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      commands?.close();
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
    )).filter(control => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const changeNumericDraft = (key: keyof typeof numericDraft, value: string) => {
    setNumericDraft(draft => ({ ...draft, [key]: value }));
  };
  const commitDraftNumber = (key: Exclude<AnalysisDraftKey, 'plane'>) => {
    const value = numericDraft[key];
    commands?.updateDraft(key, value === '' ? Number.NaN : Number(value));
  };
  const commitFactor = (key: 'dead' | 'live' | 'nodal') => {
    const value = numericDraft[key];
    commands?.updateFactor(key, value === '' ? Number.NaN : Number(value));
  };

  const tableContent = (() => {
    if (panel.tab === 'loads') {
      if (!panel.model) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-loads"><div className="p-8 text-center text-sm">Sin plano analítico</div></div>;
      if (panel.stale) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-loads"><div className="p-8 text-center text-sm">Plano no vigente. Regenerar antes de emitir el balance.</div></div>;
      try {
        const ledger = buildLoadLedger(panel.model, panel.factors, BimDatabase.getInstance().getAllElements(), panel.result ?? undefined);
        return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-loads"><LoadBalanceTableView
          ledger={ledger}
          filter={panel.loadFilter}
          onFilter={filter => commands?.setLoadFilter(filter)}
          onExport={format => commands?.exportLoadLedger(format)}
          onFocus={id => commands?.focusElement(id)}
        /></div>;
      } catch (error) {
        return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-loads"><div className="p-8 text-center text-sm">{(error as Error).message}</div></div>;
      }
    }
    if (panel.tab === 'surfaces') {
      if (!panel.model) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-surfaces"><div className="p-8 text-center text-sm">Sin plano analítico</div></div>;
      if (panel.stale) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-surfaces"><div className="p-8 text-center text-sm">Plano no vigente. Regenerar antes de editar el reparto.</div></div>;
      return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-surfaces"><SurfaceLoadEditorView
        model={panel.model}
        onSave={surface => commands?.saveSurfaceLoad(surface) ?? ''}
        onDelete={sourceId => commands?.deleteSurfaceLoad(sourceId)}
      /></div>;
    }
    const model = panel.model;
    if (!model) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby={`analysis-tab-${panel.tab}`}><div className="p-8 text-center text-sm">Sin plano analítico</div></div>;
    if (panel.tab === 'nodes') {
      const supports: { value: Support; label: string }[] = [
        { value: 'free', label: 'Libre' }, { value: 'fixed', label: 'Empotrado' },
        { value: 'pinned', label: 'Articulado' }, { value: 'roller', label: 'Rodillo vertical' },
      ];
      return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-nodes"><table className={tableClasses}><thead><tr><th>Nudo</th><th>H (m)</th><th>Y (m)</th><th>Apoyo</th><th>Fh (kN)</th><th>Fy (kN)</th><th>M (kN m)</th></tr></thead><tbody>{model.nodes.map((node, index) => <tr key={node.id}>
        <td>{node.id}</td><td>{node.x.toFixed(3)}</td><td>{node.y.toFixed(3)}</td>
        <td><select data-support={index} aria-label={`Apoyo ${node.id}`} value={node.support} onChange={event => commands?.updateSupport(index, event.currentTarget.value as Support)}>{supports.map(support => <option key={support.value} value={support.value}>{support.label}</option>)}</select></td>
        {(['fx', 'fy', 'moment'] as const).map(key => <td key={key}><input key={`${node.id}-${key}-${panel.stateVersion}`} aria-label={`${key} ${index + 1}`} type="number" step="0.1" defaultValue={node[key]} data-index={index} data-key={key} data-kind="node" onBlur={event => { const value = event.currentTarget.valueAsNumber; if (value !== node[key]) commands?.updateNode(index, key, value); }} /></td>)}
      </tr>)}</tbody></table></div>;
    }
    if (panel.tab === 'members') {
      return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-members"><table className={tableClasses}><thead><tr><th>Elemento</th><th>Tramo / origen</th><th>Nudos</th><th>A (m²)</th><th>I (m⁴)</th><th>D manual (kN/m)</th><th>L (kN/m)</th><th>Art. inicio</th><th>Art. fin</th><th>Declaración de D</th><th>Referencia D / L</th></tr></thead><tbody>{model.members.map((member, index) => <tr key={member.id}>
        <td><button type="button" data-focus={member.sourceId} onClick={() => commands?.focusElement(member.sourceId)}>{member.mark}</button></td>
        <td>{member.id} / {member.sourceRange ? member.sourceRange.map(value => `${(value * 100).toFixed(2)}%`).join(' - ') : 'Legado'}</td>
        <td>{member.start} / {member.end}</td><td>{member.area.toFixed(4)}</td><td>{member.inertia.toExponential(3)}</td>
        {(['dead', 'live'] as const).map(key => <td key={key}><input key={`${member.id}-${key}-${panel.stateVersion}`} aria-label={`${key} ${index + 1}`} type="number" step="0.1" defaultValue={member[key]} data-index={index} data-key={key} data-kind="member" onBlur={event => { const value = event.currentTarget.valueAsNumber; if (value !== member[key]) commands?.updateMember(index, key, value); }} /></td>)}
        {(['releaseStart', 'releaseEnd'] as const).map((end, endIndex) => <td key={end}><input type="checkbox" data-release={index} data-end={end} checked={member[end]} aria-label={`Liberación ${endIndex ? 'fin' : 'inicio'} ${member.mark}`} onChange={event => commands?.updateRelease(index, end, event.currentTarget.checked)} /></td>)}
        <td><select data-dead-mode={index} aria-label={`Declaración D ${member.id}`} value={member.deadLoadMode === 'includes-self-weight' ? 'includes-self-weight' : 'additional'} onChange={event => commands?.updateDeadLoadMode(index, event.currentTarget.value as DeadLoadMode)}><option value="additional">D adicional</option><option value="includes-self-weight">D total, incluye PP</option></select></td>
        <td><input key={`${member.id}-reference-${panel.stateVersion}`} data-load-reference={index} aria-label={`Referencia cargas ${member.id}`} maxLength={2000} defaultValue={member.loadReference ?? ''} onBlur={event => { if (event.currentTarget.value !== (member.loadReference ?? '')) commands?.updateLoadReference(index, event.currentTarget.value); }} /></td>
      </tr>)}</tbody></table></div>;
    }
    if (!panel.result) return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-results"><div className="p-8 text-center text-sm">Sin resultados vigentes</div></div>;
    return <div id="analysis-table" className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby="analysis-tab-results">
      <AnalysisResultsView panel={panel} />
    </div>;
  })();

  if (!panel.open) return null;

  return <div
    id="analysis-panel"
    className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-0 md:items-center md:p-5"
    role="presentation"
    onKeyDown={onKeyDown}
    onPointerDown={stop}
    onPointerMove={stop}
    onPointerUp={stop}
    onDoubleClick={stop}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) commands?.close(); }}
  >
    <section className="flex max-h-[88dvh] w-full max-w-[1480px] touch-pan-y flex-col overflow-hidden rounded-t-lg border border-slate-300 bg-white text-slate-800 max-md:[&_input]:pointer-events-none max-md:[&_input]:opacity-60 max-md:[&_select]:pointer-events-none max-md:[&_select]:opacity-60 max-md:[&_textarea]:pointer-events-none [&_button]:rounded [&_button]:border [&_button]:border-slate-300 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs [&_input]:min-w-0 [&_select]:min-w-0 md:max-h-[94dvh] md:rounded-none" role="dialog" aria-modal="true" aria-labelledby="analysis-heading">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:gap-4 md:px-4 md:py-3">
        <div><span className="text-xs font-semibold">ARM / INGENIERÍA / RNE PERÚ</span><h2 id="analysis-heading" className="text-lg font-semibold">Análisis de pórticos 2D</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <button id="analysis-export" type="button" className="hidden md:inline-flex" disabled={!panel.canExport} onClick={() => commands?.exportModel()}><Download aria-hidden="true" size={16} /> Modelo</button>
          <button id="analysis-report" type="button" className="hidden md:inline-flex" disabled={!panel.canReport} onClick={() => commands?.exportReport()}><FileText aria-hidden="true" size={16} /> Memoria</button>
          <button id="analysis-close" ref={closeButton} type="button" className="flex h-8 w-8 items-center justify-center border" title="Cerrar" aria-label="Cerrar" onClick={() => commands?.close()}><X aria-hidden="true" size={16} /></button>
        </div>
      </header>
      <div className="hidden shrink-0 flex-wrap items-end gap-2 overflow-auto border-b border-slate-200 p-3 text-xs [&_label]:flex [&_label]:min-w-28 [&_label]:flex-col [&_label]:gap-1 [&_input]:w-full [&_select]:w-full md:flex">
        <label>Plano<select id="analysis-plane" value={panel.draft.plane} onChange={event => commands?.updateDraft('plane', event.currentTarget.value as 'XY' | 'ZY')}><option value="XY">X-Y (Z constante)</option><option value="ZY">Z-Y (X constante)</option></select></label>
        <label>Coordenada (m)<input id="analysis-ordinate" type="number" step="0.1" value={numericDraft.ordinate} onChange={event => changeNumericDraft('ordinate', event.currentTarget.value)} onBlur={() => commitDraftNumber('ordinate')} /></label>
        <label>Unión de nudos (m)<input id="analysis-tolerance" type="number" min="0.00001" max="1" step="0.001" value={numericDraft.tolerance} onChange={event => changeNumericDraft('tolerance', event.currentTarget.value)} onBlur={() => commitDraftNumber('tolerance')} /></label>
        <label>E (MPa)<input id="analysis-modulus" type="number" min="1" value={numericDraft.elasticModulusMPa} onChange={event => changeNumericDraft('elasticModulusMPa', event.currentTarget.value)} onBlur={() => commitDraftNumber('elasticModulusMPa')} /></label>
        <label>Peso unitario (kN/m³)<input id="analysis-weight" type="number" min="0" step="0.1" value={numericDraft.unitWeight} onChange={event => changeNumericDraft('unitWeight', event.currentTarget.value)} onBlur={() => commitDraftNumber('unitWeight')} /></label>
        <button id="analysis-generate" type="button" onClick={() => commands?.generate()}>Generar plano</button>
        <button id="analysis-bases" type="button" disabled={!panel.canCalculate} onClick={() => commands?.fixBases()}>Empotrar bases</button>
      </div>
      <div className="hidden shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs md:block">Lineal elástico, barras Timoshenko. Cargas manuales y reparto superficial declarado. Placas, cimentaciones, sismo E.030 y verificaciones E.060: no evaluados.</div>
      <div className={`min-h-0 max-h-[55dvh] grid-cols-1 overflow-auto md:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] ${panel.tab === 'loads' || panel.tab === 'surfaces' ? 'flex flex-1' : 'grid'}`}>
        <div className={`min-w-0 bg-slate-50 p-2.5 ${panel.tab === 'loads' || panel.tab === 'surfaces' ? 'hidden' : ''}`}><canvas id="analysis-canvas" className="aspect-[12/7] h-auto w-full" width="720" height="420" aria-label="Modelo analítico y deformada" /><div id="analysis-info" className="p-2 text-xs" /></div>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2" role="tablist" aria-label="Datos del análisis">
            {tabs.map(tab => <button key={tab.id} id={`analysis-tab-${tab.id}`} type="button" role="tab" aria-selected={panel.tab === tab.id} aria-controls="analysis-table" data-tab={tab.id} className={panel.tab === tab.id ? 'bg-emerald-100 font-semibold' : 'bg-white'} onClick={() => commands?.setTab(tab.id)}>{tab.label}</button>)}
          </div>
          <fieldset className="contents" disabled={mobileViewer}>{tableContent}</fieldset>
        </div>
      </div>
      <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 md:flex">
        <div className="flex flex-wrap items-end gap-2 text-xs [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_input]:w-20">
          <label>Caso<input id="analysis-case" value={panel.caseName} maxLength={80} onChange={event => commands?.updateCase(event.currentTarget.value)} /></label>
          <label>Factor D<input id="analysis-factor-d" type="number" step="0.1" value={numericDraft.dead} onChange={event => changeNumericDraft('dead', event.currentTarget.value)} onBlur={() => commitFactor('dead')} /></label>
          <label>Factor L<input id="analysis-factor-l" type="number" step="0.1" value={numericDraft.live} onChange={event => changeNumericDraft('live', event.currentTarget.value)} onBlur={() => commitFactor('live')} /></label>
          <label>Factor nodal<input id="analysis-factor-n" type="number" step="0.1" value={numericDraft.nodal} onChange={event => changeNumericDraft('nodal', event.currentTarget.value)} onBlur={() => commitFactor('nodal')} /></label>
          <button id="analysis-solve" type="button" className="bg-emerald-700 text-white" disabled={!panel.canCalculate || panel.pending} onClick={() => commands?.solve()}><Calculator aria-hidden="true" size={16} /> Calcular</button>
          {panel.kernelAvailable && <button id="analysis-kernel-compare" type="button" disabled={!panel.canCompareKernel} onClick={() => commands?.compareKernel()}><Scale aria-hidden="true" size={16} /> Contrastar Rust</button>}
        </div>
        <span id="analysis-status" role="status" aria-live="polite">{panel.status}</span>
      </footer>
    </section>
  </div>;
}
