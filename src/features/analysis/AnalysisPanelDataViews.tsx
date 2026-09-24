'use client';

import { useState, type FormEvent } from 'react';
import { Download, Pencil, Save, Trash2 } from 'lucide-react';
import type { AnalysisModel } from '../../core/analysis/Model';
import type { LoadLedger } from '../../core/analysis/LoadLedger';
import type { LoadFilter } from './LoadBalanceView';
import { compileSurfaceLoads, surfaceSnapshot, type SurfaceLoad } from '../../core/analysis/SurfaceLoads';
import { BimDatabase } from '../../core/database/BimDatabase';
import type { BimElementDocument } from '../../core/database/BimDatabaseTypes';

const tableClasses = 'w-full border-collapse text-left text-xs [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-2';

export function SurfaceLoadEditor({
  model,
  onSave,
  onDelete,
}: {
  model: AnalysisModel;
  onSave: (surface: SurfaceLoad) => string;
  onDelete: (sourceId: string) => void;
}) {
  const docs = BimDatabase.getInstance().getAllElements();
  const slabs = docs.filter(doc => doc.geometry.definition.type === 'slab');
  const [selectedId, setSelectedId] = useState(slabs[0]?.uniqueId ?? '');
  const selected = slabs.find(doc => doc.uniqueId === selectedId) ?? slabs[0];
  let rows: ReturnType<typeof compileSurfaceLoads>['rows'] = [];
  let error = '';
  try {
    rows = compileSurfaceLoads(model, false).rows;
  } catch (cause) {
    error = (cause as Error).message;
  }
  const receivers = docs.filter(doc => {
    if (doc.geometry.definition.type !== 'beam') return false;
    const members = model.members.filter(member => member.sourceId === doc.uniqueId);
    return members.length > 0 && members.every(member => {
      const start = model.nodes.find(node => node.id === member.start);
      const end = model.nodes.find(node => node.id === member.end);
      return !!start && !!end && Math.abs(start.y - end.y) < 1e-6;
    });
  });

  return <div className="flex min-h-0 flex-col gap-2">
    <div className="border-b p-2 text-xs" role="note">Reparto uniforme declarado; no es análisis de placa ni reparto automático. Peso de losa bruto con huecos, sin conciliación de solapes. Receptores: D/L manual = 0 y D adicional. La conservación de fuerza no verifica momentos ni compatibilidad espacial del reparto.</div>
    {error && <div className="border p-2 text-xs" role="status">{error}</div>}
    <div className="overflow-auto"><table className={tableClasses}><thead><tr><th>Fuente</th><th>D / L total (kN)</th><th>Al pórtico (kN)</th><th>Fuera (kN)</th><th>Pendiente (kN)</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.sourceId} data-surface-source={row.sourceId}>
      <td>{docs.find(doc => doc.uniqueId === row.sourceId)?.instanceParameters.mark ?? row.sourceId}</td>
      <td>{row.dead.toFixed(3)} / {row.live.toFixed(3)}</td><td>{row.assignedDead.toFixed(3)} / {row.assignedLive.toFixed(3)}</td>
      <td>{row.outsideDead.toFixed(3)} / {row.outsideLive.toFixed(3)}</td><td>{row.pendingDead.toFixed(3)} / {row.pendingLive.toFixed(3)} ({(row.pendingFraction * 100).toFixed(2)}%)</td>
      <td><button type="button" data-surface-edit={row.sourceId} className="flex h-8 w-8 items-center justify-center border" title="Editar fuente" aria-label="Editar fuente" onClick={() => setSelectedId(row.sourceId)}><Pencil aria-hidden="true" size={16} /></button>
        <button type="button" data-surface-delete={row.sourceId} className="flex h-8 w-8 items-center justify-center border" title="Eliminar fuente" aria-label="Eliminar fuente" onClick={() => onDelete(row.sourceId)}><Trash2 aria-hidden="true" size={16} /></button></td>
    </tr>)}</tbody></table></div>
    {selected ? <SurfaceLoadForm key={selected.uniqueId} model={model} slabs={slabs} selected={selected} receivers={receivers} onSourceChange={setSelectedId} onSave={onSave} /> : <div className="p-8 text-center">Sin losas en el modelo BIM</div>}
  </div>;
}

