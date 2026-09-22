import * as THREE from 'three';
import { GridAxis, GridElement, LEVELS_Y } from '../../config/structural.config';
import { VisualStyle } from '../../config/theme.config';
import { DIMENSIONS } from '../../config/dimensions.config';
import { GridAlignmentHandler } from './interaction/GridAlignmentHandler';
import { GridInlineEditor } from './interaction/GridInlineEditor';
import { GridMath } from './math/GridMath';
import { GridRenderer } from './rendering/GridRenderer';
import { GridSprites } from './rendering/GridSprites';
import { GridStateManager } from './state/GridStateManager';
import {
  BubbleHitProxy,
  BubbleToggleHit,
  ElbowGripHandle,
  ElbowToggleHit,
  GridDisplayMode,
  GripHandle,
} from './types/GridTypes';

/**
 * Facade principal para el sistema de rejillas BIM.
 * Orquesta State, Rendering, Math, Interaction e Inline Editing preservando la API pública sin regresiones.
 */
export class GridFacade {
  private state = new GridStateManager();
  private renderer = new GridRenderer();
  private alignment = new GridAlignmentHandler();
  public inlineEditor = new GridInlineEditor();

  public get group(): THREE.Group {
    return this.renderer.rootGroup;
  }

  public get currentMode(): GridDisplayMode {
    return this.state.currentMode;
  }
  public set currentMode(mode: GridDisplayMode) {
    this.state.currentMode = mode;
  }

  public get activeLevelIdx(): number {
    return this.state.activeLevelIdx;
  }
  public set activeLevelIdx(level: number) {
    this.state.activeLevelIdx = level;
  }

  public get elements(): GridElement[] {
    return this.state.elements;
  }
  public set elements(els: GridElement[]) {
    this.state.elements = els;
  }

  public get axesX(): GridAxis[] {
    return this.state.axesX;
  }
  public set axesX(axes: GridAxis[]) {
    this.state.axesX = axes;
  }

  public get axesZ(): GridAxis[] {
    return this.state.axesZ;
  }
  public set axesZ(axes: GridAxis[]) {
    this.state.axesZ = axes;
  }

  public get selectedGridId(): string | null {
    return this.state.selectedGridId;
  }
  public set selectedGridId(id: string | null) {
    this.state.selectedGridId = id;
  }

  public get hoveredGridId(): string | null {
    return this.state.hoveredGridId;
  }
  public set hoveredGridId(id: string | null) {
    this.state.hoveredGridId = id;
  }

  public get gripHandles(): GripHandle[] {
    return this.renderer.gripHandles;
  }

  public get elbowGrips(): ElbowGripHandle[] {
    return this.renderer.elbowGrips;
  }

  public get elbowToggles(): ElbowToggleHit[] {
    return this.renderer.elbowToggles;
  }

  public get toggleBoxes(): BubbleToggleHit[] {
    return this.renderer.toggleBoxes;
  }

  public get gridHitMeshes(): THREE.Mesh[] {
    return this.renderer.gridHitMeshes;
  }

  public get bubbleHits(): BubbleHitProxy[] {
    return this.renderer.bubbleHits;
  }

  public get bubbleSprites(): THREE.Sprite[] {
    return this.renderer.bubbleSprites;
  }

  public onGridRenamed?: (grid: GridElement) => void;

  public get isDraggingGrip(): boolean {
    return this.alignment.isDraggingGrip;
  }

  public get isDraggingElbowGrip(): boolean {
    return this.alignment.isDraggingElbowGrip;
  }

  public get activeDraggingGrip(): { gridId: string; end: 'start' | 'end' } | null {
    return this.alignment.activeDraggingGrip;
  }

  public get activeDraggingElbow(): { gridId: string; end: 'start' | 'end' } | null {
    return this.alignment.activeDraggingElbow;
  }

  constructor(scene: THREE.Scene) {
    this.rebuildSystem();
    scene.add(this.renderer.rootGroup);
  }

  public loadDefaultTestGrid(): void {
    this.state.loadDefaultTestGrid();
    this.rebuildSystem();
  }

  public hasGrids(): boolean {
    return this.state.hasGrids();
  }

  public clear(): void {
    this.state.clear();
    this.rebuildSystem();
  }

  public getGridX(): number[] {
    return this.state.getGridX();
  }

  public getGridZ(): number[] {
    return this.state.getGridZ();
  }

  public quickGenerate(spacingX: number, spacingZ: number, countX = 5, countZ = 5): void {
    this.state.quickGenerate(spacingX, spacingZ, countX, countZ);
    this.rebuildSystem();
  }

