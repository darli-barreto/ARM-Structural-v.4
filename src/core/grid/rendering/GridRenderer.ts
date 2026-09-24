import * as THREE from 'three';
import { GridElement, LEVELS_Y } from '../../../config/structural.config';
import { clearThreeGroup } from '../../rendering/ThreeResourceDisposal';
import { VisualStyle, THEME } from '../../../config/theme.config';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { GridMath } from '../math/GridMath';
import {
  AlignedDragItem,
  BubbleHitProxy,
  BubbleToggleHit,
  ElbowGripHandle,
  ElbowToggleHit,
  GridRenderBundle,
  GripHandle,
} from '../types/GridTypes';
import { GridGuideRenderer } from './GridGuideRenderer';
import { GridEndpointRenderer } from './GridEndpointRenderer';
import { GridSegmentRenderer } from './GridSegmentRenderer';
import { GridSprites } from './GridSprites';

export class GridRenderer {
  public rootGroup = new THREE.Group();

  public linesGroup = new THREE.Group();
  public bubblesGroup = new THREE.Group();
  public guidesGroup = new THREE.Group();
  public gripsGroup = new THREE.Group();
  public togglesGroup = new THREE.Group();
  public elbowsGroup = new THREE.Group();
  public alignmentGroup = new THREE.Group();
  public hitProxiesGroup = new THREE.Group();
  public highlightsGroup = new THREE.Group();

  public lineMeshMap = new Map<string, THREE.Line>();
  public highlightMeshesMap = new Map<string, THREE.Mesh[]>();
  public bubbleSpritesMap = new Map<string, { start?: THREE.Sprite; end?: THREE.Sprite }>();
  public bubbleSprites: THREE.Sprite[] = [];
  private guideRenderer: GridGuideRenderer;
  public gripHandles: GripHandle[] = [];
  public elbowGrips: ElbowGripHandle[] = [];
  public elbowToggles: ElbowToggleHit[] = [];
  public toggleBoxes: BubbleToggleHit[] = [];
  public gridHitMeshes: THREE.Mesh[] = [];
  public bubbleHits: BubbleHitProxy[] = [];
  private segmentRenderer: GridSegmentRenderer;
  private endpointRenderer: GridEndpointRenderer;

  constructor() {
    this.rootGroup.name = 'BimGridSystem';
    this.rootGroup.add(this.highlightsGroup);
    this.rootGroup.add(this.linesGroup);
    this.rootGroup.add(this.bubblesGroup);
    this.rootGroup.add(this.guidesGroup);
    this.rootGroup.add(this.gripsGroup);
    this.rootGroup.add(this.togglesGroup);
    this.rootGroup.add(this.elbowsGroup);
    this.rootGroup.add(this.alignmentGroup);
    this.rootGroup.add(this.hitProxiesGroup);
    this.guideRenderer = new GridGuideRenderer(this.alignmentGroup, this.guidesGroup);
    this.segmentRenderer = new GridSegmentRenderer(this.hitProxiesGroup, this.highlightsGroup);
    this.endpointRenderer = new GridEndpointRenderer({
      bubblesGroup: this.bubblesGroup,
      hitProxiesGroup: this.hitProxiesGroup,
      gripsGroup: this.gripsGroup,
      togglesGroup: this.togglesGroup,
      elbowsGroup: this.elbowsGroup,
      getState: () => ({
        bubbleSprites: this.bubbleSprites,
        gridHitMeshes: this.gridHitMeshes,
        bubbleHits: this.bubbleHits,
        gripHandles: this.gripHandles,
        elbowGrips: this.elbowGrips,
        elbowToggles: this.elbowToggles,
        toggleBoxes: this.toggleBoxes,
      }),
    });
  }

