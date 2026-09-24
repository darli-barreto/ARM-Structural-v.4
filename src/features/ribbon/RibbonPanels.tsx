'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import type { RibbonTabId } from './RibbonTabs';
import { ribbonToolStore } from '@/features/ribbon/RibbonToolStore.ts';
import { ribbonLevelStore } from '@/features/ribbon/RibbonLevelStore.ts';
import { requestRibbonAction } from '@/features/ribbon/RibbonActionsBridge.ts';
import type { ToolType } from '@/config/structural.config';
import { requestProjectAction } from '@/features/project/ProjectToolsBridge.ts';

const controlClass =
  'ribbon-btn flex h-[58px] min-w-[58px] flex-col items-center justify-center gap-0.5 border border-transparent px-2 py-1 text-[11px] font-medium text-slate-200 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200 disabled:cursor-default disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent';
const selectClass =
  'border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-sky-600';
const activeToolClass =
  'ribbon-btn flex h-[58px] min-w-[58px] flex-col items-center justify-center gap-0.5 border border-sky-500 bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm';

export function toolButtonClass(id: string, activeTool: string, className = controlClass) {
  if (!id.startsWith('tool-')) return className;
  return activeTool === id.slice('tool-'.length) ? activeToolClass : controlClass;
}

function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="tool-group relative flex h-full items-center gap-1 border-r border-slate-300 px-2 pb-3.5">
      {children}
      <div className="tool-group-label pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase text-slate-500">
        {label}
      </div>
    </div>
  );
}

