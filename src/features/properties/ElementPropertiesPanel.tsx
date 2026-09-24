'use client';

import { useEffect, useState } from 'react';
import { Copy, Table2, Trash2 } from 'lucide-react';
import type { ElementPropertiesSnapshot } from '@/features/properties/SidebarPropertiesStore.ts';
import { requestSidebarPropertiesAction } from '@/features/properties/SidebarPropertiesStore.ts';

const fieldClass = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500';

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-950/70 p-2 text-xs text-slate-300">
        {children}
      </div>
    </section>
  );
}

function ValueRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-slate-400">{label}</span>{children}</div>;
}

export default function ElementPropertiesPanel({ element }: { element: ElementPropertiesSnapshot }) {
  const [mark, setMark] = useState(element.mark);
  const [baseOffset, setBaseOffset] = useState(element.baseOffset.toFixed(2));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMark(element.mark);
    setBaseOffset(element.baseOffset.toFixed(2));
    setCopied(false);
  }, [element.id, element.mark, element.baseOffset]);

  const copyGuid = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(element.uniqueId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <header className="border-b border-slate-700 pb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-sky-400">
            <span aria-hidden="true">{element.icon}</span><span className="truncate">{element.familyType}</span>
          </span>
          <span className="shrink-0 rounded border border-sky-800 bg-sky-950 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">ID: {element.elementId}</span>
        </div>
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
          <span className="min-w-0 truncate">GUID: <span className="text-slate-300">{element.uniqueId.slice(0, 8)}...{element.uniqueId.slice(-4)}</span></span>
          <button type="button" onClick={() => void copyGuid()} className="flex shrink-0 items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700" title="Copiar GUID completo" aria-label="Copiar GUID completo">
            <Copy aria-hidden="true" className="h-3 w-3" /> {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </header>

      <PropertySection title="Jerarquía BIM">
        <ValueRow label="Categoría:"><span className="text-right font-medium text-slate-200">{element.categoryName}</span></ValueRow>
        <ValueRow label="Familia:"><span className="text-right font-medium text-slate-200">{element.family}</span></ValueRow>
        <ValueRow label="Entidad IFC:"><span className="font-mono font-semibold text-emerald-400">{element.ifcEntity}</span></ValueRow>
      </PropertySection>

      <PropertySection title="Parámetros de tipo">
        <ValueRow label="Tipo activo:"><strong className="text-right text-sky-300">{element.familyType}</strong></ValueRow>
        <ValueRow label="Material base:"><span className="text-right text-slate-200">{element.material}</span></ValueRow>
        <ValueRow label="Costo base:"><strong className="font-mono text-purple-300">${element.unitCost.toFixed(2)} / m³</strong></ValueRow>
      </PropertySection>

      <PropertySection title="Parámetros de ejemplar">
        <ValueRow label="Marca / código:">
          <input id="prop-input-mark" aria-label="Marca / código" type="text" value={mark} onChange={event => setMark(event.currentTarget.value)} onBlur={() => { if (mark.trim()) requestSidebarPropertiesAction({ type: 'element-mark', id: element.id, value: mark.trim() }); }} className={`${fieldClass} w-28 font-bold text-sky-400`} />
        </ValueRow>
        <ValueRow label="Sector de vaciado:">
          <select id="prop-select-sector" aria-label="Sector de vaciado" value={element.sector} onChange={event => requestSidebarPropertiesAction({ type: 'element-sector', id: element.id, value: event.currentTarget.value })} className={`${fieldClass} max-w-36`}>
            {!['Sector A', 'Sector B', 'Sector C', 'Sector D'].includes(element.sector) && <option value={element.sector}>{element.sector}</option>}
            {['Sector A', 'Sector B', 'Sector C', 'Sector D'].map(sector => <option key={sector} value={sector}>{sector}</option>)}
          </select>
        </ValueRow>
        <ValueRow label="f'c concreto:">
          <select id="prop-select-fc" aria-label="f'c concreto" value={element.concreteStrength} onChange={event => requestSidebarPropertiesAction({ type: 'element-concrete-strength', id: element.id, value: Number(event.currentTarget.value) })} className={`${fieldClass} max-w-36`}>
            {!([210, 280, 350] as number[]).includes(element.concreteStrength) && <option value={element.concreteStrength}>{element.concreteStrength} kg/cm²</option>}
            {[210, 280, 350].map(value => <option key={value} value={value}>{value} kg/cm²</option>)}
          </select>
        </ValueRow>
        <ValueRow label="Fase constructiva:">
          <select id="prop-select-phase" aria-label="Fase constructiva" value={element.phase} onChange={event => requestSidebarPropertiesAction({ type: 'element-phase', id: element.id, value: event.currentTarget.value as ElementPropertiesSnapshot['phase'] })} className={`${fieldClass} max-w-40`}>
            <option value="Nueva Construcción">Nueva Construcción</option>
            <option value="Existente">Existente</option>
            <option value="Demolición">Demolición</option>
          </select>
        </ValueRow>
        <ValueRow label="Nivel base:"><span className="text-right font-medium text-slate-200">{element.levelName}</span></ValueRow>
        <ValueRow label="Desfase de base:">
          <span className="flex items-center gap-1"><input id="prop-input-offset" aria-label="Desfase de base" type="number" step="0.05" value={baseOffset} onChange={event => setBaseOffset(event.currentTarget.value)} onBlur={() => requestSidebarPropertiesAction({ type: 'element-base-offset', id: element.id, value: baseOffset })} className={`${fieldClass} w-20 text-center font-mono`} /><span className="text-[10px] text-slate-500">m</span></span>
        </ValueRow>
      </PropertySection>

      <PropertySection title="Cotas y metrados calculados">
        <ValueRow label="Dimensiones:"><span className="text-right font-medium text-slate-200">{element.dimensions}</span></ValueRow>
        <ValueRow label="Concreto neto:"><strong className="font-mono text-emerald-400">{element.quantityState === 'ready' ? `${element.volume.toFixed(3)} m³` : 'Pendiente'}</strong></ValueRow>
        <ValueRow label="Bruto / solape:"><strong className="font-mono">{element.grossVolume.toFixed(3)} / {element.overlapVolume?.toFixed(3) ?? '-'} m³</strong></ValueRow>
        <ValueRow label="Acero manual:"><strong className="font-mono">{element.steelMass?.toFixed(2) ?? 'No definido'}{element.steelMass === null ? '' : ' kg'}</strong></ValueRow>
        <ValueRow label="Área de encofrado:"><strong className="font-mono text-amber-400">{element.surfaceArea.toFixed(2)} m²</strong></ValueRow>
        <ValueRow label="Costo estimado:"><strong className="font-mono text-purple-400">{element.quantityState === 'ready' ? `$${element.estimatedCost.toFixed(2)}` : 'Pendiente'}</strong></ValueRow>
      </PropertySection>

      <div className="flex flex-col gap-2 pt-1">
        <button id="btn-prop-open-schedule" type="button" onClick={() => requestSidebarPropertiesAction({ type: 'element-open-schedule', id: element.id })} className="flex items-center justify-center gap-1.5 rounded border border-sky-700 bg-sky-950 px-2 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-900">
          <Table2 aria-hidden="true" className="h-3.5 w-3.5" /> Ver en tabla de planificación
        </button>
        <button id="btn-delete-prop" type="button" onClick={() => requestSidebarPropertiesAction({ type: 'element-delete', id: element.id })} className="flex items-center justify-center gap-1.5 rounded border border-red-800 bg-red-950/50 px-2 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900">
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Suprimir elemento
        </button>
      </div>
    </div>
  );
}