  /**
   * Reconstruye todos los elementos gráficos en el grafo de escena Three.js.
   */
  public rebuild(
    elements: GridElement[],
    selectedGridId: string | null,
    hoveredGridId: string | null,
    activeLevelIdx: number,
    checkAlignedFn: (grid: GridElement, end: 'start' | 'end') => boolean
  ): GridRenderBundle {
    this.clearLines();
    this.clearBubbles();
    this.clearHighlights();
    this.clearHitProxies();
    this.clearGripsAndToggles();
    this.clearElbows();

    const elev = (LEVELS_Y[activeLevelIdx] || 0) + DIMENSIONS.grid.yOffsets.base;

    elements.forEach(grid => {
      const isSelected = selectedGridId === grid.id;
      const isHovered = hoveredGridId === grid.id;
      const lineColor = isSelected
        ? THEME.grid.lineActive
        : isHovered
        ? THEME.grid.lineHover
        : THEME.grid.lineDefault;
      const lineWidth = isSelected
        ? DIMENSIONS.grid.lineWidthSelected
        : isHovered
        ? DIMENSIONS.grid.lineWidthHovered
        : DIMENSIONS.grid.lineWidthDefault;

      let lineMesh: THREE.Line;
      const bubbleRecord: { start?: THREE.Sprite; end?: THREE.Sprite } = {};
      if (grid.geomType === 'line') {
        const elbowGeom = GridMath.computeElbowGeometry(grid);
        const polyPoints = elbowGeom.points;

        const pts3D = polyPoints.map(p => new THREE.Vector3(p.x, elev, p.z));
        const geom = new THREE.BufferGeometry().setFromPoints(pts3D);
        const mat = new THREE.LineDashedMaterial({
          color: lineColor,
          dashSize: DIMENSIONS.grid.dashSize,
          gapSize: DIMENSIONS.grid.gapSize,
          linewidth: lineWidth,
          transparent: true,
          opacity: isSelected || isHovered ? 1.0 : 0.8,
        });
        lineMesh = new THREE.Line(geom, mat);
        lineMesh.name = grid.id;
        lineMesh.computeLineDistances();
        this.linesGroup.add(lineMesh);

        const segments = this.segmentRenderer.renderInteractiveSegments(
          pts3D,
          1,
          grid.id,
          elev,
          isSelected,
          isHovered
        );
        this.gridHitMeshes.push(...segments.hitMeshes);
        this.highlightMeshesMap.set(grid.id, segments.highlightMeshes);

        const dx = grid.end.x - grid.start.x;
        const dz = grid.end.z - grid.start.z;
        const len = Math.hypot(dx, dz) || 1.0;
        const ux = dx / len;
        const uz = dz / len;

        // Burbuja inicio
        if (grid.showStartBubble) {
          bubbleRecord.start = this.endpointRenderer.renderBubble(
            grid, 'start', elbowGeom.startBubblePos, elev, isSelected, isHovered,
          );
        }

        // Burbuja fin
        if (grid.showEndBubble) {
          bubbleRecord.end = this.endpointRenderer.renderBubble(
            grid, 'end', elbowGeom.endBubblePos, elev, isSelected, isHovered,
          );
        }

        // Controles al estar seleccionado
        if (isSelected) {
          // 1. Grips estándar de alineación en los extremos
          this.endpointRenderer.createGripAndToggle(grid, 'start', grid.start, -ux, -uz, elev, checkAlignedFn(grid, 'start'));
          this.endpointRenderer.createGripAndToggle(grid, 'end', grid.end, ux, uz, elev, checkAlignedFn(grid, 'end'));

          // 2. Iconos interactivos de Codo (Grid Elbow / Jog estilo Revit)
          if (grid.showStartBubble) {
            this.endpointRenderer.createElbowToggleIcon(grid, 'start', elbowGeom.startIconPos, elev, !!grid.startElbow?.active);
          }
          if (grid.showEndBubble) {
            this.endpointRenderer.createElbowToggleIcon(grid, 'end', elbowGeom.endIconPos, elev, !!grid.endElbow?.active);
          }

          // 3. Grips arrastrables en las rodillas del codo (si está activo)
          if (grid.startElbow?.active && elbowGeom.startElbowGripPos) {
            this.endpointRenderer.createElbowGripHandle(grid, 'start', elbowGeom.startElbowGripPos, elev);
          }
          if (grid.endElbow?.active && elbowGeom.endElbowGripPos) {
            this.endpointRenderer.createElbowGripHandle(grid, 'end', elbowGeom.endElbowGripPos, elev);
          }
        }
      } else {
        // Arco
        const center = grid.center || { x: 0, z: 0 };
        const radius = Math.max(0.5, grid.radius || 10);
        const startAng = grid.startAngle || 0;
        const endAng = grid.endAngle || Math.PI;

        const curve = new THREE.EllipseCurve(
          center.x,
          center.z,
          radius,
          radius,
          startAng,
          endAng,
          grid.clockwise || false,
          0
        );

        const curvePts2D = curve.getPoints(DIMENSIONS.grid.arcSegments);
        const curvePts3D = curvePts2D.map(p => new THREE.Vector3(p.x, elev, p.y));
        const geom = new THREE.BufferGeometry().setFromPoints(curvePts3D);
        const mat = new THREE.LineDashedMaterial({
          color: lineColor,
          dashSize: DIMENSIONS.grid.dashSize,
          gapSize: DIMENSIONS.grid.gapSize,
          linewidth: lineWidth,
          transparent: true,
          opacity: isSelected || isHovered ? 1.0 : 0.8,
        });
        lineMesh = new THREE.Line(geom, mat);
        lineMesh.name = grid.id;
        lineMesh.computeLineDistances();
        this.linesGroup.add(lineMesh);

        const segments = this.segmentRenderer.renderInteractiveSegments(
          curvePts3D,
          4,
          grid.id,
          elev,
          isSelected,
          isHovered
        );
        this.gridHitMeshes.push(...segments.hitMeshes);
        this.highlightMeshesMap.set(grid.id, segments.highlightMeshes);

        const pStart = curvePts3D[0];
        const pEnd = curvePts3D[curvePts3D.length - 1];

        if (grid.showStartBubble && pStart) {
          bubbleRecord.start = this.endpointRenderer.renderBubble(
            grid, 'start', pStart, elev, isSelected, isHovered,
          );
        }

        if (grid.showEndBubble && pEnd) {
          bubbleRecord.end = this.endpointRenderer.renderBubble(
            grid, 'end', pEnd, elev, isSelected, isHovered,
          );
        }

        if (isSelected && pStart && pEnd) {
          this.endpointRenderer.createGripAndToggle(grid, 'start', { x: pStart.x, z: pStart.z }, 0, 0, elev, false);
          this.endpointRenderer.createGripAndToggle(grid, 'end', { x: pEnd.x, z: pEnd.z }, 0, 0, elev, false);
        }
      }

      this.lineMeshMap.set(grid.id, lineMesh);
      this.bubbleSpritesMap.set(grid.id, bubbleRecord);
    });

    return {
      lineMeshMap: this.lineMeshMap,
      bubbleSpritesMap: this.bubbleSpritesMap,
      gripHandles: this.gripHandles,
      elbowGrips: this.elbowGrips,
      elbowToggles: this.elbowToggles,
      toggleBoxes: this.toggleBoxes,
      gridHitMeshes: this.gridHitMeshes,
      bubbleHits: this.bubbleHits,
    };
  }

