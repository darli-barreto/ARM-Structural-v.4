import { GridDrawMode, ToolType } from '../config/structural.config';
import {
  LevelDrawMode,
  LevelTemplateType,
  QuickGenerateLevelConfig,
} from '../core/level/types/LevelTypes';
import { LEVEL_TEMPLATES, LevelQuickGenerator } from '../core/level/generator/LevelQuickGenerator';
import { ManagedElement, ArrayOptions } from '../tools/structural/types';
import { icon } from './shared';

export interface ContextualActions {
  // Grillas
  onDrawModeChange?: (mode: GridDrawMode) => void;
  onOffsetChange?: (offset: number) => void;
  onChainChange?: (chain: boolean) => void;
  onFilletRadiusChange?: (radius: number) => void;
  onApplyTemplate?: (template: '5x5' | '4x4' | '6x6') => void;
  onQuickGenerate?: (hSpacing: number, vSpacing: number, countX?: number, countZ?: number) => void;
  // Niveles
  onLevelDrawModeChange?: (mode: LevelDrawMode) => void;
  onLevelOffsetChange?: (offset: number) => void;
  onLevelMakePlanViewChange?: (makePlanView: boolean) => void;
  onApplyLevelTemplate?: (template: LevelTemplateType) => void;
  onQuickGenerateLevels?: (config: QuickGenerateLevelConfig) => void;
  // Acciones generales y estructurales
  onAtGrid?: () => void;
  onCancel?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onToggleGrid?: () => void;
  // Herramientas Avanzadas Revit (Align, Array, Geometría Libre)
  onStartAlign?: () => void;
  onCancelAlign?: () => void;
  onStartArray?: () => void;
  onExecuteArray?: (options: ArrayOptions) => void;
  onCancelArray?: () => void;
  onToggleColumnStyle?: () => void;
  onStartSketchMode?: () => void;
  onAddVoidSketch?: () => void;
  onFinishSketchMode?: () => void;
  onCancelSketchMode?: () => void;
}

export class ContextualSubheader {
  private container: HTMLElement;
  // Estado Grillas
  public currentOffset = 0.0;
  public drawMode: GridDrawMode = 'line';
  public isChain = false;
  public filletRadius = 0.0;
  // Estado Niveles
  public levelDrawMode: LevelDrawMode = 'line';
  public levelOffset = 0.0;
  public levelMakePlanView = true;
  public levelActiveTemplate: LevelTemplateType = 'residential';

  constructor(private actions: ContextualActions) {
    this.container = document.createElement('div');
    this.container.id = 'contextual-subbar';
    this.container.className =
      'h-9 bg-emerald-50 border-t border-emerald-200 border-b-2 border-b-emerald-600 text-emerald-950 flex items-center px-3 gap-2 text-xs z-40 select-none shadow-xs shrink-0 overflow-x-auto';

    const header = document.getElementById('app-header')!;
    header.appendChild(this.container);

    this.renderGeneralOptions('Nivel 1 (+3.50m)');
  }

  public updateForTool(tool: ToolType, levelName: string): void {
    if (tool === 'select') {
      this.renderGeneralOptions(levelName);
    } else if (tool === 'grid') {
      this.renderGridOptions();
    } else if (tool === 'level') {
      this.renderLevelOptions();
    } else {
      this.renderStructuralOptions(tool, levelName);
    }
  }

