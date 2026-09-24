'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { AlignHorizontalJustifyCenter, Copy, Grid2X2, Pencil, Trash2, X } from 'lucide-react';
import type { GridDrawMode, ToolType } from '@/config/structural.config';
import { LEVEL_TEMPLATES, LevelQuickGenerator } from '@/core/level/generator/LevelQuickGenerator';
import type { QuickGenerateLevelConfig, LevelDrawMode, LevelTemplateType } from '@/core/level/types/LevelTypes';
import { contextualSubheaderStore } from '@/features/datum/ContextualSubheaderStore.ts';
import DualModelToolbar from '@/features/dual-model/DualModelToolbar.tsx';

const baseClass = 'flex shrink-0 items-center gap-1.5 border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';
const greenClass = `${baseClass} border-emerald-300 text-emerald-950 hover:bg-emerald-50`;
const primaryClass = 'flex shrink-0 items-center gap-1.5 border border-emerald-800 bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-800';
const cancelClass = 'flex shrink-0 items-center gap-1 border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100';
const groupClass = 'flex shrink-0 items-center gap-1';
const dividerClass = 'h-5 w-px shrink-0 bg-emerald-300';
const segmentedClass = 'border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs text-emerald-950 transition-colors hover:bg-emerald-200';
const selectedSegmentClass = 'border border-emerald-800 bg-emerald-700 px-2 py-1 text-xs font-semibold text-white';
const fieldClass = 'h-7 min-w-0 border border-emerald-400 bg-white px-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600';

const gridModes: { value: GridDrawMode; label: string; title: string }[] = [
  { value: 'line', label: 'Línea', title: 'Línea recta (individual o cadena)' },
  { value: 'arc_start_end_radius', label: 'Arco I-F-R', title: 'Arco por inicio, fin y radio (3 clics)' },
  { value: 'arc_center_ends', label: 'Arco Centro', title: 'Arco por centro y puntos finales' },
  { value: 'pick_lines', label: 'Pick Lines', title: 'Seleccionar líneas / bordes estructurales' },
];
const levelModes: { value: LevelDrawMode; label: string }[] = [
  { value: 'line', label: 'Línea (2 clics)' },
  { value: 'pick_lines', label: 'Pick Line' },
];