  public applyTemplate(type: '5x5' | '4x4' | '6x6'): void {
    this.state.applyTemplate(type);
    this.rebuildSystem();
  }

  public addGridElement(el: GridElement): GridElement {
    const result = this.state.addGridElement(el);
    this.rebuildSystem();
    return result;
  }

  public addAxis(type: 'x' | 'z', coord: number): GridAxis {
    const result = this.state.addAxis(type, coord);
    this.rebuildSystem();
    return result;
  }

  public rebuildSystem(): void {
    this.renderer.rebuild(
      this.state.elements,
      this.state.selectedGridId,
      this.state.hoveredGridId,
      this.state.activeLevelIdx,
      (grid, end) => this.checkIfEndpointAligned(grid, end)
    );
    this.applyVisibility();
  }

  public restoreAxes(): void { this.state.syncOrthogonalAxes(); }

  public createBubbleSprite(text: string, isHighlighted: boolean, isHovered = false): THREE.Sprite {
    return GridSprites.createBubbleSprite(text, isHighlighted, isHovered);
  }

  public checkIfEndpointAligned(targetGrid: GridElement, end: 'start' | 'end'): boolean {
    return GridMath.isEndpointAligned(targetGrid, end, this.state.elements);
  }

  // --- Manejo de Grips estándar de alineación ---
  public startGripDrag(gridId: string, end: 'start' | 'end'): void {
    const res = this.alignment.startDrag(gridId, end, this.state.elements);
    if (res) {
      this.renderer.showAlignmentGuide(
        res.mainGrid,
        end,
        res.alignedGroup,
        this.state.elements,
        this.state.activeLevelIdx
      );
    }
  }

  public updateGripDrag(cursorPos: { x: number; z: number }): void {
    const res = this.alignment.updateDrag(cursorPos, this.state.elements);
    if (res) {
      this.renderer.showAlignmentGuide(
        res.mainGrid,
        res.activeEnd,
        res.alignedGroup,
        this.state.elements,
        this.state.activeLevelIdx
      );
      this.rebuildSystem();
    }
  }

  public endGripDrag(): void {
    this.alignment.endDrag();
    this.renderer.clearAlignmentGuide();
    this.rebuildSystem();
  }

  // --- Manejo de Codos (Grid Elbow / Jog) ---
  public toggleElbow(gridId: string, end: 'start' | 'end'): void {
    this.state.toggleElbow(gridId, end);
    this.rebuildSystem();
  }

  public startElbowDrag(gridId: string, end: 'start' | 'end'): boolean {
    return this.alignment.startElbowDrag(gridId, end, this.state.elements);
  }

  public updateElbowDrag(cursorPos: { x: number; z: number }): void {
    if (this.alignment.updateElbowDrag(cursorPos, this.state.elements)) {
      this.rebuildSystem();
    }
  }

  public endElbowDrag(): void {
    this.alignment.endElbowDrag();
    this.rebuildSystem();
  }

  // --- Edición interactiva del nombre de la burbuja (Inline Edit) ---
  public renameGrid(gridId: string, newName: string): boolean {
    const ok = this.state.renameGrid(gridId, newName);
    if (ok) this.rebuildSystem();
    return ok;
  }

  public openBubbleRename(
    gridId: string,
    end: 'start' | 'end' | undefined,
    camera: THREE.Camera,
    domElement: HTMLElement,
    onValidationWarning?: (msg: string) => void
  ): boolean {
    const grid = this.state.elements.find(e => e.id === gridId);
    if (!grid) return false;

    const bubbleHit = this.renderer.bubbleHits.find(b => b.gridId === gridId && (!end || b.end === end))
      || this.renderer.bubbleHits.find(b => b.gridId === gridId);

    let worldPos: THREE.Vector3;
    if (bubbleHit) {
      worldPos = bubbleHit.worldPos;
    } else {
      const elbowGeom = GridMath.computeElbowGeometry(grid);
      const pt = end === 'start' ? elbowGeom.startBubblePos : elbowGeom.endBubblePos;
      const elev = (LEVELS_Y[this.state.activeLevelIdx] || 0) + DIMENSIONS.grid.yOffsets.base;
      worldPos = new THREE.Vector3(pt.x, elev + DIMENSIONS.grid.yOffsets.bubble, pt.z);
    }

    this.inlineEditor.open({
      worldPos,
      currentName: grid.name,
      camera,
      domElement,
      existingNames: this.state.elements.map(e => e.name),
      onCommit: (newName: string) => {
        this.renameGrid(gridId, newName);
        const updated = this.state.elements.find(e => e.id === gridId);
        if (updated && this.onGridRenamed) {
          this.onGridRenamed(updated);
        }
      },
      onValidationWarning,
    });
    return true;
  }