  /**
   * ESTADO REVIT: Elemento Estructural Seleccionado (Herramientas Modificar Activas)
   */
  public updateForSelectedElement(element: ManagedElement, levelName: string): void {
    const catLabels = {
      footing: 'Cimentación Estructural (Zapata)',
      column: 'Pilares Estructurales (Columna)',
      beam: 'Armazón Estructural (Viga)',
      slab: 'Suelos / Losas de Entrepiso',
    };
    const catName = catLabels[element.type] || 'Elemento Estructural';
    const isCol = element.type === 'column';
    const isSlab = element.type === 'slab';
    const isSlanted = element.definition && element.definition.type === 'column' && element.definition.columnStyle === 'slanted';

    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-sky-800 text-white px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-sky-300 text-xs">●</span>
        <span>Modificar | ${catName} <span class="text-sky-200 font-mono font-normal">(${element.id})</span></span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- HERRAMIENTAS REVIT MODIFICAR -->
      <div class="flex items-center gap-1 shrink-0">
        <button id="btn-ctx-align" class="bg-white hover:bg-sky-50 text-slate-800 border border-slate-300 hover:border-sky-400 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs" title="Alinear elemento con referencia de rejilla, nivel o arista (AL)">
          <span class="text-sky-600 font-bold">📏</span> Alinear <kbd class="text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded border border-slate-200">AL</kbd>
        </button>

        <button id="btn-ctx-array" class="bg-white hover:bg-sky-50 text-slate-800 border border-slate-300 hover:border-sky-400 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs" title="Crear matriz lineal o radial de elementos (AR)">
          <span class="text-indigo-600 font-bold">⊞</span> Matriz <kbd class="text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded border border-slate-200">AR</kbd>
        </button>

        ${isCol ? `
          <button id="btn-ctx-col-style" class="bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 px-2.5 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1" title="Alternar entre columna vertical pura o inclinada en 2 puntos 3D">
            <span>🔄</span> <span>Modo: <strong class="${isSlanted ? 'text-amber-600' : 'text-sky-600'}">${isSlanted ? 'Inclinada 3D' : 'Vertical'}</strong></span>
          </button>
        ` : ''}

        ${true ? `
          <button id="btn-ctx-sketch" class="bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1" title="Editar contorno de boceto libre">
            ${icon('Pencil')} <span>${isSlab ? 'Editar contorno' : 'Editar geometria'}</span>
          </button>
          <button id="btn-ctx-add-void" ${isSlab ? '' : 'hidden'} class="bg-white hover:bg-amber-50 text-amber-950 border border-amber-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1" title="Añadir perforación o shaft interior (hueco)">
            <span>🔲</span> <span>Añadir Hueco</span>
          </button>
        ` : ''}
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1 shrink-0">
        <button id="btn-ctx-delete" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1" title="Eliminar elemento (Supr)">
          <span>🗑️</span> Suprimir
        </button>
        <button id="btn-ctx-clear-sel" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Deseleccionar (Esc)">
          ✖ Salir
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="bg-emerald-100/80 border border-emerald-300/80 text-emerald-900 font-mono text-[11px] px-2 py-0.5 rounded font-medium">
          📐 ${element.dimensions}
        </span>
        <span class="text-slate-500 text-[11px] italic hidden xl:inline">
          💡 Arrastra los grips azules para modificar longitud o vértices
        </span>
      </div>
    `;

    document.getElementById('btn-ctx-align')?.addEventListener('click', () => this.actions.onStartAlign?.());
    document.getElementById('btn-ctx-array')?.addEventListener('click', () => this.actions.onStartArray?.());
    document.getElementById('btn-ctx-col-style')?.addEventListener('click', () => this.actions.onToggleColumnStyle?.());
    document.getElementById('btn-ctx-sketch')?.addEventListener('click', () => this.actions.onStartSketchMode?.());
    document.getElementById('btn-ctx-add-void')?.addEventListener('click', () => this.actions.onAddVoidSketch?.());
    document.getElementById('btn-ctx-delete')?.addEventListener('click', () => this.actions.onDeleteSelected?.());
    document.getElementById('btn-ctx-clear-sel')?.addEventListener('click', () => this.actions.onClearSelection?.());
  }

  /**
   * ESTADO REVIT: Barra contextual de herramienta Alinear (Align - AL)
   */
  public renderAlignBar(stepText: string): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-pink-800 text-white px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-pink-300 text-xs">●</span>
        <span>Modificar | Alinear (AL)</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-2 shrink-0 text-xs font-semibold text-emerald-950">
        <span>📍 ${stepText}</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-ctx-cancel-align" class="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors">
          ✖ Cancelar (Esc)
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] italic">
          💡 Haz clic en una línea de rejilla o nivel y luego en el elemento para alinearlo automáticamente
        </span>
      </div>
    `;

    document.getElementById('btn-ctx-cancel-align')?.addEventListener('click', () => this.actions.onCancelAlign?.());
  }