  public showAlignmentGuide(
    mainGrid: GridElement,
    activeEnd: 'start' | 'end',
    alignedGroup: AlignedDragItem[],
    elements: GridElement[],
    activeLevelIdx: number
  ): void {
    this.guideRenderer.showAlignmentGuide(mainGrid, activeEnd, alignedGroup, elements, activeLevelIdx);
  }

  public clearAlignmentGuide(): void {
    this.guideRenderer.clearAlignmentGuide();
  }

  public showGuideLine(coordX: number | null, coordZ: number | null, activeLevelIdx: number): void {
    this.guideRenderer.showGuideLine(coordX, coordZ, activeLevelIdx);
  }

  public hideGuideLine(): void {
    this.guideRenderer.hideGuideLine();
  }

  /**
   * Actualiza el estado visual de la grilla (línea y burbujas) ante eventos de hover y selección.
   */
  public updateGridVisualState(
    gridId: string,
    isSelected: boolean,
    isHovered: boolean,
    gridElement?: GridElement
  ): void {
    const line = this.lineMeshMap.get(gridId);
    if (line) {
      const mat = line.material as THREE.LineDashedMaterial;
      if (isSelected) {
        mat.color.set(THEME.grid.lineActive);
        mat.opacity = 1.0;
      } else if (isHovered) {
        mat.color.set(THEME.grid.lineHover);
        mat.opacity = 1.0;
      } else {
        mat.color.set(THEME.grid.lineDefault);
        mat.opacity = 0.8;
      }
    }

    // Actualizar resalte luminoso del tramo dasheado (Halo Glow)
    const hlMeshes = this.highlightMeshesMap.get(gridId) || [];
    hlMeshes.forEach(hm => {
      hm.visible = isSelected || isHovered;
      if (isSelected || isHovered) {
        const hmMat = hm.material as THREE.MeshBasicMaterial;
        hmMat.color.set(isSelected ? THEME.grid.lineActive : THEME.grid.lineHover);
        hmMat.opacity = isSelected ? 0.4 : 0.55;
      }
    });

    // Actualizar textura de las burbujas para responder visualmente al hover
    const bubbles = this.bubbleSpritesMap.get(gridId);
    if (bubbles && gridElement) {
      if (bubbles.start) {
        const newSprite = GridSprites.createBubbleSprite(gridElement.name, isSelected, isHovered);
        const oldMat = bubbles.start.material;
        oldMat.map?.dispose();
        bubbles.start.material = newSprite.material;
      }
      if (bubbles.end) {
        const newSprite = GridSprites.createBubbleSprite(gridElement.name, isSelected, isHovered);
        const oldMat = bubbles.end.material;
        oldMat.map?.dispose();
        bubbles.end.material = newSprite.material;
      }
    }
  }