export default function ContextualSubheader() {
  const state = useSyncExternalStore(contextualSubheaderStore.subscribe, contextualSubheaderStore.getSnapshot, contextualSubheaderStore.getServerSnapshot);
  const commands = contextualSubheaderStore.getCommands();
  const mode = state.mode;
  const toolTitles: Partial<Record<ToolType, string>> = {
    zapata: 'Modificar | Colocar Zapata Aislada (2.0x2.0m)',
    columna: 'Modificar | Colocar Columna de Concreto (0.40x0.40m)',
    viga: 'Modificar | Colocar Viga de Pórtico (0.40x0.55m)',
    techo: 'Modificar | Colocar Losa de Entrepiso (e=0.20m)',
  };
  const element = state.element;
  const isColumn = element?.type === 'column';
  const isSlab = element?.type === 'slab';
  const isSlanted = element?.definition.type === 'column' && element.definition.columnStyle === 'slanted';

  const selectClass = (active: boolean) => active ? selectedSegmentClass : segmentedClass;
  const input = (id: string, label: string, value: string, onChange: (value: string) => void, width = 'w-16', props: { min?: number; step?: number; max?: number } = {}) => <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-950" htmlFor={id}>
    {label}<input id={id} className={`${fieldClass} ${width}`} type="number" value={value} min={props.min} max={props.max} step={props.step ?? 'any'} onChange={event => onChange(event.currentTarget.value)} />
  </label>;
  const badge = (title: string, tone = 'bg-emerald-800') => <div className={`flex shrink-0 items-center gap-1.5 ${tone} px-2.5 py-1 text-[11px] font-bold text-white`}><span className="text-emerald-300">●</span><span>{title}</span></div>;
  const level = <div className="flex shrink-0 items-center gap-1.5 text-[11px]"><span className="font-semibold text-emerald-900">Nivel Activo:</span><strong className="font-bold text-emerald-950">{state.levelName}</strong></div>;
  const cancelButton = (onClick: () => void, label = 'Finalizar (Esc)') => <button type="button" className={cancelClass} onClick={onClick}><X aria-hidden="true" size={14} />{label}</button>;

  return <>
    <div id="contextual-subbar" className="z-40 flex h-9 shrink-0 select-none items-center gap-2 overflow-x-auto border-b border-slate-300 bg-slate-50 px-2 text-xs text-emerald-950 shadow-xs">
      {mode === 'general' && <>
        <DualModelToolbar />
      </>}

      {mode === 'grid' && <>
        {badge('Modificar | Colocar Rejilla (Grid)')}
        <div className={dividerClass} />
        <div className={groupClass}><span className="font-semibold text-emerald-900">Dibujar:</span><div className="flex shrink-0">
          {gridModes.map(item => <button key={item.value} type="button" className={selectClass(state.gridDrawMode === item.value)} title={item.title} onClick={() => commands?.updateGridDrawMode(item.value)}>{item.label}</button>)}
        </div></div>
        <div className={dividerClass} />
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1 font-semibold text-emerald-900" htmlFor="grid-chain-checkbox"><input id="grid-chain-checkbox" type="checkbox" checked={state.gridChain} onChange={event => commands?.updateGridChain(event.currentTarget.checked)} />Cadena</label>
          {input('grid-offset-input', 'Desfase:', state.gridOffsetInput, value => commands?.updateGridOffset(value), 'w-16', { min: 0, step: 0.5 })}<span className="-ml-1 text-[11px] font-semibold text-emerald-700">m</span>
          {input('grid-radius-input', 'Radio:', state.gridRadiusInput, value => commands?.updateGridRadius(value), 'w-14', { min: 0, step: 0.5 })}<span className="-ml-1 text-[11px] font-semibold text-emerald-700">m</span>
        </div>
        <div className={dividerClass} />
        <div className={groupClass}>
          <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-900" htmlFor="grid-template-select">Plantilla:
            <select id="grid-template-select" className={fieldClass} value={state.gridTemplate} onChange={event => commands?.updateGridTemplate(event.currentTarget.value as '5x5' | '4x4' | '6x6')}>
              <option value="5x5">5x5 (6m)</option><option value="4x4">4x4 (6m)</option><option value="6x6">6x6 (5m)</option>
            </select>
          </label>
          {input('h-spacing-input', 'H:', state.gridSpacingX, value => commands?.updateGridSpacing('x', value), 'w-12', { min: 1 })}
          {input('v-spacing-input', 'V:', state.gridSpacingZ, value => commands?.updateGridSpacing('z', value), 'w-12', { min: 1 })}
          <button id="btn-quick-generate" type="button" className={primaryClass} title="Generar rejilla ortogonal con las separaciones" onClick={() => commands?.applyGridTemplate()}>Generar rejilla</button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2"><span className="text-[11px] italic text-emerald-800">Esc para cancelar</span>{cancelButton(() => commands?.cancel())}</div>
      </>}

      {mode === 'level' && <>
        {badge('Modificar | Colocar Nivel (Level - LL)')}
        <div className={dividerClass} />
        <div className={groupClass}><span className="font-semibold text-emerald-900">Dibujar:</span><div className="flex shrink-0">
          {levelModes.map(item => <button key={item.value} type="button" className={selectClass(state.levelDrawMode === item.value)} title={item.value === 'line' ? 'Línea horizontal por 2 puntos en vistas de alzado' : 'Seleccionar nivel existente para aplicar desfase'} onClick={() => commands?.updateLevelDrawMode(item.value)}>{item.label}</button>)}
        </div></div>
        <div className={dividerClass} />
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1 font-semibold text-emerald-900" title="Crear automáticamente una vista de plano de planta" htmlFor="level-make-plan-checkbox"><input id="level-make-plan-checkbox" type="checkbox" checked={state.levelMakePlanView} onChange={event => commands?.updateLevelMakePlanView(event.currentTarget.checked)} />Crear vista de plano</label>
          {input('level-offset-input', 'Desfase:', state.levelOffsetInput, value => commands?.updateLevelOffset(value), 'w-16', { step: 0.5 })}<span className="-ml-1 text-[11px] font-semibold text-emerald-700">m</span>
        </div>
        <div className={dividerClass} />
        <div className={groupClass}>
          <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-900" htmlFor="level-template-select">Plantilla:
            <select id="level-template-select" className={fieldClass} value={state.levelTemplate} onChange={event => commands?.updateLevelTemplate(event.currentTarget.value as LevelTemplateType)}>
              <option value="residential">Residencial (1S + PB + 4P)</option><option value="commercial">Comercial (2S + Lobby + 8P)</option><option value="house_2lvl">Vivienda (PB + PA)</option><option value="tower_10">Torre (2S + PB + 10P)</option>
            </select>
          </label>
          <button id="btn-apply-level-template" type="button" className={greenClass} title="Aplicar plantilla predeterminada" onClick={() => commands?.applyLevelTemplate()}>Aplicar</button>
          <button id="btn-quick-generate-levels" type="button" className={primaryClass} title="Abrir asistente de generación de niveles" onClick={() => commands?.openQuickLevelModal()}>Generar niveles…</button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2"><span className="text-[11px] italic text-emerald-800">Usa vistas de alzado · Esc para finalizar</span>{cancelButton(() => commands?.cancel())}</div>
      </>}

      {mode === 'structural' && <>
        {badge(toolTitles[state.tool] ?? 'Colocar Elemento')}
        <div className={dividerClass} />{level}<div className={dividerClass} />
        <button id="btn-ctx-at-grid" type="button" className={primaryClass} onClick={() => commands?.atGrid()}>Colocar en todas las Grillas</button>
        <div className="ml-auto flex shrink-0 items-center gap-2"><span className="text-[11px] italic text-emerald-800">Previsualización activa · Clic para colocar</span>{cancelButton(() => commands?.cancel())}</div>
      </>}

      {mode === 'selected' && element && <>
        {badge(`Modificar | ${({ footing: 'Cimentación Estructural (Zapata)', column: 'Pilares Estructurales (Columna)', beam: 'Armazón Estructural (Viga)', slab: 'Suelos / Losas de Entrepiso' } as const)[element.type]} (${element.id})`, 'bg-sky-800')}
        <div className={dividerClass} />
        <button id="btn-ctx-align" type="button" className={baseClass} title="Alinear elemento con referencia de rejilla, nivel o arista (AL)" onClick={() => commands?.startAlign()}><AlignHorizontalJustifyCenter aria-hidden="true" size={14} />Alinear <kbd className="border border-slate-200 bg-slate-100 px-1 text-[10px] text-slate-500">AL</kbd></button>
        <button id="btn-ctx-array" type="button" className={baseClass} title="Crear matriz lineal o radial de elementos (AR)" onClick={() => commands?.startArray()}><Copy aria-hidden="true" size={14} />Matriz <kbd className="border border-slate-200 bg-slate-100 px-1 text-[10px] text-slate-500">AR</kbd></button>
        {isColumn && <button id="btn-ctx-col-style" type="button" className={greenClass} title="Alternar columna vertical o inclinada en 3D" onClick={() => commands?.toggleColumnStyle()}>Modo: <strong className={isSlanted ? 'text-amber-600' : 'text-sky-700'}>{isSlanted ? 'Inclinada 3D' : 'Vertical'}</strong></button>}
        <button id="btn-ctx-sketch" type="button" className={greenClass} title="Editar contorno de boceto libre" onClick={() => commands?.startSketch()}><Pencil aria-hidden="true" size={14} />{isSlab ? 'Editar contorno' : 'Editar geometría'}</button>
        {isSlab && <button id="btn-ctx-add-void" type="button" className={`${baseClass} border-amber-300 text-amber-900 hover:bg-amber-50`} title="Añadir perforación o shaft interior" onClick={() => commands?.addVoidSketch()}>Añadir Hueco</button>}
        <div className={dividerClass} />
        <button id="btn-ctx-delete" type="button" className={cancelClass} title="Eliminar elemento (Supr)" onClick={() => commands?.deleteSelected()}><Trash2 aria-hidden="true" size={14} />Suprimir</button>
        <button type="button" className={baseClass} title="Deseleccionar (Esc)" onClick={() => commands?.clearSelection()}><X aria-hidden="true" size={14} />Salir</button>
        <span className="ml-auto shrink-0 border border-emerald-300 bg-emerald-100 px-2 py-1 font-mono text-[11px] text-emerald-950">{element.dimensions}</span>
      </>}

      {mode === 'align' && <>
        {badge('Modificar | Alinear (AL)', 'bg-pink-800')}
        <div className={dividerClass} /><span className="shrink-0 font-semibold text-emerald-950">{state.alignStep}</span><div className={dividerClass} />
        {cancelButton(() => commands?.cancelAlign(), 'Cancelar (Esc)')}
        <span className="ml-auto shrink-0 text-[11px] italic text-emerald-800">Selecciona una rejilla, nivel o arista y luego el elemento</span>
      </>}

      {mode === 'array' && element && <>
        {badge(`Modificar | Matriz (AR) - ${element.id}`, 'bg-indigo-800')}
        <div className={dividerClass} />
        <div className={groupClass}><span className="font-semibold">Tipo:</span><button type="button" className={selectClass(state.arrayType === 'linear')} onClick={() => commands?.updateArrayType('linear')}>Lineal</button><button type="button" className={selectClass(state.arrayType === 'radial')} onClick={() => commands?.updateArrayType('radial')}>Radial</button></div>
        <div className={dividerClass} />
        {input('ctx-arr-count', 'Número:', state.arrayCount, value => commands?.updateArrayCount(value), 'w-14', { min: 2, max: 50, step: 1 })}
        <div className={dividerClass} />
        <div className={groupClass}><span className="font-semibold">Mover a:</span><button type="button" className={selectClass(state.arraySpacing === 'second')} onClick={() => commands?.updateArraySpacing('second')}>2º elemento</button><button type="button" className={selectClass(state.arraySpacing === 'last')} onClick={() => commands?.updateArraySpacing('last')}>Último</button></div>
        <div className={dividerClass} />
        {state.arrayType === 'radial' ? <>{input('ctx-arr-angle', 'Ángulo total:', state.arrayAngle, value => commands?.updateArrayAngle(value), 'w-16', { step: 15 })}<span className="-ml-1">°</span></> : <>{input('ctx-arr-dist-x', 'Distancia Bay X:', state.arrayDeltaX, value => commands?.updateArrayDeltaX(value), 'w-16', { step: 0.5 })}<span className="-ml-1">m</span></>}
        <div className={dividerClass} />
        <button id="btn-ctx-exec-array" type="button" className={primaryClass} onClick={() => commands?.executeArray()}>Ejecutar Matriz</button>
        {cancelButton(() => commands?.cancelArray(), 'Cancelar')}
      </>}
    </div>
    {state.quickLevelModalOpen && <QuickLevelModal template={state.levelTemplate} onClose={() => commands?.closeQuickLevelModal()} onGenerate={config => commands?.generateQuickLevels(config)} />}
  </>;
}