  /**
   * ESTADO REVIT: Barra contextual de herramienta Matriz (Array - AR)
   */
  public renderArrayBar(element: ManagedElement): void {
    let currentType: 'linear' | 'radial' = 'linear';
    let currentSpacing: 'second' | 'last' = 'second';

    const render = () => {
      this.container.innerHTML = `
        <div class="flex items-center gap-1.5 bg-indigo-800 text-white px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
          <span class="text-indigo-300 text-xs">●</span>
          <span>Modificar | Matriz (AR) - ${element.id}</span>
        </div>

        <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

        <!-- TIPO DE MATRIZ -->
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-emerald-900 font-semibold text-[11px]">Tipo:</span>
          <div class="flex bg-white border border-emerald-300 rounded overflow-hidden">
            <button id="btn-arr-linear" class="px-2 py-0.5 text-xs font-semibold cursor-pointer ${currentType === 'linear' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}">
              📏 Lineal
            </button>
            <button id="btn-arr-radial" class="px-2 py-0.5 text-xs font-semibold cursor-pointer ${currentType === 'radial' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}">
              ⭕ Radial
            </button>
          </div>
        </div>

        <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

        <!-- NÚMERO DE COPIAS -->
        <div class="flex items-center gap-1.5 shrink-0">
          <label class="text-emerald-900 font-semibold text-[11px]">Número (Count):</label>
          <input id="ctx-arr-count" type="number" min="2" max="50" value="3" class="w-14 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-center text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" />
        </div>

        <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

        <!-- MÉTODO DE ESPACIADO -->
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-emerald-900 font-semibold text-[11px]">Mover a:</span>
          <div class="flex bg-white border border-emerald-300 rounded overflow-hidden text-[11px]">
            <button id="btn-arr-second" class="px-2 py-0.5 cursor-pointer font-medium ${currentSpacing === 'second' ? 'bg-indigo-100 text-indigo-900 font-bold' : 'text-slate-700 hover:bg-slate-100'}">
              2º elemento
            </button>
            <button id="btn-arr-last" class="px-2 py-0.5 cursor-pointer font-medium ${currentSpacing === 'last' ? 'bg-indigo-100 text-indigo-900 font-bold' : 'text-slate-700 hover:bg-slate-100'}">
              Último
            </button>
          </div>
        </div>

        ${currentType === 'radial' ? `
          <div class="w-px h-4 bg-emerald-300 shrink-0"></div>
          <div class="flex items-center gap-1.5 shrink-0">
            <label class="text-emerald-900 font-semibold text-[11px]">Ángulo Total:</label>
            <input id="ctx-arr-angle" type="number" value="360" step="15" class="w-16 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-center text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" />
            <span class="text-slate-500 text-xs">°</span>
          </div>
        ` : `
          <div class="w-px h-4 bg-emerald-300 shrink-0"></div>
          <div class="flex items-center gap-1.5 shrink-0">
            <label class="text-emerald-900 font-semibold text-[11px]">Distancia Bay X:</label>
            <input id="ctx-arr-dist-x" type="number" value="6.00" step="0.5" class="w-16 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-center text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" />
            <span class="text-slate-500 text-xs">m</span>
          </div>
        `}

        <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

        <!-- ACCIONES MATRIZ -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="btn-ctx-exec-array" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-0.5 rounded text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1">
            <span>⚡</span> Ejecutar Matriz
          </button>
          <button id="btn-ctx-cancel-array" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors">
            ✖ Cancelar
          </button>
        </div>
      `;

      document.getElementById('btn-arr-linear')?.addEventListener('click', () => { currentType = 'linear'; render(); });
      document.getElementById('btn-arr-radial')?.addEventListener('click', () => { currentType = 'radial'; render(); });
      document.getElementById('btn-arr-second')?.addEventListener('click', () => { currentSpacing = 'second'; render(); });
      document.getElementById('btn-arr-last')?.addEventListener('click', () => { currentSpacing = 'last'; render(); });

      document.getElementById('btn-ctx-cancel-array')?.addEventListener('click', () => this.actions.onCancelArray?.());

      document.getElementById('btn-ctx-exec-array')?.addEventListener('click', () => {
        const countInp = document.getElementById('ctx-arr-count') as HTMLInputElement;
        const count = parseInt(countInp?.value || '3', 10);
        let angleDeg = 360;
        let deltaX = 6.0;

        if (currentType === 'radial') {
          const angleInp = document.getElementById('ctx-arr-angle') as HTMLInputElement;
          angleDeg = parseFloat(angleInp?.value || '360');
        } else {
          const distInp = document.getElementById('ctx-arr-dist-x') as HTMLInputElement;
          deltaX = parseFloat(distInp?.value || '6.0');
        }

        const options: ArrayOptions = {
          type: currentType,
          count,
          spacingMethod: currentSpacing,
          delta: { x: deltaX, y: 0, z: 0 },
          angleDegrees: angleDeg,
        };

        this.actions.onExecuteArray?.(options);
      });
    };

    render();
  }

