import { BimDatabase } from '../core/database/BimDatabase';

export class MongoInspectorModal {
  private container: HTMLElement;
  private activeCollection: 'elements' | 'grids' | 'levels' | 'types' = 'elements';

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'bim-mongo-inspector-modal';
    this.container.className =
      'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden';
    document.body.appendChild(this.container);

    this.render();
  }

  public open(): void {
    this.container.classList.remove('hidden');
    this.renderContent();
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <!-- HEADER -->
        <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-lg">
              🍃
            </div>
            <div>
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                Inspector de Base de Datos MongoDB / OpenBIM
                <span class="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">BSON Relational Schema</span>
              </h2>
              <p class="text-[11px] text-slate-400">Estructura de colecciones y esquemas JSON orientados a objetos con GUID e identificadores únicos</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-mongo-copy-cli" class="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>📋</span> Copiar 'mongoimport' CLI
            </button>
            <button id="btn-mongo-download-dump" class="px-2.5 py-1 text-xs font-semibold bg-emerald-900/70 hover:bg-emerald-800 text-emerald-100 border border-emerald-600 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>💾</span> Descargar Dump BSON
            </button>
            <button id="btn-mongo-close" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 text-base leading-none cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- TABS DE COLECCIONES Y ESTADÍSTICAS -->
        <div class="px-5 py-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div class="flex items-center gap-1.5" id="mongo-collection-tabs">
            <button data-collection="elements" class="mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white cursor-pointer transition-colors">
              db.elements (<span id="count-elements">0</span>)
            </button>
            <button data-collection="grids" class="mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
              db.grids (<span id="count-grids">0</span>)
            </button>
            <button data-collection="levels" class="mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
              db.levels (<span id="count-levels">0</span>)
            </button>
            <button data-collection="types" class="mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
              db.types (<span id="count-types">4</span>)
            </button>
          </div>

          <div class="text-[11px] text-slate-400 font-mono">
            Database: <span class="text-emerald-400 font-bold">bim_structural_db</span>
          </div>
        </div>

        <!-- COMANDO MONGOIMPORT DISPLAY -->
        <div class="px-5 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 text-xs font-mono text-slate-400">
          <span class="text-emerald-400 font-bold">$</span>
          <code id="mongo-cli-command" class="text-slate-300 select-all overflow-x-auto whitespace-nowrap">mongoimport --uri="mongodb://localhost:27017/bim_structural_db" --collection=elements --file=bim_mongodb_export.json --jsonArray</code>
        </div>

        <!-- VISOR JSON BSON -->
        <div class="flex-1 overflow-auto p-4 bg-slate-950">
          <pre id="mongo-json-viewer" class="text-xs font-mono text-emerald-300 leading-relaxed overflow-auto"></pre>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('btn-mongo-close')?.addEventListener('click', () => this.close());

    this.container.querySelectorAll<HTMLButtonElement>('.mongo-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll<HTMLButtonElement>('.mongo-tab-btn').forEach((b) => {
          b.className =
            'mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors';
        });
        btn.className =
          'mongo-tab-btn px-3 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white cursor-pointer transition-colors';
        this.activeCollection = btn.dataset.collection as any;
        this.renderContent();
      });
    });

    document.getElementById('btn-mongo-copy-cli')?.addEventListener('click', () => {
      const code = document.getElementById('mongo-cli-command')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code);
        const btn = document.getElementById('btn-mongo-copy-cli');
        if (btn) {
          btn.innerHTML = '<span>✓</span> ¡Copiado!';
          setTimeout(() => (btn.innerHTML = `<span>📋</span> Copiar 'mongoimport' CLI`), 2000);
        }
      }
    });

    document.getElementById('btn-mongo-download-dump')?.addEventListener('click', () => {
      const json = BimDatabase.getInstance().exportMongoDump();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bim_mongodb_export.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  private renderContent(): void {
    const dumpRaw = BimDatabase.getInstance().exportMongoDump();
    const parsed = JSON.parse(dumpRaw);

    // Contadores
    const countEl = document.getElementById('count-elements');
    if (countEl) countEl.textContent = parsed.collections.elements.length.toString();

    const countGr = document.getElementById('count-grids');
    if (countGr) countGr.textContent = parsed.collections.grids.length.toString();

    const countLv = document.getElementById('count-levels');
    if (countLv) countLv.textContent = parsed.collections.levels.length.toString();

    const countTy = document.getElementById('count-types');
    if (countTy) countTy.textContent = (parsed.collections.types?.length || 0).toString();

    // Actualizar CLI command
    const cliEl = document.getElementById('mongo-cli-command');
    if (cliEl) {
      cliEl.textContent = `mongoimport --uri="mongodb://localhost:27017/bim_structural_db" --collection=${this.activeCollection} --file=bim_mongodb_export.json --jsonArray`;
    }

    // Renderizar colección activa
    const collectionData = parsed.collections[this.activeCollection] || [];
    const viewer = document.getElementById('mongo-json-viewer');
    if (viewer) {
      viewer.textContent = JSON.stringify(collectionData, null, 2);
    }
  }
}