type QuickLevelForm = Omit<QuickGenerateLevelConfig, 'baseElevation' | 'basementCount' | 'basementHeight' | 'groundFloorHeight' | 'upperFloorCount' | 'upperFloorHeight'> & {
  baseElevation: string;
  basementCount: string;
  basementHeight: string;
  groundFloorHeight: string;
  upperFloorCount: string;
  upperFloorHeight: string;
};

function asQuickLevelForm(config: QuickGenerateLevelConfig): QuickLevelForm {
  return { ...config, baseElevation: String(config.baseElevation), basementCount: String(config.basementCount), basementHeight: String(config.basementHeight), groundFloorHeight: String(config.groundFloorHeight), upperFloorCount: String(config.upperFloorCount), upperFloorHeight: String(config.upperFloorHeight) };
}

function QuickLevelModal({ template, onClose, onGenerate }: { template: LevelTemplateType; onClose: () => void; onGenerate: (config: QuickGenerateLevelConfig) => void }) {
  const [form, setForm] = useState(() => asQuickLevelForm(LEVEL_TEMPLATES[template].config));
  const update = <K extends keyof QuickLevelForm>(key: K, value: QuickLevelForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const numeric = (id: string, label: string, key: 'baseElevation' | 'basementCount' | 'basementHeight' | 'groundFloorHeight' | 'upperFloorCount' | 'upperFloorHeight', props: { min?: number; max?: number; step?: number; wide?: boolean } = {}) => <label className={`flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-300${props.wide ? ' col-span-2' : ''}`} htmlFor={id}>{label}<input id={id} className="h-8 min-w-0 border border-white/15 bg-slate-950 px-2 font-mono text-white outline-none focus:border-emerald-400" type="number" value={form[key]} min={props.min} max={props.max} step={props.step ?? 'any'} onChange={event => update(key, event.currentTarget.value)} /></label>;
  const config: QuickGenerateLevelConfig = {
    ...form,
    baseElevation: Number(form.baseElevation),
    basementCount: Number(form.basementCount),
    basementHeight: Number(form.basementHeight),
    groundFloorHeight: Number(form.groundFloorHeight),
    upperFloorCount: Number(form.upperFloorCount),
    upperFloorHeight: Number(form.upperFloorHeight),
  };
  const totalLevels = config.basementCount + 1 + config.upperFloorCount;
  const minElevation = config.baseElevation - config.basementCount * config.basementHeight;
  const maxElevation = config.baseElevation + config.groundFloorHeight + (config.upperFloorCount - 1) * config.upperFloorHeight;

  function applyPreset(key: LevelTemplateType) {
    setForm(asQuickLevelForm(LEVEL_TEMPLATES[key].config));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate({ ...config, namingPattern: 'standard' });
  }

  return <div id="modal-quick-levels" className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-black/75 p-4 backdrop-blur-xs" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden border border-emerald-500/40 bg-slate-900 text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="quick-levels-heading" onSubmit={submit}>
      <header className="flex items-center justify-between border-b border-emerald-500/30 bg-slate-950 px-5 py-3.5">
        <div><h2 id="quick-levels-heading" className="text-sm font-bold text-emerald-400">Generar niveles</h2><p className="text-[11px] text-slate-400">Parámetros de sótanos, planta base y pisos superiores</p></div>
        <button id="modal-ql-close" type="button" className="border border-white/15 p-1 text-slate-300 hover:bg-white/10" title="Cerrar" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-2" aria-label="Plantillas de niveles">{(['residential', 'commercial', 'house_2lvl', 'tower_10'] as const).map(key => <button key={key} type="button" className={`${baseClass} border-white/15 bg-slate-800 text-slate-100 hover:bg-slate-700`} data-preset={key} onClick={() => applyPreset(key)}>{LEVEL_TEMPLATES[key].name}</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          {numeric('ql-base-elev', 'Cota nivel base (0.00)', 'baseElevation', { step: 0.5 })}
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-300" htmlFor="ql-ground-name">Nombre nivel base<input id="ql-ground-name" className="h-8 min-w-0 border border-white/15 bg-slate-950 px-2 text-white outline-none focus:border-emerald-400" value={form.groundFloorName} onChange={event => update('groundFloorName', event.currentTarget.value)} /></label>
          {numeric('ql-basement-count', 'Número de sótanos', 'basementCount', { min: 0, max: 10, step: 1 })}
          {numeric('ql-basement-height', 'Altura típica sótano (m)', 'basementHeight', { min: 1, max: 10, step: 0.1 })}
          {numeric('ql-ground-height', 'Altura planta base (m)', 'groundFloorHeight', { min: 2, max: 12, step: 0.1, wide: true })}
          {numeric('ql-upper-count', 'Niveles superiores', 'upperFloorCount', { min: 1, max: 50, step: 1 })}
          {numeric('ql-upper-height', 'Altura típica de entrepiso (m)', 'upperFloorHeight', { min: 1.5, max: 10, step: 0.1 })}
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-300" htmlFor="ql-prefix-upper">Prefijo pisos superiores<input id="ql-prefix-upper" className="h-8 min-w-0 border border-white/15 bg-slate-950 px-2 text-white outline-none focus:border-emerald-400" value={form.prefixUpper} onChange={event => update('prefixUpper', event.currentTarget.value)} /></label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-300" htmlFor="ql-prefix-basement">Prefijo sótanos<input id="ql-prefix-basement" className="h-8 min-w-0 border border-white/15 bg-slate-950 px-2 text-white outline-none focus:border-emerald-400" value={form.prefixBasement} onChange={event => update('prefixBasement', event.currentTarget.value)} /></label>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300" htmlFor="ql-create-views"><input id="ql-create-views" type="checkbox" checked={form.createPlanViews} onChange={event => update('createPlanViews', event.currentTarget.checked)} />Crear vistas de planta asociadas</label>
        <div id="ql-summary-box" className="border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">
          <div className="flex items-center justify-between font-bold text-emerald-300"><span>Resumen calculado</span><span id="ql-total-levels" className="font-mono">{totalLevels} niveles</span></div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-300"><span>Cota mínima <strong id="ql-min-elev" className="block text-white">{LevelQuickGenerator.formatElevation(minElevation)}</strong></span><span>Cota máxima <strong id="ql-max-elev" className="block text-white">{LevelQuickGenerator.formatElevation(maxElevation)}</strong></span><span>Altura total <strong id="ql-total-height" className="block text-emerald-400">{(maxElevation - minElevation).toFixed(2)} m</strong></span></div>
        </div>
      </div>
      <footer className="flex justify-between border-t border-white/10 bg-slate-950 px-5 py-3"><button id="modal-ql-cancel" type="button" className="border border-white/15 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/10" onClick={onClose}>Cancelar</button><button id="modal-ql-generate" type="submit" className="border border-emerald-500 bg-emerald-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">Generar niveles</button></footer>
    </form>
  </div>;
}
