import * as THREE from 'three';
import { DIMENSIONS } from '../config/dimensions.config';
import type { GridElement } from '../config/structural.config';
import type { GridSystem } from '../core/GridSystem';
import type { ElementRegistry } from './structural/ElementRegistry';
import { calculateOffsetLine, distanceToSegment, generateNextGridName } from './GridDrawingGeometry';
import type { GridDrawingPreviewRenderer } from './GridDrawingPreviewRenderer';

interface GridEdge {
  start: THREE.Vector2;
  end: THREE.Vector2;
}

interface CandidateGridEdge extends GridEdge {
  distance: number;
}

export class GridPickLineController {
  private candidateEdges: GridEdge[] = [];
  private candidateIndex = 0;
  private hoveredEdge: GridEdge | null = null;

  constructor(
    private readonly registry: ElementRegistry,
    private readonly gridSystem: GridSystem,
    private readonly previewRenderer: GridDrawingPreviewRenderer,
    private readonly onStatusMessage: (message: string) => void,
  ) {}

  public updatePreview(cursor: THREE.Vector2, elev: number, offset: number): void {
    this.detectCandidateEdges(cursor);
    if (!this.hoveredEdge) {
      this.previewRenderer.clear();
      return;
    }

    const line = calculateOffsetLine(this.hoveredEdge.start, this.hoveredEdge.end, cursor, offset);
    this.previewRenderer.renderPickedLine(line, elev, offset);
  }

  public placeGrid(cursor: THREE.Vector2, offset: number): boolean {
    if (!this.hoveredEdge) return false;

    const line = calculateOffsetLine(this.hoveredEdge.start, this.hoveredEdge.end, cursor, offset);
    const name = generateNextGridName(line.p1, line.p2, this.gridSystem.elements.map(grid => grid.name));
    const grid: GridElement = {
      id: `grid-pick-${Date.now()}`,
      name,
      geomType: 'line',
      start: { x: line.p1.x, z: line.p1.y },
      end: { x: line.p2.x, z: line.p2.y },
      showStartBubble: true,
      showEndBubble: true,
      isLocked: true,
    };
    this.gridSystem.addGridElement(grid);
    this.onStatusMessage(`Rejilla ${name} creada desde referencia con desfase.`);
    return true;
  }

  public cycleCandidate(): void {
    if (this.candidateEdges.length <= 1) return;

    this.candidateIndex = (this.candidateIndex + 1) % this.candidateEdges.length;
    this.hoveredEdge = this.candidateEdges[this.candidateIndex];
    this.onStatusMessage(`Arista candidata cambiada [Tab] (${this.candidateIndex + 1}/${this.candidateEdges.length})`);
  }

  public clearHoveredEdge(): void {
    this.hoveredEdge = null;
  }

  private detectCandidateEdges(cursor: THREE.Vector2): void {
    const candidates: CandidateGridEdge[] = [];
    this.addStructuralEdges(cursor, candidates);
    this.addExistingGridEdges(cursor, candidates);
    candidates.sort((a, b) => a.distance - b.distance);
    this.candidateEdges = candidates.map(({ start, end }) => ({ start, end }));
    this.hoveredEdge = this.candidateEdges.length
      ? this.candidateEdges[this.candidateIndex % this.candidateEdges.length]
      : null;
  }

  private addStructuralEdges(cursor: THREE.Vector2, candidates: CandidateGridEdge[]): void {
    this.registry.getMeshes().forEach(mesh => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;

      const worldBox = box.clone().applyMatrix4(mesh.matrixWorld);
      const minX = worldBox.min.x;
      const maxX = worldBox.max.x;
      const minZ = worldBox.min.z;
      const maxZ = worldBox.max.z;
      const edges: GridEdge[] = [
        { start: new THREE.Vector2(minX, minZ), end: new THREE.Vector2(maxX, minZ) },
        { start: new THREE.Vector2(maxX, minZ), end: new THREE.Vector2(maxX, maxZ) },
        { start: new THREE.Vector2(maxX, maxZ), end: new THREE.Vector2(minX, maxZ) },
        { start: new THREE.Vector2(minX, maxZ), end: new THREE.Vector2(minX, minZ) },
      ];
      this.addNearbyEdges(cursor, edges, candidates);
    });
  }

  private addExistingGridEdges(cursor: THREE.Vector2, candidates: CandidateGridEdge[]): void {
    const edges = this.gridSystem.elements
      .filter(grid => grid.geomType === 'line')
      .map(grid => ({
        start: new THREE.Vector2(grid.start.x, grid.start.z),
        end: new THREE.Vector2(grid.end.x, grid.end.z),
      }));
    this.addNearbyEdges(cursor, edges, candidates);
  }

  private addNearbyEdges(cursor: THREE.Vector2, edges: GridEdge[], candidates: CandidateGridEdge[]): void {
    for (const edge of edges) {
      const distance = distanceToSegment(cursor, edge.start, edge.end);
      if (distance < DIMENSIONS.drawing.pickLinesThreshold) candidates.push({ ...edge, distance });
    }
  }
}
