import { ManagedElement } from '../tools/structural/types';
import { ViewManager } from '../core/views/ViewManager';
import { GridElement } from '../config/structural.config';
import { Level } from '../core/level/types/LevelTypes';
import { LevelQuickGenerator } from '../core/level/generator/LevelQuickGenerator';
import { BimDatabase } from '../core/database/BimDatabase';
import { escapeHtml as h } from './shared';
import { BimCategory, BimElementDocument, BimGridDocument, BimLevelDocument } from '../core/database/BimDatabaseTypes';

export class Sidebar {
  private propContent: HTMLElement;
  private currentElement: ManagedElement | null = null;
  private currentGrid: GridElement | null = null;

  constructor(
    private viewManager: ViewManager,
    private onDeleteRequested: (element: ManagedElement) => void,
    private onOpenSchedule?: (category: BimCategory | 'ALL') => void
  ) {
    this.propContent = document.getElementById('properties-content')!;
    this.bindSidebarTabs();
    this.bindProjectBrowser();
    this.showEmptyProperties();

    // Suscribirse a cambios en la base de datos BIM para refrescar la paleta si el elemento seleccionado cambia
    BimDatabase.getInstance().subscribe(() => {
      if (this.currentElement) {
        this.refreshElementDisplay(this.currentElement);
      }
    });
  }

