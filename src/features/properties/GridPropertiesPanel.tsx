'use client';

import { Copy, Trash2 } from 'lucide-react';
import type { GridPropertiesSnapshot, SidebarPropertiesAction } from '@/features/properties/SidebarPropertiesStore.ts';
import { requestSidebarPropertiesAction } from '@/features/properties/SidebarPropertiesStore.ts';

const inputClass = 'bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500';

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

function CheckRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} className="accent-sky-500" />
      <span>{label}</span>
    </label>
  );
}

function action(type: SidebarPropertiesAction['type'], id: string, value?: string | boolean, end?: 'start' | 'end') {
  if (type === 'grid-name') requestSidebarPropertiesAction({ type, id, value: String(value ?? '') });
  else if (type === 'grid-bubble' || type === 'grid-elbow') requestSidebarPropertiesAction({ type, id, end: end ?? 'start', value: Boolean(value) });
  else if (type === 'grid-lock') requestSidebarPropertiesAction({ type, id, value: Boolean(value) });
  else if (type === 'grid-delete') requestSidebarPropertiesAction({ type, id });
}

export default function GridPropertiesPanel({ grid }: { grid: GridPropertiesSnapshot }) {
  const copyGuid = () => {
    if (grid.uniqueId) void navigator.clipboard?.writeText(grid.uniqueId);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="border-b border-slate-700 pb-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400"><span>🌐</span> Rejilla (Grid Datum)</span>
          <span className="rounded border border-sky-800 bg-sky-950 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">ID: {grid.elementId}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
          <span>GUID: <span className="text-slate-300">{grid.uniqueId ? `${grid.uniqueId.slice(0, 8)}...${grid.uniqueId.slice(-4)}` : grid.id}</span></span>
          <button type="button" onClick={copyGuid} className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700" title="Copiar GUID">
            <Copy aria-hidden="true" className="h-3 w-3" /> Copiar
          </button>
        </div>
      </div>

      <PropertySection title="Identificación y Familia">
        <div className="flex items-center justify-between">
          <label htmlFor="grid-name-input" className="text-slate-400">Nombre de Eje:</label>
          <input id="grid-name-input" type="text" value={grid.name} onChange={event => action('grid-name', grid.id, event.currentTarget.value)} className="w-20 rounded border border-sky-500/40 bg-slate-900 px-2 py-0.5 text-center text-xs font-bold text-sky-300 outline-none focus:border-sky-400" />
        </div>
        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Categoría:</span><span className="text-slate-200">Rejillas (OST_Grids)</span></div>
        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Familia:</span><span className="text-slate-200">{grid.family}</span></div>
      </PropertySection>

      <PropertySection title="Geometría">
        <div className="flex justify-between"><span className="text-slate-400">Tipo:</span><strong className="font-medium text-slate-200">{grid.geomType === 'line' ? 'Línea Recta' : 'Arco'}</strong></div>
        <div className="flex justify-between"><span className="text-slate-400">Longitud:</span><strong className="font-mono font-bold text-sky-400">{grid.length} m</strong></div>
        {grid.radius !== null && <div className="flex justify-between"><span className="text-slate-400">Radio de Curvatura:</span><strong className="font-mono font-bold text-emerald-400">{grid.radius.toFixed(2)} m</strong></div>}
      </PropertySection>

      <PropertySection title="Burbujas y Controles Revit">
        <CheckRow id="grid-prop-bubble-start" label="Mostrar Burbuja en Extremo Inicial (1)" checked={grid.showStartBubble} onChange={value => action('grid-bubble', grid.id, value, 'start')} />
        <CheckRow id="grid-prop-bubble-end" label="Mostrar Burbuja en Extremo Final (2)" checked={grid.showEndBubble} onChange={value => action('grid-bubble', grid.id, value, 'end')} />
        <CheckRow id="grid-prop-locked" label="Bloquear Alineación con Grupo (Revit Lock)" checked={grid.isLocked} onChange={value => action('grid-lock', grid.id, value)} />
      </PropertySection>

      <PropertySection title="Codos de Rejilla (Grid Elbow / Jog)">
        <CheckRow id="grid-prop-elbow-start" label="Activar Codo en Extremo Inicial" checked={grid.startElbowActive} onChange={value => action('grid-elbow', grid.id, value, 'start')} />
        <CheckRow id="grid-prop-elbow-end" label="Activar Codo en Extremo Final" checked={grid.endElbowActive} onChange={value => action('grid-elbow', grid.id, value, 'end')} />
      </PropertySection>

      <button id="btn-delete-grid-prop" type="button" onClick={() => action('grid-delete', grid.id)} className="mt-2 flex items-center justify-center gap-1 rounded-md border border-red-800 bg-red-950/50 px-2 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900">
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Eliminar Rejilla
      </button>
    </div>
  );
}