  /**
   * ESTADO 1: Barra de herramientas generales (Modificar / Selección)
   */
  private renderGeneralOptions(levelName: string): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>Modificar</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Nivel Activo:</span>
        <strong class="text-emerald-950 font-bold">${levelName}</strong>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1 shrink-0">
        <button id="btn-ctx-clear-sel" class="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Deseleccionar todo">
          Deseleccionar
        </button>
        <button id="btn-ctx-delete" class="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors" title="Eliminar elemento seleccionado (Supr)">
          🗑️ Eliminar
        </button>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-ctx-toggle-grid" class="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Alternar visibilidad de grilla">
          🌐 Visibilidad Grillas
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">💡 Clic para seleccionar • Supr para borrar • Selecciona Rejilla para trazar ejes</span>
      </div>
    `;

    document.getElementById('btn-ctx-clear-sel')?.addEventListener('click', () => this.actions.onClearSelection?.());
    document.getElementById('btn-ctx-delete')?.addEventListener('click', () => this.actions.onDeleteSelected?.());
    document.getElementById('btn-ctx-toggle-grid')?.addEventListener('click', () => this.actions.onToggleGrid?.());
  }

  /**
   * ESTADO 2: Específico de Grilla (Autodesk Revit Style)
   */
  private renderGridOptions(): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>Modificar | Colocar Rejilla (Grid)</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Herramientas de Dibujo de Rejilla -->
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Dibujar:</span>
        <div class="flex bg-emerald-100 border border-emerald-300 rounded overflow-hidden">
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'line' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="line" title="Línea recta (individual o cadena)">📏 Línea</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'arc_start_end_radius' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="arc_start_end_radius" title="Arco por inicio, fin y radio (3 clics)">↷ Arco I-F-R</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'arc_center_ends' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="arc_center_ends" title="Arco por centro y puntos finales">◡ Arco Centro</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'pick_lines' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="pick_lines" title="Seleccionar líneas / bordes de estructura (Tab cicla aristas)">⇥ Pick Lines</button>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Opciones de Cadena y Desfase -->
      <div class="flex items-center gap-2 shrink-0">
        <label class="flex items-center gap-1 text-emerald-900 font-semibold text-[11px] cursor-pointer">
          <input id="grid-chain-checkbox" type="checkbox" ${this.isChain ? 'checked' : ''} class="accent-emerald-700 cursor-pointer rounded" />
          <span>Cadena</span>
        </label>

        <div class="flex items-center gap-1 ml-1">
          <label for="grid-offset-input" class="text-emerald-900 font-semibold text-[11px]">Desfase:</label>
          <input id="grid-offset-input" type="number" step="0.5" min="0" value="${this.currentOffset.toFixed(2)}" class="w-16 px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="text-emerald-700 font-semibold text-[11px]">m</span>
        </div>

        <div class="flex items-center gap-1 ml-1">
          <label for="grid-radius-input" class="text-emerald-900 font-semibold text-[11px]">Radio:</label>
          <input id="grid-radius-input" type="number" step="0.5" min="0" value="${this.filletRadius.toFixed(2)}" class="w-14 px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="text-emerald-700 font-semibold text-[11px]">m</span>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Generación Rápida -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Plantilla:</span>
        <select id="grid-template-select" class="px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-600">
          <option value="5x5" selected>5x5 (6m)</option>
          <option value="4x4">4x4 (6m)</option>
          <option value="6x6">6x6 (5m)</option>
        </select>
        <span class="text-emerald-900 font-semibold text-[11px] ml-1">H:</span>
        <input id="h-spacing-input" type="number" value="6" step="1" min="1" class="w-11 px-1 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none text-center" />
        <span class="text-emerald-900 font-semibold text-[11px]">V:</span>
        <input id="v-spacing-input" type="number" value="6" step="1" min="1" class="w-11 px-1 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none text-center" />
        <button id="btn-quick-generate" class="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 px-2 py-0.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors" title="Generar rejilla ortogonal con las separaciones">
          ⚡ Quick Generate
        </button>
      </div>

      <!-- Finalizar -->
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">⌨️ Esc para cancelar</span>
        <button id="btn-ctx-cancel" class="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors">
          ✖ Finalizar (Esc)
        </button>
      </div>
    `;