  private bindSidebarTabs(): void {
    const tabBtns = document.querySelectorAll<HTMLButtonElement>('.sidebar-nav-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => {
          b.className =
            'sidebar-nav-btn flex-1 bg-transparent text-slate-400 border-b-2 border-transparent py-2 text-xs font-semibold cursor-pointer hover:text-slate-200 transition-colors';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className =
          'sidebar-nav-btn flex-1 bg-slate-800 text-sky-400 border-b-2 border-sky-400 py-2 text-xs font-semibold cursor-pointer transition-colors';

        const tab = target.dataset.sidebarTab;
        document.getElementById('sidebar-properties')?.classList.toggle('hidden', tab !== 'properties');
        document.getElementById('sidebar-properties')?.classList.toggle('block', tab === 'properties');

        document.getElementById('sidebar-browser')?.classList.toggle('hidden', tab !== 'browser');
        document.getElementById('sidebar-browser')?.classList.toggle('block', tab === 'browser');
      });
    });
  }

  private bindProjectBrowser(): void {
    document.querySelectorAll<HTMLElement>('#sidebar-browser .tree-item[data-open-view]').forEach(item => {
      const viewId = item.dataset.openView;
      if (!viewId) return;

      item.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.viewManager.openView(viewId);
      });

      item.addEventListener('click', () => {
        this.viewManager.openView(viewId);
      });
    });

    document.querySelectorAll<HTMLElement>('#sidebar-browser .tree-item[data-open-schedule]').forEach(item => {
      const cat = (item.dataset.openSchedule || 'ALL') as BimCategory | 'ALL';
      item.addEventListener('click', () => {
        if (this.onOpenSchedule) {
          this.onOpenSchedule(cat);
        }
      });
    });
  }

  /**
   * Sincroniza reactivamente el Navegador de Proyectos con los niveles del proyecto
   */
  public updateProjectBrowser(levels: Level[], activeViewId: string): void {
    const list = document.getElementById('browser-floor-plans-list');
    const countBadge = document.getElementById('browser-plan-count');
    if (!list) return;

    const planLevels = levels.filter(l => l.hasPlanView !== false);
    if (countBadge) {
      countBadge.textContent = planLevels.length.toString();
    }

    list.innerHTML = '';

    if (planLevels.length === 0) {
      list.innerHTML = '<div class="text-[11px] text-slate-500 italic px-2 py-1 select-none">(Sin planos generados)</div>';
    } else {
      planLevels.forEach(lvl => {
        const sign = lvl.elevation >= 0 ? '+' : '';
        const formattedElev = `${sign}${lvl.elevation.toFixed(2)}m`;
        const cleanName = lvl.name.split('(')[0].trim();
        const viewId = `plan-${lvl.id}`;
        const isActive = activeViewId === viewId;

        const item = document.createElement('div');
        item.className = `tree-item flex items-center justify-between gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors ${
          isActive 
            ? 'bg-sky-500/20 text-sky-300 font-semibold border-l-2 border-sky-400' 
            : 'text-slate-300 hover:bg-white/5 hover:text-sky-400'
        }`;
        item.dataset.openView = viewId;
        item.title = `Doble clic para abrir: Planta - ${cleanName} (${formattedElev})`;

        item.innerHTML = `
          <div class="flex items-center gap-1.5 truncate flex-1 pointer-events-none">
            <span class="text-xs shrink-0">📐</span>
            <span class="truncate">Planta - ${cleanName}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400 shrink-0 font-normal">${formattedElev}</span>
        `;

        item.addEventListener('dblclick', (e) => {
          e.preventDefault();
          this.viewManager.openView(viewId);
        });

        item.addEventListener('click', () => {
          this.viewManager.openView(viewId);
        });

        list.appendChild(item);
      });
    }

    // Resaltado de vistas
    document.querySelectorAll<HTMLElement>('#sidebar-browser .tree-item[data-open-view]').forEach(item => {
      const viewId = item.dataset.openView;
      if (viewId && !viewId.startsWith('plan-')) {
        const isActive = activeViewId === viewId;
        item.classList.toggle('bg-sky-500/20', isActive);
        item.classList.toggle('text-sky-300', isActive);
        item.classList.toggle('font-semibold', isActive);
        item.classList.toggle('border-l-2', isActive);
        item.classList.toggle('border-sky-400', isActive);
        item.classList.toggle('text-slate-300', !isActive);
      }
    });
  }

  public showElementProperties(element: ManagedElement): void {
    this.currentElement = element;
    this.currentGrid = null;
    this.refreshElementDisplay(element);
    (document.querySelector('.sidebar-nav-btn[data-sidebar-tab="properties"]') as HTMLElement)?.click();
  }

  private refreshElementDisplay(element: ManagedElement): void {
    const db = BimDatabase.getInstance();
    const doc: BimElementDocument | undefined =
      (element.uniqueId ? db.getByGuid(element.uniqueId) : undefined) ||
      db.getByLegacyId(element.id);

    if (!doc) {
      this.showEmptyProperties();
      return;
    }

    const icons: Record<string, string> = {
      footing: '🧱 Zapata Aislada',
      column: '🏛️ Columna Estructural',
      beam: '📏 Viga de Pórtico',
      slab: '🏠 Losa de Entrepiso',
    };
    const icon = icons[element.type] || '🏛️ Elemento';

    const shortGuid = `${doc.uniqueId.slice(0, 8)}...${doc.uniqueId.slice(-4)}`;
    const typeCatalog = db.getTypeCatalog();

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <!-- HEADER ELEMENTO -->
        <div class="border-b border-slate-700 pb-2">
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-xs text-sky-400 flex items-center gap-1">
              <span>${icon.split(' ')[0]}</span>
              <span>${h(doc.familyType)}</span>
            </span>
            <span class="bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              ID: ${doc.elementId}
            </span>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>GUID: <span class="text-slate-300">${shortGuid}</span></span>
            <button id="btn-copy-elem-guid" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[10px] cursor-pointer" title="Copiar GUID completo (RFC 4122)">
              📋 Copiar
            </button>
          </div>
        </div>

        <!-- JERARQUÍA REVIT POO -->
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Jerarquía POO Revit</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1 text-[11px]">
          <div class="flex justify-between">
            <span class="text-slate-500">Categoría:</span>
            <span class="text-slate-200 font-medium">${h(doc.categoryName)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Familia:</span>
            <span class="text-slate-200 font-medium">${h(doc.family)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Entidad IFC:</span>
            <span class="text-emerald-400 font-mono font-semibold">${h(doc.metadata.ifcEntity)}</span>
          </div>
        </div>

        <!-- PARÁMETROS DE TIPO -->
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Parámetros de Tipo (Clase)</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1 text-[11px]">
          <div class="flex justify-between">
            <span class="text-slate-500">Tipo Activo:</span>
            <span class="text-sky-300 font-bold">${h(doc.familyType)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Material Base:</span>
            <span class="text-slate-300">${h(doc.typeParameters.defaultMaterial)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Costo Base ($/m³):</span>
            <span class="text-purple-300 font-mono">$${doc.typeParameters.unitCost.toFixed(2)}</span>
          </div>
        </div>

        <!-- PARÁMETROS DE EJEMPLAR (INSTANCIA) - EDITABLES EN TIEMPO REAL -->
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Parámetros de Ejemplar (Instancia)</div>
        <div class="flex flex-col gap-2 bg-slate-950/70 border border-slate-800 rounded p-2.5 text-xs">
          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">Marca / Código:</label>
            <input id="prop-input-mark" type="text" value="${h(doc.instanceParameters.mark)}" class="w-24 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-sky-400 font-bold outline-none focus:border-sky-500 text-xs" />
          </div>

          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">Sector de Vaciado:</label>
            <select id="prop-select-sector" class="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500">
              ${!['Sector A','Sector B','Sector C','Sector D'].includes(doc.instanceParameters.sector)?`<option selected value="${h(doc.instanceParameters.sector)}">${h(doc.instanceParameters.sector)}</option>`:''}
              <option value="Sector A" ${doc.instanceParameters.sector === 'Sector A' ? 'selected' : ''}>Sector A</option>
              <option value="Sector B" ${doc.instanceParameters.sector === 'Sector B' ? 'selected' : ''}>Sector B</option>
              <option value="Sector C" ${doc.instanceParameters.sector === 'Sector C' ? 'selected' : ''}>Sector C</option>
              <option value="Sector D" ${doc.instanceParameters.sector === 'Sector D' ? 'selected' : ''}>Sector D</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">f'c Concreto:</label>
            <select id="prop-select-fc" class="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500">
              ${![210,280,350].includes(doc.instanceParameters.concreteStrength)?`<option selected value="${doc.instanceParameters.concreteStrength}">${doc.instanceParameters.concreteStrength} kg/cm²</option>`:''}
              <option value="210" ${doc.instanceParameters.concreteStrength === 210 ? 'selected' : ''}>210 kg/cm²</option>
              <option value="280" ${doc.instanceParameters.concreteStrength === 280 ? 'selected' : ''}>280 kg/cm²</option>
              <option value="350" ${doc.instanceParameters.concreteStrength === 350 ? 'selected' : ''}>350 kg/cm²</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">Fase Constructiva:</label>
            <select id="prop-select-phase" class="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500">
              <option value="Nueva Construcción" ${doc.instanceParameters.phase === 'Nueva Construcción' ? 'selected' : ''}>Nueva Construcción</option>
              <option value="Existente" ${doc.instanceParameters.phase === 'Existente' ? 'selected' : ''}>Existente</option>
              <option value="Demolición" ${doc.instanceParameters.phase === 'Demolición' ? 'selected' : ''}>Demolición</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">Nivel Base:</label>
            <span class="text-slate-200 font-medium">${h(doc.levelName)}</span>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-slate-400 text-[11px]">Desfase de Base:</label>
            <div class="flex items-center gap-1">
              <input id="prop-input-offset" type="number" step="0.05" value="${doc.instanceParameters.baseOffset.toFixed(2)}" class="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs font-mono text-center outline-none focus:border-sky-500" />
              <span class="text-slate-500 text-[10px]">m</span>
            </div>
          </div>
        </div>

        <!-- COTAS Y METRADOS CALCULADOS (BIM ENGINE) -->
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cotas y Metrados Calculados</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2.5 flex flex-col gap-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-400">Dimensiones:</span>
            <span class="text-slate-200 font-medium">${h(doc.geometry.dimensionsString)}</span>
          </div>
          <div class="flex justify-between font-mono">
            <span class="text-slate-400">Concreto neto:</span>
            <strong id="prop-net-volume" class="text-emerald-400 font-bold">${doc.instanceParameters.quantityState==='ready'?doc.instanceParameters.volume.toFixed(3)+' m3':'Pendiente'}</strong>
          </div>
          <div class="flex justify-between font-mono"><span>Bruto / solape (m3):</span><strong id="prop-gross-overlap">${(doc.instanceParameters.grossVolume??doc.instanceParameters.volume).toFixed(3)} / ${doc.instanceParameters.overlapVolume?.toFixed(3)??'-'}</strong></div>
          <div class="flex justify-between font-mono"><span>Acero manual (kg):</span><strong id="prop-steel-mass">${doc.instanceParameters.steelMass?.toFixed(2)??'No definido'}</strong></div>
          <div class="flex justify-between font-mono">
            <span class="text-slate-400">Área Encofrado:</span>
            <strong class="text-amber-400 font-bold">${doc.instanceParameters.surfaceArea.toFixed(2)} m²</strong>
          </div>
          <div class="flex justify-between font-mono">
            <span class="text-slate-400">Costo Estimado:</span>
            <strong id="prop-net-cost" class="text-purple-400 font-bold">${doc.instanceParameters.quantityState==='ready'?'$'+doc.instanceParameters.estimatedCost.toFixed(2):'Pendiente'}</strong>
          </div>
        </div>

        <!-- ACCIONES -->
        <div class="pt-2 flex flex-col gap-2">
          <button id="btn-prop-open-schedule" class="w-full bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700 py-1.5 px-2 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
            <span>📊</span> Ver en Tabla de Planificación
          </button>
          <button id="btn-delete-prop" class="w-full bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-800 py-1.5 px-2 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
            <span>🗑️</span> Suprimir Elemento
          </button>
        </div>
      </div>
    `;

    // Eventos
    document.getElementById('btn-copy-elem-guid')?.addEventListener('click', () => {
      navigator.clipboard.writeText(doc.uniqueId);
      const btn = document.getElementById('btn-copy-elem-guid');
      if (btn) {
        btn.textContent = '✓ Copiado';
        setTimeout(() => (btn.textContent = '📋 Copiar'), 1500);
      }
    });

    const markInp = document.getElementById('prop-input-mark') as HTMLInputElement;
    markInp?.addEventListener('change', () => {
      if (markInp.value.trim()) {
        db.updateInstanceParameters(doc.uniqueId, { mark: markInp.value.trim() });
      }
    });

    const sectorSel = document.getElementById('prop-select-sector') as HTMLSelectElement;
    sectorSel?.addEventListener('change', () => {
      db.updateInstanceParameters(doc.uniqueId, { sector: sectorSel.value });
    });

    const fcSel = document.getElementById('prop-select-fc') as HTMLSelectElement;
    fcSel?.addEventListener('change', () => {
      db.updateInstanceParameters(doc.uniqueId, { concreteStrength: parseInt(fcSel.value, 10) });
    });

    const phaseSel = document.getElementById('prop-select-phase') as HTMLSelectElement;
    phaseSel?.addEventListener('change', () => {
      db.updateInstanceParameters(doc.uniqueId, {
        phase: phaseSel.value as 'Nueva Construcción' | 'Existente' | 'Demolición',
      });
    });

    const offsetInp = document.getElementById('prop-input-offset') as HTMLInputElement;
    offsetInp?.addEventListener('change', () => {
      const val = parseFloat(offsetInp.value);
      if (!isNaN(val)) {
        db.updateInstanceParameters(doc.uniqueId, { baseOffset: val });
      }
    });

    document.getElementById('btn-prop-open-schedule')?.addEventListener('click', () => {
      if (this.onOpenSchedule) {
        this.onOpenSchedule(doc.category);
      }
    });

    document.getElementById('btn-delete-prop')?.addEventListener('click', () => {
      if (this.currentElement) {
        this.onDeleteRequested(this.currentElement);
        this.showEmptyProperties();
      }
    });
  }

  public showGridProperties(
    grid: GridElement,
    onUpdate: (updatedGrid: GridElement) => void,
    onDelete: (gridId: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = grid;

    const db = BimDatabase.getInstance();
    const gridDoc = db.getGridByGuid(grid.id) || (db.searchAnyById(grid.id)?.doc as BimGridDocument);

    const length =
      grid.geomType === 'line'
        ? Math.hypot(grid.end.x - grid.start.x, grid.end.z - grid.start.z).toFixed(2)
        : ((grid.radius || 10) * Math.abs((grid.endAngle || Math.PI) - (grid.startAngle || 0))).toFixed(2);

    const shortGuid = gridDoc ? `${gridDoc.uniqueId.slice(0, 8)}...${gridDoc.uniqueId.slice(-4)}` : grid.id;

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <div class="border-b border-slate-700 pb-2">
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-xs text-sky-400 flex items-center gap-1.5">
              <span>🌐</span> Rejilla (Grid Datum)
            </span>
            <span class="bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              ID: ${gridDoc?.elementId || grid.id}
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>GUID: <span class="text-slate-300">${shortGuid}</span></span>
            <button id="btn-copy-grid-guid" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[10px] cursor-pointer">
              📋 Copiar
            </button>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Identificación y Familia</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1.5 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-slate-400">Nombre de Eje:</span>
            <input id="grid-name-input" type="text" value="${grid.name}" class="w-16 px-2 py-0.5 bg-slate-900 border border-sky-500/40 rounded text-sky-300 text-xs font-bold text-center outline-none focus:border-sky-400" />
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-500">Categoría:</span>
            <span class="text-slate-200">Rejillas (OST_Grids)</span>
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-500">Familia:</span>
            <span class="text-slate-200">${gridDoc?.family || 'Rejilla Estándar Circular 6.5mm'}</span>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Geometría</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-400">Tipo:</span>
            <strong class="text-slate-200 font-medium">${grid.geomType === 'line' ? 'Línea Recta' : 'Arco'}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Longitud:</span>
            <strong class="text-sky-400 font-mono font-bold">${length} m</strong>
          </div>
          ${
            grid.radius
              ? `<div class="flex justify-between">
                  <span class="text-slate-400">Radio de Curvatura:</span>
                  <strong class="text-emerald-400 font-mono font-bold">${grid.radius.toFixed(2)} m</strong>
                </div>`
              : ''
          }
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Burbujas y Controles Revit</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded p-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-bubble-start" type="checkbox" ${grid.showStartBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Burbuja en Extremo Inicial (1)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-bubble-end" type="checkbox" ${grid.showEndBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Burbuja en Extremo Final (2)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-0.5">
            <input id="grid-prop-locked" type="checkbox" ${grid.isLocked !== false ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>🔒 Bloquear Alineación con Grupo (Revit Lock)</span>
          </label>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Codos de Rejilla (Grid Elbow / Jog)</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded p-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-elbow-start" type="checkbox" ${grid.startElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>⚡ Activar Codo en Extremo Inicial</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-elbow-end" type="checkbox" ${grid.endElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>⚡ Activar Codo en Extremo Final</span>
          </label>
        </div>

        <button id="btn-delete-grid-prop" class="mt-2 bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-800 py-1.5 px-2 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1">
          🗑️ Eliminar Rejilla
        </button>
      </div>
    `;

    document.getElementById('btn-copy-grid-guid')?.addEventListener('click', () => {
      if (gridDoc?.uniqueId) {
        navigator.clipboard.writeText(gridDoc.uniqueId);
      }
    });

    const nameInput = document.getElementById('grid-name-input') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
      grid.name = nameInput.value;
      if (gridDoc) {
        gridDoc.name = grid.name;
      }
      onUpdate(grid);
    });

    const startCb = document.getElementById('grid-prop-bubble-start') as HTMLInputElement;
    startCb?.addEventListener('change', () => {
      grid.showStartBubble = startCb.checked;
      onUpdate(grid);
    });

    const endCb = document.getElementById('grid-prop-bubble-end') as HTMLInputElement;
    endCb?.addEventListener('change', () => {
      grid.showEndBubble = endCb.checked;
      onUpdate(grid);
    });

    const lockCb = document.getElementById('grid-prop-locked') as HTMLInputElement;
    lockCb?.addEventListener('change', () => {
      grid.isLocked = lockCb.checked;
      onUpdate(grid);
    });

    const startElbowCb = document.getElementById('grid-prop-elbow-start') as HTMLInputElement;
    startElbowCb?.addEventListener('change', () => {
      if (!grid.startElbow) {
        grid.startElbow = { active: startElbowCb.checked, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.startElbow.active = startElbowCb.checked;
      }
      onUpdate(grid);
    });

    const endElbowCb = document.getElementById('grid-prop-elbow-end') as HTMLInputElement;
    endElbowCb?.addEventListener('change', () => {
      if (!grid.endElbow) {
        grid.endElbow = { active: endElbowCb.checked, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.endElbow.active = endElbowCb.checked;
      }
      onUpdate(grid);
    });

    document.getElementById('btn-delete-grid-prop')?.addEventListener('click', () => {
      onDelete(grid.id);
      this.showEmptyProperties();
    });

    (document.querySelector('.sidebar-nav-btn[data-sidebar-tab="properties"]') as HTMLElement)?.click();
  }

  public showLevelProperties(
    level: Level,
    onUpdate: (updated: Level) => void,
    onDelete: (id: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = null;

    const db = BimDatabase.getInstance();
    const lvlDoc = db.getLevelByGuid(level.id) || (db.searchAnyById(level.id)?.doc as BimLevelDocument);

    const shortName = level.name.split('(')[0]?.trim() || level.name;
    const elevFormatted = level.elevation.toFixed(2);
    const shortGuid = lvlDoc ? `${lvlDoc.uniqueId.slice(0, 8)}...${lvlDoc.uniqueId.slice(-4)}` : level.id;

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <div class="border-b border-sky-500/30 pb-2">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5">
              <span class="text-sky-400 font-bold text-xs">📐 Nivel BIM (Level Datum)</span>
              <span class="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded font-mono">${LevelQuickGenerator.formatElevation(level.elevation)}</span>
            </div>
            <span class="bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              ID: ${lvlDoc?.elementId || level.id}
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>GUID: <span class="text-slate-300">${shortGuid}</span></span>
            <button id="btn-copy-lvl-guid" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[10px] cursor-pointer">
              📋 Copiar
            </button>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Identidad y Familia</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1.5 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-slate-400">Nombre de Nivel:</span>
            <input id="lvl-name-input" type="text" value="${shortName}" class="w-28 px-2 py-0.5 bg-slate-900 border border-sky-500/40 rounded text-slate-100 text-xs font-bold text-center outline-none focus:border-sky-400" />
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-500">Categoría:</span>
            <span class="text-slate-200">Niveles (OST_Levels)</span>
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-500">Familia:</span>
            <span class="text-slate-200">${lvlDoc?.family || 'Nivel con Cota 8mm'}</span>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cota y Elevación Global</div>
        <div class="bg-slate-950/70 border border-slate-800 rounded p-2 flex flex-col gap-1.5 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-slate-400">Cota Global (Y):</span>
            <div class="flex items-center gap-1">
              <input id="lvl-elev-input" type="number" step="0.1" value="${elevFormatted}" class="w-20 px-2 py-0.5 bg-slate-900 border border-sky-500/40 rounded text-sky-400 text-xs font-mono font-bold text-center outline-none focus:border-sky-400" />
              <span class="text-xs text-slate-400">m</span>
            </div>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Vista de Plano:</span>
            <strong class="${level.hasPlanView ? 'text-sky-400' : 'text-slate-500'} font-medium">
              ${level.hasPlanView ? 'Asociada (Cabezal Azul)' : 'Sin Vista (Cabezal Gris)'}
            </strong>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cabezales y Controles Revit</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded p-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-bubble-start" type="checkbox" ${level.showStartBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Cabezal en Extremo Inicial</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-bubble-end" type="checkbox" ${level.showEndBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Cabezal en Extremo Final</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-0.5">
            <input id="lvl-prop-locked" type="checkbox" ${level.isLocked ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>🔒 Bloquear Alineación con Grupo (Revit Lock)</span>
          </label>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Codo / Quiebre (Level Elbow)</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded p-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-elbow-end" type="checkbox" ${level.endElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>Quiebre de Hombro en Extremo Derecho</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-elbow-start" type="checkbox" ${level.startElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>Quiebre de Hombro en Extremo Izquierdo</span>
          </label>
        </div>

        <div class="pt-2 flex flex-col gap-2">
          <button id="btn-delete-lvl-prop" class="w-full py-1.5 px-3 bg-red-950/50 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5">
            <span>🗑️</span> Eliminar Nivel
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-copy-lvl-guid')?.addEventListener('click', () => {
      if (lvlDoc?.uniqueId) {
        navigator.clipboard.writeText(lvlDoc.uniqueId);
      }
    });

    const nameInput = document.getElementById('lvl-name-input') as HTMLInputElement;
    nameInput?.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) {
        level.name = `${val} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        if (lvlDoc) lvlDoc.name = level.name;
        onUpdate(level);
      }
    });

    const elevInput = document.getElementById('lvl-elev-input') as HTMLInputElement;
    elevInput?.addEventListener('change', () => {
      const val = parseFloat(elevInput.value);
      if (!isNaN(val)) {
        level.elevation = Number(val.toFixed(2));
        const pureName = level.name.split('(')[0]?.trim() || level.name;
        level.name = `${pureName} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        if (lvlDoc) lvlDoc.elevation = level.elevation;
        onUpdate(level);
      }
    });

    const startCb = document.getElementById('lvl-prop-bubble-start') as HTMLInputElement;
    startCb?.addEventListener('change', () => {
      level.showStartBubble = startCb.checked;
      onUpdate(level);
    });

    const endCb = document.getElementById('lvl-prop-bubble-end') as HTMLInputElement;
    endCb?.addEventListener('change', () => {
      level.showEndBubble = endCb.checked;
      onUpdate(level);
    });

    const lockCb = document.getElementById('lvl-prop-locked') as HTMLInputElement;
    lockCb?.addEventListener('change', () => {
      level.isLocked = lockCb.checked;
      onUpdate(level);
    });

    const startElbowCb = document.getElementById('lvl-prop-elbow-start') as HTMLInputElement;
    startElbowCb?.addEventListener('change', () => {
      if (!level.startElbow) {
        level.startElbow = { active: startElbowCb.checked, verticalOffset: 0.8, breakDistance: 3.0 };
      } else {
        level.startElbow.active = startElbowCb.checked;
      }
      onUpdate(level);
    });

    const endElbowCb = document.getElementById('lvl-prop-elbow-end') as HTMLInputElement;
    endElbowCb?.addEventListener('change', () => {
      if (!level.endElbow) {
        level.endElbow = { active: endElbowCb.checked, verticalOffset: 0.8, breakDistance: 3.0 };
      } else {
        level.endElbow.active = endElbowCb.checked;
      }
      onUpdate(level);
    });

    document.getElementById('btn-delete-lvl-prop')?.addEventListener('click', () => {
      onDelete(level.id);
      this.showEmptyProperties();
    });

    (document.querySelector('.sidebar-nav-btn[data-sidebar-tab="properties"]') as HTMLElement)?.click();
  }

  public showEmptyProperties(): void {
    this.currentElement = null;
    this.currentGrid = null;
    this.propContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400 gap-1.5 p-4">
        <div class="text-3xl opacity-40 mb-1">📐</div>
        <p class="font-medium text-slate-300">Ningún elemento seleccionado</p>
        <span class="text-[11px] text-slate-500 leading-relaxed">Selecciona un elemento estructural, rejilla o nivel para ver y editar sus parámetros BIM en tiempo real.</span>
      </div>
    `;
  }
}
