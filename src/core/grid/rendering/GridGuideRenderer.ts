import * as THREE from 'three';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { THEME } from '../../../config/theme.config';
import { GridElement, LEVELS_Y } from '../../../config/structural.config';
import { clearThreeGroup } from '../../rendering/ThreeResourceDisposal';
import { AlignedDragItem } from '../types/GridTypes';

export class GridGuideRenderer {
  constructor(
    private readonly alignmentGroup: THREE.Group,
    private readonly guidesGroup: THREE.Group
  ) {}

  public showAlignmentGuide(
    mainGrid: GridElement,
    activeEnd: 'start' | 'end',
    alignedGroup: AlignedDragItem[],
    elements: GridElement[],
    activeLevelIdx: number
  ): void {
    this.clearAlignmentGuide();
    if (alignedGroup.length <= 1 || mainGrid.geomType !== 'line') return;

    const isVert = Math.abs(mainGrid.start.x - mainGrid.end.x) < DIMENSIONS.grid.orthoTolerance;
    const isHoriz = Math.abs(mainGrid.start.z - mainGrid.end.z) < DIMENSIONS.grid.orthoTolerance;
    const elev = (LEVELS_Y[activeLevelIdx] || 0) + DIMENSIONS.grid.yOffsets.alignmentGuide;
    const coords: number[] = [];
    let points: THREE.Vector3[] = [];

    if (isVert) {
      const z = activeEnd === 'start' ? mainGrid.start.z : mainGrid.end.z;
      coords.push(mainGrid.start.x);
      alignedGroup.forEach(item => {
        const grid = elements.find(element => element.id === item.gridId);
        if (grid) coords.push(grid.start.x);
      });
      const validCoords = coords.filter(Number.isFinite);
      const minX = (validCoords.length ? Math.min(...validCoords) : mainGrid.start.x) - DIMENSIONS.grid.alignmentGuideMargin;
      const maxX = (validCoords.length ? Math.max(...validCoords) : mainGrid.start.x) + DIMENSIONS.grid.alignmentGuideMargin;
      points = [new THREE.Vector3(minX, elev, z), new THREE.Vector3(maxX, elev, z)];
    } else if (isHoriz) {
      const x = activeEnd === 'start' ? mainGrid.start.x : mainGrid.end.x;
      coords.push(mainGrid.start.z);
      alignedGroup.forEach(item => {
        const grid = elements.find(element => element.id === item.gridId);
        if (grid) coords.push(grid.start.z);
      });
      const validCoords = coords.filter(Number.isFinite);
      const minZ = (validCoords.length ? Math.min(...validCoords) : mainGrid.start.z) - DIMENSIONS.grid.alignmentGuideMargin;
      const maxZ = (validCoords.length ? Math.max(...validCoords) : mainGrid.start.z) + DIMENSIONS.grid.alignmentGuideMargin;
      points = [new THREE.Vector3(x, elev, minZ), new THREE.Vector3(x, elev, maxZ)];
    }

    if (points.length !== 2 || !Number.isFinite(points[0].x) || !Number.isFinite(points[1].x)) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: THEME.grid.alignmentGuide,
      dashSize: DIMENSIONS.grid.alignmentDashSize,
      gapSize: DIMENSIONS.grid.alignmentGapSize,
      transparent: true,
      opacity: 0.9,
    });
    const guide = new THREE.Line(geometry, material);
    guide.computeLineDistances();
    this.alignmentGroup.add(guide);
  }

  public clearAlignmentGuide(): void {
    this.clearGroup(this.alignmentGroup);
  }

  public showGuideLine(coordX: number | null, coordZ: number | null, activeLevelIdx: number): void {
    this.hideGuideLine();
    const min = -DIMENSIONS.grid.guideLineExtent;
    const max = DIMENSIONS.grid.guideLineExtent;
    const elev = (LEVELS_Y[activeLevelIdx] || 0) + DIMENSIONS.grid.yOffsets.guideLine;
    const points: THREE.Vector3[] = [];

    if (coordX !== null) {
      points.push(new THREE.Vector3(coordX, elev, min), new THREE.Vector3(coordX, elev, max));
    } else if (coordZ !== null) {
      points.push(new THREE.Vector3(min, elev, coordZ), new THREE.Vector3(max, elev, coordZ));
    }

    if (!points.length) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: THEME.grid.alignmentGuide,
      dashSize: DIMENSIONS.grid.guideDashSize,
      gapSize: DIMENSIONS.grid.guideGapSize,
      depthTest: false,
    });
    const guide = new THREE.Line(geometry, material);
    guide.computeLineDistances();
    this.guidesGroup.add(guide);
  }

  public hideGuideLine(): void {
    this.clearGroup(this.guidesGroup);
  }

  private clearGroup(group: THREE.Group): void {
    clearThreeGroup(group);
  }
}