function ToolButton({
  id,
  title,
  label,
  icon,
  className = controlClass,
  activeTool,
  onClick,
  disabled = false,
}: {
  id: string;
  title: string;
  label: string;
  icon: ReactNode;
  className?: string;
  activeTool?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const classes = toolButtonClass(id, activeTool ?? '', className);
  return (
    <button id={id} type="button" className={classes} title={title} disabled={disabled} onClick={onClick}>
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function RibbonPanels({ active }: { active: RibbonTabId }) {
  const activeTool = useSyncExternalStore(ribbonToolStore.subscribe, ribbonToolStore.getSnapshot, ribbonToolStore.getServerSnapshot);
  const levels = useSyncExternalStore(ribbonLevelStore.subscribe, ribbonLevelStore.getSnapshot, ribbonLevelStore.getServerSnapshot);
  return (
    <div className="ribbon-panels-container flex h-20 items-center gap-2 overflow-x-auto border-b border-slate-300 bg-slate-50 px-2 py-1">
      <div id="panel-structure" role="tabpanel" aria-labelledby="ribbon-tab-structure" hidden={active !== 'structure'} className={`ribbon-panel gap-2 h-full items-center ${active === 'structure' ? 'flex' : 'hidden'}`}>
        <Group label="Selección">
          <ToolButton id="tool-select" title="Herramienta de Selección (Esc)" label="Modificar" icon="👆" activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'select' })} />
        </Group>
        <Group label="Datum">
          <ToolButton id="tool-grid" title="Rejilla / Ejes (GR)" label="Rejilla" icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="8" y1="2" x2="8" y2="22" strokeDasharray="2 2" />
              <line x1="16" y1="2" x2="16" y2="22" strokeDasharray="2 2" />
              <line x1="2" y1="8" x2="22" y2="8" strokeDasharray="2 2" />
              <line x1="2" y1="16" x2="22" y2="16" strokeDasharray="2 2" />
              <circle cx="8" cy="4" r="2.5" fill="#fff" stroke="#0284c7" strokeWidth="2" />
              <circle cx="16" cy="4" r="2.5" fill="#fff" stroke="#0284c7" strokeWidth="2" />
              <circle cx="4" cy="8" r="2.5" fill="#fff" stroke="#0284c7" strokeWidth="2" />
              <circle cx="4" cy="16" r="2.5" fill="#fff" stroke="#0284c7" strokeWidth="2" />
            </svg>
          } activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'grid' })} />
          <ToolButton id="tool-level" title="Nivel / Alturas de Planta (LL)" label="Nivel" icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="2" y1="12" x2="15" y2="12" strokeDasharray="2 2" />
              <circle cx="18" cy="12" r="4.2" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
              <path d="M18 7.8 A4.2 4.2 0 0 1 22.2 12 L18 12 Z" fill="#fff" />
              <path d="M18 12 L13.8 12 A4.2 4.2 0 0 1 18 16.2 Z" fill="#fff" />
            </svg>
          } activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'level' })} />
        </Group>
        <Group label="Cimientos">
          <ToolButton id="tool-zapata" title="Zapata Aislada" label="Zapata" icon="🧱" activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'zapata' })} />
        </Group>
        <Group label="Pórticos">
          <ToolButton id="tool-columna" title="Columna Estructural" label="Columna" icon="🏛️" activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'columna' })} />
          <ToolButton id="tool-viga" title="Viga de Pórtico" label="Viga" icon="📏" activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'viga' })} />
          <ToolButton id="tool-techo" title="Losa / Techo de Entrepiso" label="Losa" icon="🏠" activeTool={activeTool} onClick={() => requestRibbonAction({ type: 'tool', tool: 'techo' })} />
        </Group>
        <Group label="Generación">
          <ToolButton id="btn-at-grid" title="Colocar en intersecciones de ejes" label="At Grid" icon="🎯" className={`${controlClass} bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25`} onClick={() => requestRibbonAction({ type: 'at-grid' })} />
          <ToolButton id="btn-full-building" title="Modelos de ejemplo y referencias de calculo" label="Ejemplos" icon="🏢" className={`${controlClass} bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25`} onClick={() => requestRibbonAction({ type: 'examples' })} />
        </Group>
        <Group label="Plano">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="ribbon-level-select" className="text-[10px] font-semibold uppercase text-slate-500">Nivel de Trabajo:</label>
            <select id="ribbon-level-select" className={selectClass} value={levels.selectedIndex} disabled={levels.disabled} onChange={event => requestRibbonAction({ type: 'level', levelIdx: Number(event.currentTarget.value) })}>
              {levels.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </Group>
        <Group label="BIM Data">
          <ToolButton id="btn-open-schedule" title="Tablas de Planificación y Cómputos Métricos (Revit Schedule)" label="Tablas" icon="📊" className={`${controlClass} text-sky-300 border-sky-500/40 bg-sky-950/30 hover:bg-sky-900/50`} onClick={() => requestRibbonAction({ type: 'open-schedule' })} />
          <ToolButton id="btn-select-by-id" title="Seleccionar por ID o UniqueId GUID (Revit Select by ID)" label="Select ID" icon="🔍" onClick={() => requestRibbonAction({ type: 'select-by-id' })} />
        </Group>
      </div>

      <div id="panel-view" role="tabpanel" aria-labelledby="ribbon-tab-view" hidden={active !== 'view'} className={`ribbon-panel gap-2 h-full items-center ${active === 'view' ? 'flex' : 'hidden'}`}>
        <Group label="Gráficos">
          <ToolButton id="btn-toggle-grid" title="Alternar visibilidad de grillas" label="Grillas" icon="▦" onClick={() => requestRibbonAction({ type: 'toggle-grids' })} />
        </Group>
        <Group label="Ventanas"><ToolButton id="btn-close-inactive-ribbon" title="Cerrar vistas inactivas desde la barra de título" label="Vistas" icon="▣" disabled /></Group>
      </div>

      <div id="panel-design" role="tabpanel" aria-labelledby="ribbon-tab-design" hidden={active !== 'design'} className={`ribbon-panel h-full items-center gap-2 ${active === 'design' ? 'flex' : 'hidden'}`}>
        <Group label="Normativa"><ToolButton id="project-normative" title="Perfil normativo peruano RNE" label="RNE Perú" icon="§" onClick={() => requestProjectAction('normative')} /></Group>
        <Group label="Diseño"><ToolButton id="design-rebar" title="Herramientas de diseño de armadura" label="Armadura" icon="≋" disabled /></Group>
      </div>

      <div id="panel-analysis" role="tabpanel" aria-labelledby="ribbon-tab-analysis" hidden={active !== 'analysis'} className={`ribbon-panel h-full items-center gap-2 ${active === 'analysis' ? 'flex' : 'hidden'}`}>
        <Group label="Modelo analítico"><ToolButton id="project-analysis" title="Abrir modelo y configuración analítica" label="Análisis" icon="∑" onClick={() => requestProjectAction('analysis')} /></Group>
        <Group label="Resultados"><ToolButton id="analysis-results" title="Resultados y diagramas" label="Resultados" icon="⌁" disabled /></Group>
      </div>

      <div id="panel-reports" role="tabpanel" aria-labelledby="ribbon-tab-reports" hidden={active !== 'reports'} className={`ribbon-panel h-full items-center gap-2 ${active === 'reports' ? 'flex' : 'hidden'}`}>
        <Group label="Cómputos"><ToolButton id="btn-open-schedule-view" title="Abrir tabla de planificación y metrados" label="Tablas" icon="▤" onClick={() => requestRibbonAction({ type: 'open-schedule' })} /></Group>
        <Group label="Exportar"><ToolButton id="btn-export-csv-report" title="Exportar cómputos a CSV" label="CSV" icon="⇩" onClick={() => requestRibbonAction({ type: 'export-csv' })} /><ToolButton id="btn-export-json-report" title="Exportar modelo JSON" label="JSON" icon="{}" onClick={() => requestRibbonAction({ type: 'export-json' })} /></Group>
      </div>

      <div id="panel-manage" role="tabpanel" aria-labelledby="ribbon-tab-manage" hidden={active !== 'manage'} className={`ribbon-panel gap-2 h-full items-center ${active === 'manage' ? 'flex' : 'hidden'}`}>
        <Group label="Modelo"><ToolButton id="btn-clear" title="Limpiar todos los elementos" label="Limpiar" icon="🗑️" onClick={() => requestRibbonAction({ type: 'clear' })} /></Group>
        <Group label="Base de Datos">
          <ToolButton id="btn-open-mongo-inspector" title="Inspeccionar Esquema MongoDB / BSON y ejecutar mongoimport" label="MongoDB" icon="🍃" className={`${controlClass} text-emerald-300 border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60`} onClick={() => requestRibbonAction({ type: 'open-mongo-inspector' })} />
          <ToolButton id="btn-export-csv-direct" title="Exportar Cómputos a CSV / Excel" label="CSV Excel" icon="📥" onClick={() => requestRibbonAction({ type: 'export-csv' })} />
          <ToolButton id="btn-export-json-direct" title="Descargar Dump BSON/JSON de la BD BIM" label="Dump JSON" icon="💾" onClick={() => requestRibbonAction({ type: 'export-json' })} />
        </Group>
      </div>

      {([
        ['architecture', 'Edificación', 'Muro', '▥'],
        ['systems', 'Instalaciones', 'Sistema', '⌁'],
        ['concrete', 'Concreto', 'Elemento', '▰'],
        ['steel', 'Acero', 'Perfil', '工'],
        ['topography', 'Terreno', 'Superficie', '⌁'],
        ['collaboration', 'Coordinación', 'Sincronizar', '↻'],
        ['insert', 'Vincular', 'Insertar', '+'],
        ['annotate', 'Anotación', 'Cota', '↔'],
      ] as const).map(([id, group, label, icon]) => <div key={id} id={`panel-${id}`} role="tabpanel" aria-labelledby={`ribbon-tab-${id}`} hidden={active !== id} className={`ribbon-panel h-full items-center gap-2 ${active === id ? 'flex' : 'hidden'}`}><Group label={group}><ToolButton id={`${id}-placeholder`} title={`${label} (próximamente)`} label={label} icon={icon} disabled /></Group></div>)}
    </div>
  );
}