    this.bindGridEvents();
  }

  private renderStructuralOptions(tool: ToolType, levelName: string): void {
    const titles: Record<string, string> = {
      zapata: 'Modificar | Colocar Zapata Aislada (2.0x2.0m)',
      columna: 'Modificar | Colocar Columna de Concreto (0.40x0.40m)',
      viga: 'Modificar | Colocar Viga de Pórtico (0.40x0.55m)',
      techo: 'Modificar | Colocar Losa de Entrepiso (e=0.20m)',
    };

    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>${titles[tool] || 'Colocar Elemento'}</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Nivel Activo:</span>
        <strong class="text-emerald-950 font-bold">${levelName}</strong>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-ctx-at-grid" class="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 px-2.5 py-0.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors">
          🎯 Colocar en todas las Grillas (At Grid)
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">Previsualización activa • Clic para colocar</span>
        <button id="btn-ctx-cancel" class="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors">
          ✖ Finalizar (Esc)
        </button>
      </div>
    `;

    document.getElementById('btn-ctx-at-grid')?.addEventListener('click', () => this.actions.onAtGrid?.());
    document.getElementById('btn-ctx-cancel')?.addEventListener('click', () => this.actions.onCancel?.());
  }

  private bindGridEvents(): void {
    const btns = this.container.querySelectorAll<HTMLButtonElement>('.ctx-draw-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        btns.forEach(b => {
          b.className = 'ctx-draw-btn px-2 py-0.5 text-xs text-emerald-950 hover:bg-emerald-200 transition-colors cursor-pointer';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className = 'ctx-draw-btn px-2 py-0.5 text-xs bg-emerald-700 text-white font-semibold transition-colors cursor-pointer';
        this.drawMode = target.dataset.draw as GridDrawMode;
        this.actions.onDrawModeChange?.(this.drawMode);
      });
    });

    const chainCb = document.getElementById('grid-chain-checkbox') as HTMLInputElement;
    chainCb?.addEventListener('change', () => {
      this.isChain = chainCb.checked;
      this.actions.onChainChange?.(this.isChain);
    });

    const offsetInp = document.getElementById('grid-offset-input') as HTMLInputElement;
    const handleOffset = () => {
      this.currentOffset = parseFloat(offsetInp.value) || 0.0;
      this.actions.onOffsetChange?.(this.currentOffset);
    };
    offsetInp?.addEventListener('input', handleOffset);
    offsetInp?.addEventListener('change', handleOffset);

    const radiusInp = document.getElementById('grid-radius-input') as HTMLInputElement;
    const handleRadius = () => {
      this.filletRadius = parseFloat(radiusInp.value) || 0.0;
      this.actions.onFilletRadiusChange?.(this.filletRadius);
    };
    radiusInp?.addEventListener('input', handleRadius);
    radiusInp?.addEventListener('change', handleRadius);

    const templateSelect = document.getElementById('grid-template-select') as HTMLSelectElement;
    templateSelect?.addEventListener('change', () => {
      const val = templateSelect.value as '5x5' | '4x4' | '6x6';
      const hInput = document.getElementById('h-spacing-input') as HTMLInputElement;
      const vInput = document.getElementById('v-spacing-input') as HTMLInputElement;
      if (val === '6x6') {
        if (hInput) hInput.value = '5';
        if (vInput) vInput.value = '5';
      } else {
        if (hInput) hInput.value = '6';
        if (vInput) vInput.value = '6';
      }
    });

    document.getElementById('btn-quick-generate')?.addEventListener('click', () => {
      const hInput = document.getElementById('h-spacing-input') as HTMLInputElement;
      const vInput = document.getElementById('v-spacing-input') as HTMLInputElement;
      const h = parseFloat(hInput?.value) || 6;
      const v = parseFloat(vInput?.value) || 6;
      const tmpl = templateSelect?.value as '5x5' | '4x4' | '6x6';

      let countX = 5;
      let countZ = 5;
      if (tmpl === '4x4') {
        countX = 4;
        countZ = 4;
      } else if (tmpl === '6x6') {
        countX = 6;
        countZ = 6;
      }

      if (this.actions.onQuickGenerate) {
        this.actions.onQuickGenerate(h, v, countX, countZ);
      } else if (this.actions.onApplyTemplate) {
        this.actions.onApplyTemplate(tmpl);
      }
    });

    document.getElementById('btn-ctx-cancel')?.addEventListener('click', () => this.actions.onCancel?.());
  }

  /**
   * ESTADO 3: Específico de Niveles (Autodesk Revit Style)
   */
  private renderLevelOptions(): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>Modificar | Colocar Nivel (Level - LL)</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Herramientas de Dibujo de Nivel (Estilo Revit: 2 Clics vs Pick Lines) -->
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Dibujar:</span>
        <div class="flex bg-emerald-100 border border-emerald-300 rounded overflow-hidden">
          <button class="ctx-lvl-draw-btn px-2 py-0.5 text-xs ${this.levelDrawMode === 'line' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="line" title="Línea horizontal por 2 puntos en vistas de alzado">📏 Línea (2 Clics)</button>
          <button class="ctx-lvl-draw-btn px-2 py-0.5 text-xs ${this.levelDrawMode === 'pick_lines' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="pick_lines" title="Seleccionar nivel existente para aplicar desfase">⇥ Pick Line (Desfase)</button>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Opciones de Desfase y Vista Asociada (Estilo Revit) -->
      <div class="flex items-center gap-2 shrink-0">
        <label class="flex items-center gap-1 text-emerald-900 font-semibold text-[11px] cursor-pointer" title="Crea automáticamente una vista de plano de planta en el navegador">
          <input id="level-make-plan-checkbox" type="checkbox" ${this.levelMakePlanView ? 'checked' : ''} class="accent-emerald-700 cursor-pointer rounded" />
          <span>Crear vista de plano</span>
        </label>

        <div class="flex items-center gap-1 ml-1">
          <label for="level-offset-input" class="text-emerald-900 font-semibold text-[11px]">Desfase:</label>
          <input id="level-offset-input" type="number" step="0.5" value="${this.levelOffset.toFixed(2)}" class="w-16 px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="text-emerald-700 font-semibold text-[11px]">m</span>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Plantillas Predeterminadas y Quick Generate -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Plantilla:</span>
        <select id="level-template-select" class="px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-600">
          <option value="residential" ${this.levelActiveTemplate === 'residential' ? 'selected' : ''}>Residencial (1S + PB + 4P)</option>
          <option value="commercial" ${this.levelActiveTemplate === 'commercial' ? 'selected' : ''}>Comercial (2S + Lobby + 8P)</option>
          <option value="house_2lvl" ${this.levelActiveTemplate === 'house_2lvl' ? 'selected' : ''}>Vivienda (PB + PA)</option>
          <option value="tower_10" ${this.levelActiveTemplate === 'tower_10' ? 'selected' : ''}>Torre (2S + PB + 10P)</option>
        </select>
        <button id="btn-apply-level-template" class="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Aplicar plantilla predeterminada instantáneamente">
          Aplicar
        </button>
        <button id="btn-quick-generate-levels" class="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 px-2.5 py-0.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors flex items-center gap-1" title="Abrir asistente de generación de torre o estructura completa">
          ⚡ Quick Generate Niveles
        </button>
      </div>

      <!-- Finalizar -->
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">Usa vistas de alzado • Esc para finalizar</span>
        <button id="btn-ctx-cancel" class="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors">
          ✖ Finalizar (Esc)
        </button>
      </div>
    `;

    this.bindLevelEvents();
  }

  private bindLevelEvents(): void {
    const btns = this.container.querySelectorAll<HTMLButtonElement>('.ctx-lvl-draw-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        btns.forEach(b => {
          b.className = 'ctx-lvl-draw-btn px-2 py-0.5 text-xs text-emerald-950 hover:bg-emerald-200 transition-colors cursor-pointer';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className = 'ctx-lvl-draw-btn px-2 py-0.5 text-xs bg-emerald-700 text-white font-semibold transition-colors cursor-pointer';
        this.levelDrawMode = target.dataset.draw as LevelDrawMode;
        this.actions.onLevelDrawModeChange?.(this.levelDrawMode);
      });
    });

    const makePlanCb = document.getElementById('level-make-plan-checkbox') as HTMLInputElement;
    makePlanCb?.addEventListener('change', () => {
      this.levelMakePlanView = makePlanCb.checked;
      this.actions.onLevelMakePlanViewChange?.(this.levelMakePlanView);
    });

    const offsetInp = document.getElementById('level-offset-input') as HTMLInputElement;
    const handleOffset = () => {
      this.levelOffset = parseFloat(offsetInp.value) || 0.0;
      this.actions.onLevelOffsetChange?.(this.levelOffset);
    };
    offsetInp?.addEventListener('input', handleOffset);
    offsetInp?.addEventListener('change', handleOffset);

    const templateSelect = document.getElementById('level-template-select') as HTMLSelectElement;
    templateSelect?.addEventListener('change', () => {
      this.levelActiveTemplate = templateSelect.value as LevelTemplateType;
    });

    document.getElementById('btn-apply-level-template')?.addEventListener('click', () => {
      const tmpl = templateSelect.value as LevelTemplateType;
      this.actions.onApplyLevelTemplate?.(tmpl);
    });

    document.getElementById('btn-quick-generate-levels')?.addEventListener('click', () => {
      this.openQuickGenerateLevelModal();
    });

    document.getElementById('btn-ctx-cancel')?.addEventListener('click', () => this.actions.onCancel?.());
  }

  /**
   * Modal de Generación Rápida de Niveles (Torre / Estructura por parámetros rápidos)
   */
  public openQuickGenerateLevelModal(): void {
    // Si ya existe modal previo, removerlo
    document.getElementById('modal-quick-levels')?.remove();

    const currentTmpl = LEVEL_TEMPLATES[this.levelActiveTemplate] || LEVEL_TEMPLATES.residential;
    const cfg = { ...currentTmpl.config };

    const overlay = document.createElement('div');
    overlay.id = 'modal-quick-levels';
    overlay.className = 'fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150';

    overlay.innerHTML = `
      <div class="bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-200">
        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 px-5 py-3.5 border-b border-emerald-500/30 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">⚡</span>
            <div>
              <h3 class="font-bold text-sm text-emerald-400">Quick Generate Niveles (Torre Completa)</h3>
              <p class="text-[11px] text-slate-400">Genera la estructura de cotas y plantas en lote estilo Autodesk Revit</p>
            </div>
          </div>
          <button id="modal-ql-close" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors text-sm cursor-pointer">
            ✖
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
          <!-- Selector rápido de preset para cargar valores -->
          <div class="bg-slate-950 p-3 rounded-lg border border-white/10 flex flex-col gap-1.5">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Cargar Esquema Base (Preset):</label>
            <div class="grid grid-cols-2 gap-2">
              <button class="modal-preset-btn text-left p-2 rounded border border-white/10 hover:border-emerald-400/50 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer" data-preset="residential">
                <div class="text-xs font-semibold text-emerald-300">🏢 Residencial Estándar</div>
                <div class="text-[10px] text-slate-400">1S (-2.8m) + PB (3.5m) + 4P (3.0m)</div>
              </button>
              <button class="modal-preset-btn text-left p-2 rounded border border-white/10 hover:border-emerald-400/50 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer" data-preset="commercial">
                <div class="text-xs font-semibold text-emerald-300">🏬 Comercial / Oficinas</div>
                <div class="text-[10px] text-slate-400">2S (-3.2m) + Lobby (5.0m) + 8P (3.8m)</div>
              </button>
              <button class="modal-preset-btn text-left p-2 rounded border border-white/10 hover:border-emerald-400/50 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer" data-preset="house_2lvl">
                <div class="text-xs font-semibold text-emerald-300">🏡 Vivienda 2 Niveles</div>
                <div class="text-[10px] text-slate-400">Sin sótanos + PB (2.8m) + PA (2.6m)</div>
              </button>
              <button class="modal-preset-btn text-left p-2 rounded border border-white/10 hover:border-emerald-400/50 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer" data-preset="tower_10">
                <div class="text-xs font-semibold text-emerald-300">🏙️ Torre 10 Niveles</div>
                <div class="text-[10px] text-slate-400">2S (-3.0m) + PB (4.5m) + 10P (3.0m)</div>
              </button>
            </div>
          </div>

          <!-- Campos de Parámetros -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Cota Inicial Base -->
            <div class="flex flex-col gap-1">
              <label for="ql-base-elev" class="text-xs font-semibold text-slate-300">Cota Nivel Base (0.00):</label>
              <div class="flex items-center bg-slate-950 border border-white/15 rounded px-2 py-1 focus-within:border-emerald-400">
                <input id="ql-base-elev" type="number" step="0.5" value="${cfg.baseElevation.toFixed(2)}" class="w-full bg-transparent text-xs font-mono text-white outline-none" />
                <span class="text-slate-400 text-xs ml-1">m</span>
              </div>
            </div>

            <!-- Nombre Planta Baja -->
            <div class="flex flex-col gap-1">
              <label for="ql-ground-name" class="text-xs font-semibold text-slate-300">Nombre Nivel Base:</label>
              <input id="ql-ground-name" type="text" value="${cfg.groundFloorName}" class="bg-slate-950 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-400" />
            </div>

            <!-- Sótanos: Cantidad y Altura -->
            <div class="flex flex-col gap-1">
              <label for="ql-basement-count" class="text-xs font-semibold text-slate-300">Número de Sótanos:</label>
              <input id="ql-basement-count" type="number" min="0" max="10" step="1" value="${cfg.basementCount}" class="bg-slate-950 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-400" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="ql-basement-height" class="text-xs font-semibold text-slate-300">Altura Típica Sótano:</label>
              <div class="flex items-center bg-slate-950 border border-white/15 rounded px-2 py-1 focus-within:border-emerald-400">
                <input id="ql-basement-height" type="number" min="1" max="10" step="0.1" value="${cfg.basementHeight.toFixed(2)}" class="w-full bg-transparent text-xs font-mono text-white outline-none" />
                <span class="text-slate-400 text-xs ml-1">m</span>
              </div>
            </div>

            <!-- Planta Baja: Altura Especial -->
            <div class="flex flex-col gap-1 col-span-2">
              <label for="ql-ground-height" class="text-xs font-semibold text-slate-300">Altura de Planta Baja / Lobby Especial:</label>
              <div class="flex items-center bg-slate-950 border border-white/15 rounded px-2 py-1 focus-within:border-emerald-400">
                <input id="ql-ground-height" type="number" min="2" max="12" step="0.1" value="${cfg.groundFloorHeight.toFixed(2)}" class="w-full bg-transparent text-xs font-mono text-white outline-none" />
                <span class="text-slate-400 text-xs ml-1">m</span>
              </div>
            </div>

            <!-- Pisos Superiores: Cantidad y Altura -->
            <div class="flex flex-col gap-1">
              <label for="ql-upper-count" class="text-xs font-semibold text-slate-300">Niveles Superiores (Pisos):</label>
              <input id="ql-upper-count" type="number" min="1" max="50" step="1" value="${cfg.upperFloorCount}" class="bg-slate-950 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-400" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="ql-upper-height" class="text-xs font-semibold text-slate-300">Altura Típica de Entrepiso:</label>
              <div class="flex items-center bg-slate-950 border border-white/15 rounded px-2 py-1 focus-within:border-emerald-400">
                <input id="ql-upper-height" type="number" min="1.5" max="10" step="0.1" value="${cfg.upperFloorHeight.toFixed(2)}" class="w-full bg-transparent text-xs font-mono text-white outline-none" />
                <span class="text-slate-400 text-xs ml-1">m</span>
              </div>
            </div>

            <!-- Nomenclatura y Prefijos -->
            <div class="flex flex-col gap-1">
              <label for="ql-prefix-upper" class="text-xs font-semibold text-slate-300">Prefijo Pisos Superiores:</label>
              <input id="ql-prefix-upper" type="text" value="${cfg.prefixUpper}" class="bg-slate-950 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-400" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="ql-prefix-basement" class="text-xs font-semibold text-slate-300">Prefijo Sótanos:</label>
              <input id="ql-prefix-basement" type="text" value="${cfg.prefixBasement}" class="bg-slate-950 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-400" />
            </div>
          </div>

          <!-- Opciones adicionales -->
          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input id="ql-create-views" type="checkbox" ${cfg.createPlanViews ? 'checked' : ''} class="accent-emerald-500 rounded" />
              <span>Crear vistas de plano de planta en navegador</span>
            </label>
          </div>

          <!-- Resumen de Previsualización en Tiempo Real -->
          <div id="ql-summary-box" class="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-200 flex flex-col gap-1">
            <div class="font-bold flex items-center justify-between text-emerald-300">
              <span>📊 Resumen Calculado:</span>
              <span id="ql-total-levels" class="bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-mono">0 Niveles</span>
            </div>
            <div class="grid grid-cols-3 gap-1 text-[11px] text-slate-300 mt-1">
              <div>Cota Mínima: <strong id="ql-min-elev" class="text-white">0.00m</strong></div>
              <div>Cota Máxima: <strong id="ql-max-elev" class="text-white">0.00m</strong></div>
              <div>Altura Total: <strong id="ql-total-height" class="text-emerald-400 font-bold">0.00m</strong></div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-slate-950 px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <button id="modal-ql-cancel" class="px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-medium cursor-pointer transition-colors">
            Cancelar
          </button>
          <button id="modal-ql-generate" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5">
            <span>⚡</span><span>Generar Torre de Niveles</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Funciones de cálculo y actualización en vivo
    const updateSummary = () => {
      const baseElev = parseFloat((document.getElementById('ql-base-elev') as HTMLInputElement).value) || 0;
      const bCount = parseInt((document.getElementById('ql-basement-count') as HTMLInputElement).value) || 0;
      const bHeight = parseFloat((document.getElementById('ql-basement-height') as HTMLInputElement).value) || 0;
      const gHeight = parseFloat((document.getElementById('ql-ground-height') as HTMLInputElement).value) || 0;
      const uCount = parseInt((document.getElementById('ql-upper-count') as HTMLInputElement).value) || 0;
      const uHeight = parseFloat((document.getElementById('ql-upper-height') as HTMLInputElement).value) || 0;

      const totalCount = bCount + 1 + uCount;
      const minElev = baseElev - bCount * bHeight;
      const maxElev = baseElev + gHeight + (uCount - 1) * uHeight;
      const totalSpan = maxElev - minElev;

      const totalLvlEl = document.getElementById('ql-total-levels');
      const minEl = document.getElementById('ql-min-elev');
      const maxEl = document.getElementById('ql-max-elev');
      const totalH = document.getElementById('ql-total-height');

      if (totalLvlEl) totalLvlEl.innerText = `${totalCount} Niveles`;
      if (minEl) minEl.innerText = LevelQuickGenerator.formatElevation(minElev);
      if (maxEl) maxEl.innerText = LevelQuickGenerator.formatElevation(maxElev);
      if (totalH) totalH.innerText = `${totalSpan.toFixed(2)} m`;
    };

    updateSummary();

    // Eventos de inputs para recalcular en tiempo real
    [
      'ql-base-elev',
      'ql-basement-count',
      'ql-basement-height',
      'ql-ground-height',
      'ql-upper-count',
      'ql-upper-height',
    ].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateSummary);
    });

    // Preset buttons dentro del modal
    overlay.querySelectorAll<HTMLButtonElement>('.modal-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetKey = (e.currentTarget as HTMLElement).dataset.preset as LevelTemplateType;
        const preset = LEVEL_TEMPLATES[presetKey];
        if (preset) {
          (document.getElementById('ql-base-elev') as HTMLInputElement).value = preset.config.baseElevation.toString();
          (document.getElementById('ql-ground-name') as HTMLInputElement).value = preset.config.groundFloorName;
          (document.getElementById('ql-basement-count') as HTMLInputElement).value = preset.config.basementCount.toString();
          (document.getElementById('ql-basement-height') as HTMLInputElement).value = preset.config.basementHeight.toString();
          (document.getElementById('ql-ground-height') as HTMLInputElement).value = preset.config.groundFloorHeight.toString();
          (document.getElementById('ql-upper-count') as HTMLInputElement).value = preset.config.upperFloorCount.toString();
          (document.getElementById('ql-upper-height') as HTMLInputElement).value = preset.config.upperFloorHeight.toString();
          (document.getElementById('ql-prefix-upper') as HTMLInputElement).value = preset.config.prefixUpper;
          (document.getElementById('ql-prefix-basement') as HTMLInputElement).value = preset.config.prefixBasement;
          (document.getElementById('ql-create-views') as HTMLInputElement).checked = preset.config.createPlanViews;
          updateSummary();
        }
      });
    });

    // Cerrar modal
    const closeModal = () => overlay.remove();
    document.getElementById('modal-ql-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-ql-cancel')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Confirmar y generar
    document.getElementById('modal-ql-generate')?.addEventListener('click', () => {
      const finalConfig: QuickGenerateLevelConfig = {
        baseElevation: parseFloat((document.getElementById('ql-base-elev') as HTMLInputElement).value) || 0,
        groundFloorName: (document.getElementById('ql-ground-name') as HTMLInputElement).value || 'Planta Baja',
        basementCount: parseInt((document.getElementById('ql-basement-count') as HTMLInputElement).value) || 0,
        basementHeight: parseFloat((document.getElementById('ql-basement-height') as HTMLInputElement).value) || 0,
        groundFloorHeight: parseFloat((document.getElementById('ql-ground-height') as HTMLInputElement).value) || 3.5,
        upperFloorCount: parseInt((document.getElementById('ql-upper-count') as HTMLInputElement).value) || 4,
        upperFloorHeight: parseFloat((document.getElementById('ql-upper-height') as HTMLInputElement).value) || 3.0,
        namingPattern: 'standard',
        prefixUpper: (document.getElementById('ql-prefix-upper') as HTMLInputElement).value || 'Nivel',
        prefixBasement: (document.getElementById('ql-prefix-basement') as HTMLInputElement).value || 'Sótano',
        createPlanViews: (document.getElementById('ql-create-views') as HTMLInputElement).checked,
      };

      closeModal();
      this.actions.onQuickGenerateLevels?.(finalConfig);
    });
  }
}
