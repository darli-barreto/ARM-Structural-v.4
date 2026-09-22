import { GridElement } from '../../../config/structural.config';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { GridMath } from '../math/GridMath';
import { AlignedDragItem } from '../types/GridTypes';

export class GridAlignmentHandler {
  public isDraggingGrip = false;
  public activeDraggingGrip: { gridId: string; end: 'start' | 'end' } | null = null;
  public alignedDragGroup: AlignedDragItem[] = [];

  /**
   * Inicia el ciclo de arrastre de grip reconociendo el grupo de grillas alineadas.
   */
  public startDrag(
    gridId: string,
    end: 'start' | 'end',
    elements: GridElement[]
  ): { mainGrid: GridElement; alignedGroup: AlignedDragItem[] } | null {
    this.isDraggingGrip = true;
    this.activeDraggingGrip = { gridId, end };

    const mainGrid = elements.find(e => e.id === gridId);
    if (!mainGrid || mainGrid.geomType !== 'line') {
      this.alignedDragGroup = [];
      return null;
    }

    this.alignedDragGroup = GridMath.findAlignedGroup(mainGrid, end, elements);
    return { mainGrid, alignedGroup: this.alignedDragGroup };
  }

  /**
   * Actualiza las posiciones de los extremos sincronizados durante el arrastre con blindaje anti-colapso.
   */
  public updateDrag(
    cursorPos: { x: number; z: number },
    elements: GridElement[],
    minLength: number = DIMENSIONS.grid.minSegmentLength
  ): { mainGrid: GridElement; alignedGroup: AlignedDragItem[]; activeEnd: 'start' | 'end' } | null {
    if (!this.isDraggingGrip || !this.activeDraggingGrip) return null;

    const mainGrid = elements.find(e => e.id === this.activeDraggingGrip!.gridId);
    if (!mainGrid || mainGrid.geomType !== 'line') return null;

    GridMath.applyDragUpdate(
      mainGrid,
      this.activeDraggingGrip.end,
      this.alignedDragGroup,
      elements,
      cursorPos,
      minLength
    );

    return {
      mainGrid,
      alignedGroup: this.alignedDragGroup,
      activeEnd: this.activeDraggingGrip.end,
    };
  }

  /**
   * Finaliza el arrastre y reinicia los grupos de alineación temporales.
   */
  public endDrag(): void {
    this.isDraggingGrip = false;
    this.activeDraggingGrip = null;
    this.alignedDragGroup = [];
  }

  // --- Soporte para arrastre de codos (Elbows) ---
  public isDraggingElbowGrip = false;
  public activeDraggingElbow: { gridId: string; end: 'start' | 'end' } | null = null;

  public startElbowDrag(gridId: string, end: 'start' | 'end', elements: GridElement[]): boolean {
    const grid = elements.find(e => e.id === gridId);
    if (!grid) return false;
    this.isDraggingElbowGrip = true;
    this.activeDraggingElbow = { gridId, end };
    return true;
  }

  public updateElbowDrag(cursorPos: { x: number; z: number }, elements: GridElement[]): boolean {
    if (!this.isDraggingElbowGrip || !this.activeDraggingElbow) return false;
    const grid = elements.find(e => e.id === this.activeDraggingElbow!.gridId);
    if (!grid || grid.geomType !== 'line') return false;

    const offset = GridMath.calculateElbowLateralOffset(grid, cursorPos);
    if (this.activeDraggingElbow.end === 'start') {
      if (grid.startElbow) {
        grid.startElbow.lateralOffset = offset;
      }
    } else {
      if (grid.endElbow) {
        grid.endElbow.lateralOffset = offset;
      }
    }
    return true;
  }

  public endElbowDrag(): void {
    this.isDraggingElbowGrip = false;
    this.activeDraggingElbow = null;
  }
}

