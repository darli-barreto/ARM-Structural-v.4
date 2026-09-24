'use client';

import { useEffect, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { LevelPropertiesSnapshot } from '@/features/properties/SidebarPropertiesStore.ts';
import { requestSidebarPropertiesAction } from '@/features/properties/SidebarPropertiesStore.ts';

function CheckRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} className="accent-sky-500" />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-950/70 p-2 text-xs text-slate-300">{children}</div>
    </section>
  );
}

export default function LevelPropertiesPanel({ level }: { level: LevelPropertiesSnapshot }) {
  const [name, setName] = useState(level.shortName);
  const [elevation, setElevation] = useState(level.elevation.toFixed(2));

  useEffect(() => {
    setName(level.shortName);
    setElevation(level.elevation.toFixed(2));
  }, [level.id, level.shortName, level.elevation]);

  const copyGuid = () => {
    if (level.uniqueId) void navigator.clipboard?.writeText(level.uniqueId);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="border-b border-sky-500/30 pb-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-sky-400">📐 Nivel BIM (Level Datum)</span>
            <span className="rounded border border-sky-800 bg-sky-950 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">{level.formattedElevation}</span>
          </div>
          <span className="rounded border border-sky-800 bg-sky-950 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">ID: {level.elementId}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
          <span>GUID: <span className="text-slate-300">{level.uniqueId ? `${level.uniqueId.slice(0, 8)}...${level.uniqueId.slice(-4)}` : level.id}</span></span>
          <button type="button" onClick={copyGuid} className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700" title="Copiar GUID">
            <Copy aria-hidden="true" className="h-3 w-3" /> Copiar
          </button>
        </div>
      </div>

      <Section title="Identidad y Familia">
        <div className="flex items-center justify-between">
          <label htmlFor="lvl-name-input" className="text-slate-400">Nombre de Nivel:</label>
          <input id="lvl-name-input" type="text" value={name} onChange={event => setName(event.currentTarget.value)} onBlur={() => requestSidebarPropertiesAction({ type: 'level-name', id: level.id, value: name })} className="w-28 rounded border border-sky-500/40 bg-slate-900 px-2 py-0.5 text-center text-xs font-bold text-slate-100 outline-none focus:border-sky-400" />
        </div>
        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Categoría:</span><span className="text-slate-200">Niveles (OST_Levels)</span></div>
        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Familia:</span><span className="text-slate-200">{level.family}</span></div>
      </Section>

      <Section title="Cota y Elevación Global">
        <div className="flex items-center justify-between">
          <label htmlFor="lvl-elev-input" className="text-slate-400">Cota Global (Y):</label>
          <div className="flex items-center gap-1">
            <input id="lvl-elev-input" type="number" step="0.1" value={elevation} onChange={event => setElevation(event.currentTarget.value)} onBlur={() => requestSidebarPropertiesAction({ type: 'level-elevation', id: level.id, value: elevation })} className="w-20 rounded border border-sky-500/40 bg-slate-900 px-2 py-0.5 text-center font-mono text-xs font-bold text-sky-400 outline-none focus:border-sky-400" />
            <span className="text-xs text-slate-400">m</span>
          </div>
        </div>
        <div className="flex justify-between"><span className="text-slate-400">Vista de Plano:</span><strong className={`font-medium ${level.hasPlanView ? 'text-sky-400' : 'text-slate-500'}`}>{level.hasPlanView ? 'Asociada (Cabezal Azul)' : 'Sin Vista (Cabezal Gris)'}</strong></div>
      </Section>

      <Section title="Cabezales y Controles Revit">
        <CheckRow id="lvl-prop-bubble-start" label="Mostrar Cabezal en Extremo Inicial" checked={level.showStartBubble} onChange={value => requestSidebarPropertiesAction({ type: 'level-bubble', id: level.id, end: 'start', value })} />
        <CheckRow id="lvl-prop-bubble-end" label="Mostrar Cabezal en Extremo Final" checked={level.showEndBubble} onChange={value => requestSidebarPropertiesAction({ type: 'level-bubble', id: level.id, end: 'end', value })} />
        <CheckRow id="lvl-prop-locked" label="Bloquear Alineación con Grupo (Revit Lock)" checked={level.isLocked} onChange={value => requestSidebarPropertiesAction({ type: 'level-lock', id: level.id, value })} />
      </Section>

      <Section title="Codo / Quiebre (Level Elbow)">
        <CheckRow id="lvl-prop-elbow-end" label="Quiebre de Hombro en Extremo Derecho" checked={level.endElbowActive} onChange={value => requestSidebarPropertiesAction({ type: 'level-elbow', id: level.id, end: 'end', value })} />
        <CheckRow id="lvl-prop-elbow-start" label="Quiebre de Hombro en Extremo Izquierdo" checked={level.startElbowActive} onChange={value => requestSidebarPropertiesAction({ type: 'level-elbow', id: level.id, end: 'start', value })} />
      </Section>

      <button id="btn-delete-lvl-prop" type="button" onClick={() => requestSidebarPropertiesAction({ type: 'level-delete', id: level.id })} className="flex w-full items-center justify-center gap-1.5 rounded border border-red-800/80 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900">
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Eliminar Nivel
      </button>
    </div>
  );
}
