'use client';

import { useSyncExternalStore } from 'react';
import { Box, Building2, FileSpreadsheet, Folder, Square } from 'lucide-react';
import type { BimCategory } from '@/core/database/BimDatabaseTypes';
import { projectBrowserStore, type ProjectBrowserView } from '@/features/project-browser/ProjectBrowserStore.ts';
import { requestOpenProjectSchedule, requestOpenProjectView } from '@/features/project-browser/ProjectBrowserBridge.ts';

const scheduleViews: { category: BimCategory | 'ALL'; title: string }[] = [
  { category: 'ALL', title: 'Cómputos Generales (Todo el Modelo)' },
  { category: 'OST_StructuralColumns', title: 'Cómputos - Pilares Estructurales' },
  { category: 'OST_StructuralFraming', title: 'Cómputos - Armazón (Vigas)' },
  { category: 'OST_StructuralFoundation', title: 'Cómputos - Cimentación (Zapatas)' },
  { category: 'OST_Floors', title: 'Cómputos - Suelos y Losas' },
];

const families = [
  'Zapata Aislada (2.0x2.0m)',
  'Columna Concreto (0.4x0.4m)',
  'Viga Peraltada (0.4x0.55m)',
  'Losa Concreto (e=0.20m)',
];

const treeItemClass = 'tree-item flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-400';

function ViewEntry({ view, activeViewId, title }: { view: ProjectBrowserView; activeViewId: string; title?: string }) {
  const active = view.id === activeViewId;
  const Icon = view.type === '3d' ? Box : view.type === 'plan' ? Square : Building2;
  return (
    <button
      type="button"
      className={`${treeItemClass} ${active ? 'border-l-2 border-sky-400 bg-sky-500/20 font-semibold text-sky-300' : ''}`}
      title={view.type === 'plan' ? `Doble clic para abrir: ${view.title}` : view.title}
      aria-current={active ? 'true' : undefined}
      data-open-view={view.id}
      onClick={() => requestOpenProjectView(view.id)}
    ><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{title || view.title}</span>
      {view.type === 'plan' && <span className="shrink-0 font-mono text-[10px] font-normal text-slate-400">{view.title.match(/\(([^)]+)\)/)?.[1] ?? ''}</span>}
    </button>
  );
}

export default function ProjectBrowser() {
  const { levels, views, activeViewId } = useSyncExternalStore(
    projectBrowserStore.subscribe,
    projectBrowserStore.getSnapshot,
    projectBrowserStore.getServerSnapshot
  );
  const threeDViews = views.filter(view => view.type === '3d');
  const planLevels = levels.filter(level => level.hasPlanView);
  const plans = planLevels.map(level => {
    const viewId = `plan-${level.id}`;
    const name = level.name.split('(')[0].trim();
    const sign = level.elevation >= 0 ? '+' : '';
    const elevation = `${sign}${level.elevation.toFixed(2)}m`;
    const view = views.find(candidate => candidate.id === viewId) ?? {
      id: viewId,
      title: `Planta - ${name} (${elevation})`,
      type: 'plan' as const,
    };
    return { view, title: `Planta - ${name}` };
  });
  const elevations = views.filter(view => view.type === 'elevation');

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="browser-heading-3d">
        <h2 id="browser-heading-3d" className="mb-1 text-[11px] font-bold uppercase text-slate-400">Vistas 3D</h2>
        <div id="browser-3d-list" role="group" aria-labelledby="browser-heading-3d" className="flex flex-col gap-0.5">
          {threeDViews.map(view => <ViewEntry key={view.id} view={view} activeViewId={activeViewId} />)}
        </div>
      </section>

      <section aria-labelledby="browser-heading-plans">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="browser-heading-plans" className="text-[11px] font-bold uppercase text-slate-400">Planos de Planta</h2>
          <span id="browser-plan-count" className="font-mono text-[10px] text-slate-500">{planLevels.length}</span>
        </div>
        <div id="browser-floor-plans-list" role="group" aria-labelledby="browser-heading-plans" className="flex flex-col gap-0.5">
          {plans.length ? plans.map(({ view, title }) => <ViewEntry key={view.id} view={view} activeViewId={activeViewId} title={title} />) : (
            <div className="select-none px-2 py-1 text-[11px] italic text-slate-500">(Sin planos generados)</div>
          )}
        </div>
      </section>

      <section aria-labelledby="browser-heading-elevations">
        <h2 id="browser-heading-elevations" className="mb-1 text-[11px] font-bold uppercase text-slate-400">Elevaciones</h2>
        <div id="browser-elevations-list" role="group" aria-labelledby="browser-heading-elevations" className="flex flex-col gap-0.5">
          {elevations.map(view => <ViewEntry key={view.id} view={view} activeViewId={activeViewId} />)}
        </div>
      </section>

      <section aria-labelledby="browser-heading-schedules">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="browser-heading-schedules" className="text-[11px] font-bold uppercase text-slate-400">Tablas de Planificación</h2>
          <span className="rounded border border-sky-800 bg-sky-950 px-1 py-0.5 font-mono text-[9px] text-sky-400">Revit</span>
        </div>
        <div id="browser-schedules-list" role="group" aria-labelledby="browser-heading-schedules" className="flex flex-col gap-0.5">
          {scheduleViews.map(({ category, title }) => (
            <button key={category} type="button" className={treeItemClass} data-open-schedule={category} onClick={() => requestOpenProjectSchedule(category)}>
              <FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{title}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="browser-heading-families">
        <h2 id="browser-heading-families" className="mb-1 text-[11px] font-bold uppercase text-slate-400">Familias de Concreto</h2>
        <div role="group" aria-labelledby="browser-heading-families" className="flex flex-col gap-0.5">
          {families.map(family => (
            <div key={family} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-400">
              <Folder aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{family}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