function SurfaceLoadForm({
  model,
  slabs,
  selected,
  receivers,
  onSourceChange,
  onSave,
}: {
  model: AnalysisModel;
  slabs: BimElementDocument[];
  selected: BimElementDocument;
  receivers: BimElementDocument[];
  onSourceChange: (sourceId: string) => void;
  onSave: (surface: SurfaceLoad) => string;
}) {
  const saved = model.surfaceLoads?.find(surface => surface.sourceId === selected.uniqueId);
  const [weight, setWeight] = useState(saved ? String(saved.unitWeight) : '');
  const [dead, setDead] = useState(saved ? String(saved.additionalDead) : '');
  const [live, setLive] = useState(saved ? String(saved.live) : '');
  const [reference, setReference] = useState(saved?.reference ?? '');
  const [outside, setOutside] = useState(String((saved?.outsideFraction ?? 0) * 100));
  const [outsideReference, setOutsideReference] = useState(saved?.outsideReference ?? '');
  const [allocations, setAllocations] = useState<Record<string, string>>(() => Object.fromEntries(
    receivers.map(doc => [doc.uniqueId, String((saved?.allocations.find(allocation => allocation.receiverId === doc.uniqueId)?.fraction ?? 0) * 100)]),
  ));
  const [feedback, setFeedback] = useState('');
  const dimensions = surfaceSnapshot(selected);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const declaredAllocations = receivers.map(doc => ({ receiverId: doc.uniqueId, fraction: Number(allocations[doc.uniqueId] ?? 0) / 100 }));
      if (declaredAllocations.some(allocation => !Number.isFinite(allocation.fraction) || allocation.fraction < 0)) throw new Error('Porcentajes no válidos.');
      const surface: SurfaceLoad = {
        ...dimensions,
        unitWeight: Number(weight),
        additionalDead: Number(dead),
        live: Number(live),
        reference,
        method: 'declared-uniform',
        allocations: declaredAllocations.filter(allocation => allocation.fraction > 0),
        outsideFraction: Number(outside) / 100,
        outsideReference,
      };
      const next = [...(model.surfaceLoads ?? []).filter(item => item.sourceId !== selected.uniqueId), surface];
      compileSurfaceLoads({ ...model, surfaceLoads: next }, false);
      setFeedback(onSave(surface));
    } catch (cause) {
      setFeedback((cause as Error).message);
    }
  }

  const numberInput = (id: string, label: string, value: string, setValue: (value: string) => void) => <label>{label}<input id={`surface-${id}`} type="number" min="0" step="any" required value={value} onChange={event => setValue(event.currentTarget.value)} /></label>;

  return <form id="surface-form" className="min-h-0 overflow-auto" onSubmit={submit}>
    <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-3">
      <label>Losa<select id="surface-source" value={selected.uniqueId} onChange={event => onSourceChange(event.currentTarget.value)}>{slabs.map(doc => <option key={doc.uniqueId} value={doc.uniqueId}>{doc.instanceParameters.mark} / {doc.levelName}</option>)}</select></label>
      <div className="self-center text-xs">Área con huecos: {dimensions.area.toFixed(3)} m²<br />Espesor: {dimensions.thickness.toFixed(3)} m</div>
      {numberInput('weight', 'Peso unitario (kN/m³)', weight, setWeight)}
      {numberInput('dead', 'D sobrepuesta (kN/m²)', dead, setDead)}
      {numberInput('live', 'L (kN/m²)', live, setLive)}
      <label className="col-span-2">Sustento de cargas y reparto<input className="w-full" id="surface-reference" maxLength={2000} value={reference} onChange={event => setReference(event.currentTarget.value)} /></label>
      {numberInput('outside', 'Fuera del pórtico (%)', outside, setOutside)}
      <label className="col-span-2">Sustento fuera del pórtico<input className="w-full" id="surface-outside-reference" maxLength={2000} value={outsideReference} onChange={event => setOutsideReference(event.currentTarget.value)} /></label>
    </div>
    <div className="max-h-[24dvh] overflow-auto"><table className={tableClasses}><thead><tr><th>Viga receptora / nivel</th><th>Porcentaje de la fuente (%)</th><th>D / L manual (kN/m)</th></tr></thead><tbody>{receivers.map(doc => {
      const members = model.members.filter(member => member.sourceId === doc.uniqueId);
      const hasManualLoads = members.some(member => member.dead !== 0 || member.live !== 0 || member.deadLoadMode === 'includes-self-weight');
      return <tr key={doc.uniqueId}><td>{doc.instanceParameters.mark} / {doc.levelName}</td>
        <td><input type="number" aria-label={`Porcentaje ${doc.instanceParameters.mark}`} data-surface-receiver={doc.uniqueId} min="0" max="100" step="any" required value={allocations[doc.uniqueId] ?? '0'} onChange={event => setAllocations(current => ({ ...current, [doc.uniqueId]: event.currentTarget.value }))} /></td>
        <td>{hasManualLoads ? 'Requiere conciliación en Barras' : 'Sin cargas manuales'}</td></tr>;
    })}</tbody></table></div>
    <div className="flex flex-wrap items-center gap-3 p-2"><button type="submit" id="surface-save" className="border px-2 py-1"><Save aria-hidden="true" size={16} /> Guardar fuente</button><span id="surface-feedback" role="status" className="min-w-0 flex-1 break-words">{feedback}</span></div>
  </form>;
}