  public updateStyle(style: VisualStyle, selectedGridId: string | null): void {
    const isLight = style === 'hidden_line' || style === 'wireframe' || style === 'consistent_colors';
    const color = isLight ? THEME.grid.lineDefaultLight : THEME.grid.lineDefault;

    this.linesGroup.children.forEach(c => {
      const line = c as THREE.Line;
      if (line.name !== selectedGridId) {
        (line.material as THREE.LineDashedMaterial).color.set(color);
      }
    });
  }

  private clearLines(): void {
    clearThreeGroup(this.linesGroup);
    this.lineMeshMap.clear();
  }

  private clearHighlights(): void {
    clearThreeGroup(this.highlightsGroup);
    this.highlightMeshesMap.clear();
  }

  private clearBubbles(): void {
    clearThreeGroup(this.bubblesGroup);
    this.bubbleSpritesMap.clear();
    this.bubbleSprites = [];
  }

  private clearHitProxies(): void {
    clearThreeGroup(this.hitProxiesGroup);
    this.gridHitMeshes = [];
    this.bubbleHits = [];
  }

  private clearElbows(): void {
    clearThreeGroup(this.elbowsGroup);
    this.elbowToggles = [];
    this.elbowGrips = [];
  }

  private clearGripsAndToggles(): void {
    clearThreeGroup(this.gripsGroup);
    this.gripHandles = [];
    clearThreeGroup(this.togglesGroup);
    this.toggleBoxes = [];
  }

  public disposeAll(): void {
    this.clearLines();
    this.clearHighlights();
    this.clearBubbles();
    this.clearHitProxies();
    this.clearGripsAndToggles();
    this.clearElbows();
    this.clearAlignmentGuide();
    this.hideGuideLine();
  }
}
