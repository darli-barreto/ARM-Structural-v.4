import { BimView } from '../core/views/BimView';
import { SplitLayout, ViewManager } from '../core/views/ViewManager';

export class ViewTabsBar {
  private tabsContainer: HTMLElement;
  private scrollLeftBtn: HTMLButtonElement | null = null;
  private scrollRightBtn: HTMLButtonElement | null = null;
  private overflowBtn: HTMLButtonElement | null = null;
  private overflowMenu: HTMLElement | null = null;
  private countBadge: HTMLElement | null = null;

  constructor(private viewManager: ViewManager) {
    this.tabsContainer = document.getElementById('view-tabs-list')!;
    this.scrollLeftBtn = document.getElementById('tabs-scroll-left') as HTMLButtonElement;
    this.scrollRightBtn = document.getElementById('tabs-scroll-right') as HTMLButtonElement;
    this.overflowBtn = document.getElementById('tabs-overflow-btn') as HTMLButtonElement;
    this.overflowMenu = document.getElementById('tabs-overflow-menu');
    this.countBadge = document.getElementById('tabs-count-badge');

    this.bindScrollEvents();
    this.bindOverflowMenu();
    this.bindLayoutButtons();
  }

  private bindScrollEvents(): void {
    if (!this.tabsContainer) return;

    // Desplazamiento horizontal fluido con la rueda del ratón (wheel)
    this.tabsContainer.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.tabsContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    this.scrollLeftBtn?.addEventListener('click', () => {
      this.tabsContainer.scrollBy({ left: -160, behavior: 'smooth' });
    });

    this.scrollRightBtn?.addEventListener('click', () => {
      this.tabsContainer.scrollBy({ left: 160, behavior: 'smooth' });
    });
  }