const loadStatusLabels = {
  applied: 'En portico',
  'outside-plane': 'Fuera del plano',
  'transfer-pending': 'Sin transferencia BIM',
  'transfer-linked': 'Fuente superficial declarada',
  unsupported: 'Fuera del motor',
  'missing-source': 'Sin fuente BIM',
} as const;

function ledgerValue(value: number | null): string {
  return value === null ? 'Pendiente' : value.toFixed(3);
}

export function LoadBalanceTable({
  ledger,
  filter,
  onFilter,
  onExport,
  onFocus,
}: {
  ledger: LoadLedger;
  filter: LoadFilter;
  onFilter: (filter: LoadFilter) => void;
  onExport: (format: 'csv' | 'json') => void;
  onFocus: (id: string) => void;
}) {
  const totals = ledger.assembled.totals;
  const equilibrium = ledger.equilibrium;
  const rows = ledger.rows.filter(row => filter === 'all' || (filter === 'applied'
    ? row.memberIds.length > 0 || row.status === 'transfer-linked'
    : row.memberIds.length === 0 && row.status !== 'transfer-linked'));
  const pending = ledger.rows.filter(row => row.status === 'transfer-pending').length;
  const marks = new Map(ledger.rows.map(row => [row.sourceId, row.mark]));

  return <>
    <div className="grid grid-cols-2 gap-3 border-y p-3 md:grid-cols-4">
      <div><span>PP automatico activo</span><strong>{ledgerValue(totals.selfWeight)} kN</strong><small>Excluido por D total: {ledgerValue(totals.excludedSelfWeight)} kN</small></div>
      <div><span>D manual sin factor</span><strong>{ledgerValue(totals.manualDead)} kN</strong><small>L manual: {ledgerValue(totals.manualLive)} kN</small><small>D / L superficial: {ledgerValue(totals.surfaceDead)} / {ledgerValue(totals.surfaceLive)} kN</small></div>
      <div><span>Fy aplicado / caso</span><strong id="load-balance-fy">{ledgerValue(totals.fy)} kN</strong><small>Fx: {ledgerValue(totals.fx)} kN / M horario: {ledgerValue(totals.moment)} kN m</small></div>
      <div><span>Reacciones del caso</span><strong>{equilibrium ? `${ledgerValue(equilibrium.reactionY)} kN` : 'Sin resultado vigente'}</strong><small>{equilibrium ? `Ry + Fy: ${(equilibrium.reactionY + totals.fy).toExponential(3)} kN` : 'Balance previo al calculo'}</small></div>
    </div>
    <div className="border-b p-2 text-xs">{pending} losas sin transferencia BIM vinculada. El volumen neto es comparativo: no modifica cargas. Las entradas manuales no acreditan E.020.</div>
    {ledger.loadValidationError && <div className="border-b p-2 text-xs" role="status">Calculo bloqueado: {ledger.loadValidationError}</div>}
    {!!ledger.assembled.surfaces.length && <details className="my-2 overflow-auto" open>
      <summary>Reparto superficial declarado / D y L sin factor</summary>
      <table className={tableClasses}><thead><tr><th>Losa</th><th>Fuente D / L (kN)</th><th>Al portico (kN)</th><th>Fuera (kN)</th><th>Pendiente (kN / %)</th><th>Sustento</th></tr></thead><tbody>{ledger.assembled.surfaces.map(surface => <tr key={surface.sourceId}>
        <td>{marks.get(surface.sourceId) ?? surface.sourceId}</td><td>{ledgerValue(surface.dead)} / {ledgerValue(surface.live)}</td><td>{ledgerValue(surface.assignedDead)} / {ledgerValue(surface.assignedLive)}</td><td>{ledgerValue(surface.outsideDead)} / {ledgerValue(surface.outsideLive)}</td><td>{ledgerValue(surface.pendingDead)} / {ledgerValue(surface.pendingLive)} / {ledgerValue(surface.pendingFraction * 100)}%</td><td>{surface.reference || 'Pendiente'} / {surface.outsideReference}</td>
      </tr>)}</tbody></table>
      <table className={tableClasses}><thead><tr><th>Losa / receptor</th><th>Tramos</th><th>Fraccion (%)</th><th>D / L (kN)</th><th>q D / L (kN/m)</th></tr></thead><tbody>{ledger.assembled.surfaces.flatMap(surface => surface.allocations.map(allocation => <tr key={`${surface.sourceId}-${allocation.receiverId}-${allocation.memberIds.join('|')}`}>
        <td>{marks.get(surface.sourceId) ?? surface.sourceId} / {marks.get(allocation.receiverId) ?? allocation.receiverId}</td><td>{allocation.memberIds.join(', ')}</td><td>{ledgerValue(allocation.fraction * 100)}</td><td>{ledgerValue(allocation.dead)} / {ledgerValue(allocation.live)}</td><td>{ledgerValue(allocation.qDead)} / {ledgerValue(allocation.qLive)}</td>
      </tr>))}</tbody></table>
    </details>}
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
      <label>Fuentes<select id="load-balance-filter" value={filter} onChange={event => onFilter(event.currentTarget.value as LoadFilter)}><option value="applied">En el portico</option><option value="pending">Fuera del calculo</option><option value="all">Todas</option></select></label>
      <span>Plano {ledger.plane} / {ledger.ordinate} m / {rows.length} fuentes / revision {ledger.modelRevision}</span>
      <div className="flex items-center gap-2"><button id="load-balance-csv" type="button" title="Exportar balance completo CSV" onClick={() => onExport('csv')}><Download aria-hidden="true" size={16} /> CSV</button><button id="load-balance-json" type="button" title="Exportar fuentes y tramos JSON" onClick={() => onExport('json')}><Download aria-hidden="true" size={16} /> JSON</button></div>
    </div>
    <div className="max-h-[32dvh] min-h-[100px] overflow-auto"><table className={tableClasses}><thead><tr><th>Elemento / nivel BIM</th><th>Estado / tramos</th><th>L FEM (m)</th><th>V bruto / neto (m3)</th><th>Peso unitario (kN/m3)</th><th>PP activo / excluido (kN)</th><th>D / L manual (kN)</th><th>Referencia peso bruto / neto (kN)</th><th>Carga del caso hacia abajo (kN)</th><th>Observaciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.sourceId} data-load-source={row.sourceId}>
      <td><button type="button" data-focus={row.sourceId} title={row.sourceId} onClick={() => onFocus(row.sourceId)}>{row.mark}</button><small>{row.level} / {row.material}</small></td><td>{loadStatusLabels[row.status]}<small>{row.memberIds.join(', ') || 'Sin tramos'}</small></td><td>{ledgerValue(row.length)}</td><td>{ledgerValue(row.grossVolume)} / {ledgerValue(row.netVolume)}</td><td>{ledgerValue(row.unitWeight)}</td><td>{ledgerValue(row.selfWeight)} / {ledgerValue(row.excludedSelfWeight)}</td><td>{ledgerValue(row.manualDead)} / {ledgerValue(row.manualLive)}</td><td>{ledgerValue(row.grossReferenceWeight)} / {ledgerValue(row.netReferenceWeight)}</td><td>{ledgerValue(row.downward)}</td><td className="whitespace-normal">{row.notes.join(' ') || 'Peso de barras bruto. Sin verificacion normativa.'}</td>
    </tr>)}</tbody></table></div>
    <details className="my-2 overflow-auto"><summary>Totales por nivel BIM de origen</summary><table className={tableClasses}><thead><tr><th>Nivel</th><th>PP activo (kN)</th><th>D manual (kN)</th><th>L manual (kN)</th><th>Caso descendente (kN)</th><th>Losas pendientes</th></tr></thead><tbody>{ledger.levels.map(level => <tr key={level.level}><td>{level.level}</td><td>{ledgerValue(level.selfWeight)}</td><td>{ledgerValue(level.manualDead)}</td><td>{ledgerValue(level.manualLive)}</td><td>{ledgerValue(level.downward)}</td><td>{level.pending}</td></tr>)}</tbody></table></details>
    <details className="my-2 overflow-auto"><summary>Cargas nodales aplicadas (no incluidas en los totales por nivel)</summary><table className={tableClasses}><thead><tr><th>Nudo</th><th>Fx (kN)</th><th>Fy (kN)</th><th>M horario (kN m)</th></tr></thead><tbody>{ledger.assembled.nodes.filter(node => node.fx || node.fy || node.moment).map(node => <tr key={node.id}><td>{node.id}</td><td>{ledgerValue(node.fx)}</td><td>{ledgerValue(node.fy)}</td><td>{ledgerValue(node.moment)}</td></tr>)}</tbody></table></details>
  </>;
}
