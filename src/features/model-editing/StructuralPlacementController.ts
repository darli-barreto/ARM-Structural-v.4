import type { ToolType } from '../../config/structural.config';
import type { GridSystem } from '../../core/GridSystem';
import type { PlacementPreview } from '../../tools/PlacementPreview';
import type { SnappingManager } from '../../tools/SnappingManager';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';

export class StructuralPlacementController {
  constructor(
    private snapping: SnappingManager,
    private gridSystem: GridSystem,
    private preview: PlacementPreview,
    private structural: StructuralManager,
    private footer: FooterStatusBar,
    private getActiveTool: () => ToolType,
  ) {}

  public updatePreview(): void {
    const tool = this.getActiveTool();
    const position = this.snapping.currentSnappedPosition;
    if (position && tool !== 'select') {
      const { x, z } = position;
      this.footer.setCoordinates(x, z, this.snapping.activeLevelIdx * 3.5);
      this.gridSystem.highlightAxes(x, z);
      this.gridSystem.hideGuideLine();
      this.preview.update(
        tool,
        x,
        z,
        this.snapping.activeLevelIdx,
        this.gridSystem.getGridX(),
        this.gridSystem.getGridZ(),
      );
      return;
    }

    this.gridSystem.clearHighlight();
    this.gridSystem.hideGuideLine();
    this.preview.hide();
  }

  public placeAtCurrentSnap(): boolean {
    const position = this.snapping.currentSnappedPosition;
    if (!position) return false;
    const tool = this.getActiveTool();
    this.structural.placeSingle(tool, position.x, position.z, this.snapping.activeLevelIdx);
    this.footer.setMessage(`${tool.toUpperCase()} colocado en el modelo.`);
    return true;
  }
}