  private bindOverflowMenu(): void {
    if (!this.overflowBtn || !this.overflowMenu) return;

    this.overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = this.overflowMenu!.classList.contains('hidden');
      if (isHidden) {
        this.renderOverflowMenu();
        this.overflowMenu!.classList.remove('hidden');
      } else {
        this.overflowMenu!.classList.add('hidden');
      }
    });

    // Cerrar el menú al hacer clic fuera
    document.addEventListener('pointerdown', (e) => {
      if (
        this.overflowMenu &&
        !this.overflowMenu.classList.contains('hidden') &&
        !this.overflowMenu.contains(e.target as Node) &&
        !this.overflowBtn?.contains(e.target as Node)
      ) {
        this.overflowMenu.classList.add('hidden');
      }
    });
  }

  private renderOverflowMenu(): void {
    if (!this.overflowMenu) return;
    const openViews = this.viewManager.getOpenViews();
    const allViews = this.viewManager.getAllViews();
    const activeId = this.viewManager.activeViewId;
    const closedViews = allViews.filter(v => !openViews.some(ov => ov.id === v.id));

    this.overflowMenu.innerHTML = `
      <div class="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex justify-between items-center border-b border-white/10">
        <span>Pestañas en Workspace (${openViews.length})</span>
        <button id="overflow-close-others" class="text-sky-400 hover:text-sky-300 normal-case text-[10px] cursor-pointer" title="Cerrar todas menos la activa">Cerrar otras</button>
      </div>
      <div class="flex flex-col py-1 max-h-40 overflow-y-auto">
        ${openViews.map(v => {
          const isActive = v.id === activeId;
          const icon = v.type === '3d' ? '🧊' : v.type === 'plan' ? '📐' : '🏛️';
          return `
            <div class="overflow-item flex items-center justify-between gap-1 px-2 py-1 cursor-pointer transition-colors ${
              isActive ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }" data-view-id="${v.id}">
              <div class="flex items-center gap-1.5 truncate flex-1 pointer-events-none">
                <span>${icon}</span>
                <span class="truncate">${v.title}</span>
              </div>
              <div class="flex items-center gap-1">
                ${isActive ? '<span class="text-sky-400 text-[10px] font-bold">●</span>' : ''}
                <button class="overflow-close-btn w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 text-[10px]" data-close-id="${v.id}" title="Cerrar pestaña">✕</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${closedViews.length > 0 ? `
        <div class="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-t border-white/10 mt-1">
          Otras vistas del proyecto (${closedViews.length})
        </div>
        <div class="flex flex-col py-1 max-h-36 overflow-y-auto">
          ${closedViews.map(v => {
            const icon = v.type === '3d' ? '🧊' : v.type === 'plan' ? '📐' : '🏛️';
            return `
              <div class="overflow-item flex items-center gap-1.5 px-2 py-1 cursor-pointer text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors" data-view-id="${v.id}" title="Abrir en workspace">
                <span>${icon}</span>
                <span class="truncate">${v.title}</span>
                <span class="ml-auto text-[10px] text-sky-400 opacity-60">Abrir ↗</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    `;

    // Eventos dentro del menú
    this.overflowMenu.querySelectorAll<HTMLElement>('.overflow-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.viewId;
        if (id) {
          this.viewManager.openView(id);
          this.overflowMenu?.classList.add('hidden');
        }
      });
    });

    this.overflowMenu.querySelectorAll<HTMLElement>('.overflow-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.closeId;
        if (id) {
          this.viewManager.closeTab(id);
          this.renderOverflowMenu();
        }
      });
    });

    this.overflowMenu.querySelector('#overflow-close-others')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.viewManager.closeOtherTabs(activeId);
      this.overflowMenu?.classList.add('hidden');
    });
  }

  public renderTabs(openViews: BimView[], activeId: string): void {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = '';

    if (this.countBadge) {
      this.countBadge.textContent = openViews.length.toString();
    }

    openViews.forEach(v => {
      const tab = document.createElement('div');
      const isActive = v.id === activeId;
      const icon = v.type === '3d' ? '🧊' : v.type === 'plan' ? '📐' : '🏛️';

      tab.className = `tab-item flex items-center justify-between gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer select-none transition-all shrink-0 min-w-[135px] max-w-[210px] border group ${
        isActive 
          ? 'bg-slate-800 text-sky-400 font-semibold border-sky-400/80 border-t-2 shadow-sm' 
          : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-white/5'
      }`;

      tab.innerHTML = `
        <div class="flex items-center gap-1.5 truncate flex-1 pointer-events-none">
          <span class="text-xs shrink-0">${icon}</span>
          <span class="tab-title truncate text-[11px]" title="${v.title}">${v.title}</span>
        </div>
        <button class="tab-close-btn w-4 h-4 rounded hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center text-[10px] opacity-60 group-hover:opacity-100 transition-opacity ml-1 cursor-pointer shrink-0" title="Cerrar pestaña">✕</button>
      `;

      // Clic en la pestaña -> activar
      tab.addEventListener('click', () => {
        this.viewManager.openView(v.id);
      });

      // Clic en el botón cerrar -> cerrar pestaña del workspace
      const closeBtn = tab.querySelector<HTMLElement>('.tab-close-btn');
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewManager.closeTab(v.id);
      });

      this.tabsContainer.appendChild(tab);

      // Si es la activa, asegurar que esté en el campo visible
      if (isActive) {
        requestAnimationFrame(() => {
          tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    });
  }

  private bindLayoutButtons(): void {
    const layouts: { id: string; mode: SplitLayout }[] = [
      { id: 'layout-single', mode: 'single' },
      { id: 'layout-split-v', mode: 'split-v' },
      { id: 'layout-split-h', mode: 'split-h' },
      { id: 'layout-grid-4', mode: 'grid-4' },
    ];

    layouts.forEach(l => {
      document.getElementById(l.id)?.addEventListener('click', (e) => {
        layouts.forEach(x => {
          const btn = document.getElementById(x.id);
          if (btn) {
            btn.className = 'layout-btn px-2 py-0.5 rounded text-xs border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-pointer transition-colors';
          }
        });
        const current = e.currentTarget as HTMLElement;
        current.className = 'layout-btn px-2 py-0.5 rounded text-xs border border-sky-400 bg-sky-600 text-white font-medium cursor-pointer transition-colors';
        this.viewManager.setLayout(l.mode);
      });
    });
  }
}

export default ViewTabsBar;
