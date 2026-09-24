import { ToolType } from '../../config/structural.config';
import { VisualStyle } from '../../config/theme.config';
import type { RibbonAction } from './RibbonActionsBridge';
import { ribbonToolStore } from './RibbonToolStore';

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
  }

  public handleAction(action: RibbonAction): void {
    switch (action.type) {
      case 'tool': this.setTool(action.tool); break;
      case 'at-grid': this.onAtGrid(); break;
      case 'examples': this.onFullBuilding(); break;
      case 'clear': this.onClear(); break;
      case 'visual-style': this.onStyleChange(action.style); break;
      case 'toggle-grids': this.onToggleGrids(); break;
      case 'level': this.onLevelChange(action.levelIdx); break;
    }
  }

  public setTool(tool: ToolType): void {
    this.activeTool = tool;
    ribbonToolStore.setActiveTool(tool);
    this.onToolChange(tool);
  }
}