  public getLineMeshes(): THREE.Line[] {
    return Array.from(this.renderer.lineMeshMap.values());
  }

  public setHoveredGrid(gridId: string | null): void {
    if (this.state.hoveredGridId === gridId) return;
    const prevId = this.state.hoveredGridId;
    this.state.hoveredGridId = gridId;

    if (prevId && prevId !== this.state.selectedGridId) {
      const prevEl = this.state.elements.find(e => e.id === prevId);
      this.renderer.updateGridVisualState(prevId, false, false, prevEl);
    }
    if (gridId && gridId !== this.state.selectedGridId) {
      const currEl = this.state.elements.find(e => e.id === gridId);
      this.renderer.updateGridVisualState(gridId, false, true, currEl);
    }
  }

  public updateGridVisualState(
    gridId: string,
    isSelected: boolean,
    isHovered: boolean,
    gridElement?: GridElement
  ): void {
    const el = gridElement || this.state.elements.find(e => e.id === gridId);
    this.renderer.updateGridVisualState(gridId, isSelected, isHovered, el);
  }

  public toggleBubble(gridId: string, end: 'start' | 'end'): void {
    this.state.toggleBubble(gridId, end);
    this.rebuildSystem();
  }

  public selectGrid(gridId: string | null): void {
    this.state.selectGrid(gridId);
    this.rebuildSystem();
  }

  public getSelectedGrid(): GridElement | null {
    return this.state.getSelectedGrid();
  }

  public deleteGrid(gridId: string): void {
    this.state.deleteGrid(gridId);
    this.rebuildSystem();
  }

  public highlightAxes(coordX: number | null, coordZ: number | null): void {
    this.clearHighlight();
    if (coordX !== null) {
      const match = this.state.elements.find(
        e => e.geomType === 'line' && Math.abs(e.start.x - coordX) < 0.05 && Math.abs(e.end.x - coordX) < 0.05
      );
      if (match) this.setGridHighlight(match.id, true);
    }
    if (coordZ !== null) {
      const match = this.state.elements.find(
        e => e.geomType === 'line' && Math.abs(e.start.z - coordZ) < 0.05 && Math.abs(e.end.z - coordZ) < 0.05
      );
      if (match) this.setGridHighlight(match.id, true);
    }
  }

  private setGridHighlight(gridId: string, isHigh: boolean): void {
    const line = this.renderer.lineMeshMap.get(gridId);
    if (line) {
      const mat = line.material as THREE.LineDashedMaterial;
      mat.color.set(isHigh ? 0x00e5ff : 0x475569);
      mat.opacity = isHigh ? 1.0 : 0.8;
    }
    const hlMeshes = this.renderer.highlightMeshesMap.get(gridId) || [];
    hlMeshes.forEach(hm => {
      hm.visible = isHigh;
      if (isHigh) {
        const hmMat = hm.material as THREE.MeshBasicMaterial;
        hmMat.color.set(0x00e5ff);
        hmMat.opacity = 0.55;
      }
    });
  }

  public clearHighlight(): void {
    this.state.elements.forEach(el => {
      if (el.id !== this.state.selectedGridId && el.id !== this.state.hoveredGridId) {
        this.setGridHighlight(el.id, false);
      }
    });
  }

  public showGuideLine(coordX: number | null, coordZ: number | null): void {
    this.renderer.showGuideLine(coordX, coordZ, this.state.activeLevelIdx);
  }

  public hideGuideLine(): void {
    this.renderer.hideGuideLine();
  }

  public setDisplayMode(mode: GridDisplayMode, activeLevel = this.state.activeLevelIdx): void {
    this.state.currentMode = mode;
    this.state.activeLevelIdx = activeLevel;
    this.applyVisibility();
  }

  public setActiveLevel(activeLevel: number): void {
    this.state.activeLevelIdx = activeLevel;
    this.rebuildSystem();
  }

  public toggleQuick(): GridDisplayMode {
    if (this.state.currentMode === 'all') this.setDisplayMode('active');
    else if (this.state.currentMode === 'active') this.setDisplayMode('none');
    else this.setDisplayMode('all');
    return this.state.currentMode;
  }

  private applyVisibility(): void {
    this.renderer.rootGroup.visible = this.state.currentMode !== 'none';
  }

  public updateStyle(style: VisualStyle): void {
    this.renderer.updateStyle(style, this.state.selectedGridId);
  }

  public dispose(): void {
    this.inlineEditor.close();
    this.renderer.disposeAll();
  }
}
