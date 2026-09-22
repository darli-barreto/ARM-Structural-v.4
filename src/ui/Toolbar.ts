import { ToolType } from '../config/structural.config';
import { VisualStyle } from '../config/theme.config';

export class Toolbar {
  public activeTool: ToolType = 'select';
  private toolButtons = ['select', 'zapata', 'columna', 'viga', 'techo'];

  constructor(
    private onToolChange: (tool: ToolType) => void,
    private onAtGrid: () => void,
    private onFullBuilding: () => void,
    private onClear: () => void,
    private onStyleChange: (style: VisualStyle) => void,
    private onToggleGrids: () => void
  ) {
    this.toolButtons.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      btn?.addEventListener('click', () => {
        this.toolButtons.forEach(t => document.getElementById(`tool-${t}`)?.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = tool as ToolType;
        this.onToolChange(this.activeTool);
      });
    });

    document.getElementById('btn-at-grid')?.addEventListener('click', () => this.onAtGrid());
    document.getElementById('btn-full-building')?.addEventListener('click', () => this.onFullBuilding());
    document.getElementById('btn-clear')?.addEventListener('click', () => this.onClear());
    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => this.onToggleGrids());

    const styleSelect = document.getElementById('visual-style-select') as HTMLSelectElement;
    styleSelect?.addEventListener('change', () => {
      this.onStyleChange(styleSelect.value as VisualStyle);
    });
  }

  public setTool(tool: ToolType): void {
    this.toolButtons.forEach(t => document.getElementById(`tool-${t}`)?.classList.remove('active'));
    document.getElementById(`tool-${tool}`)?.classList.add('active');
    this.activeTool = tool;
    this.onToolChange(tool);
  }
}
