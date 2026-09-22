import { ToolType } from '../config/structural.config';
import { VisualStyle } from '../config/theme.config';

export class HeaderRibbon {
  public activeTool: ToolType = 'select';

  constructor(
    private onToolChange: (tool: ToolType) => void,
    private onAtGrid: () => void,
    private onFullBuilding: () => void,
    private onClear: () => void,
    private onStyleChange: (style: VisualStyle) => void,
    private onToggleGrids: () => void,
    private onLevelChange: (levelIdx: number) => void
  ) {
    this.bindRibbonTabs();
    this.bindToolButtons();
    this.bindActions();
  }

  private bindRibbonTabs(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.ribbon-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => {
          t.className = 'ribbon-tab-btn px-3.5 py-1.5 text-xs font-semibold rounded-t cursor-pointer border-t-2 border-transparent text-slate-400 hover:text-slate-200';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className = 'ribbon-tab-btn px-3.5 py-1.5 text-xs font-semibold rounded-t cursor-pointer border-t-2 border-sky-400 bg-slate-800 text-slate-100';

        const tabId = target.dataset.tab;
        document.querySelectorAll<HTMLElement>('.ribbon-panel').forEach(p => {
          p.classList.toggle('hidden', p.id !== `panel-${tabId}`);
          p.classList.toggle('flex', p.id === `panel-${tabId}`);
        });
      });
    });
  }

  private bindToolButtons(): void {
    const tools: ToolType[] = ['select', 'grid', 'level', 'zapata', 'columna', 'viga', 'techo'];
    tools.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      btn?.addEventListener('click', () => {
        this.setTool(tool);
      });
    });
  }

  private bindActions(): void {
    document.getElementById('btn-at-grid')?.addEventListener('click', () => this.onAtGrid());
    document.getElementById('btn-full-building')?.addEventListener('click', () => this.onFullBuilding());
    document.getElementById('btn-clear')?.addEventListener('click', () => this.onClear());
    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => this.onToggleGrids());

    const styleSelect = document.getElementById('visual-style-select') as HTMLSelectElement;
    styleSelect?.addEventListener('change', () => this.onStyleChange(styleSelect.value as VisualStyle));

    const levelSelect = document.getElementById('ribbon-level-select') as HTMLSelectElement;
    levelSelect?.addEventListener('change', () => this.onLevelChange(parseInt(levelSelect.value)));
  }

  public setTool(tool: ToolType): void {
    const tools: ToolType[] = ['select', 'grid', 'level', 'zapata', 'columna', 'viga', 'techo'];
    tools.forEach(t => {
      const b = document.getElementById(`tool-${t}`);
      if (b) {
        b.className = 'ribbon-btn flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md min-w-[54px] h-[52px] text-[11px] font-medium transition-all text-slate-200 border border-transparent hover:bg-white/5 hover:border-white/10';
      }
    });

    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
      activeBtn.className = 'ribbon-btn flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md min-w-[54px] h-[52px] text-[11px] font-medium transition-all bg-sky-600 text-white border border-sky-400 shadow-sm';
    }

    this.activeTool = tool;
    this.onToolChange(tool);
  }
}