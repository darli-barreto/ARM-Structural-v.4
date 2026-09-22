import * as THREE from 'three';
import { GridElement, LEVELS_Y } from '../../../config/structural.config';
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
  public gripHandles: GripHandle[] = [];
  public elbowGrips: ElbowGripHandle[] = [];
  public elbowToggles: ElbowToggleHit[] = [];
  public toggleBoxes: BubbleToggleHit[] = [];
  public gridHitMeshes: THREE.Mesh[] = [];
  public bubbleHits: BubbleHitProxy[] = [];

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
      const hlMeshes: THREE.Mesh[] = [];

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

        // Mallas de colisión y bandas de resalte luminoso (Halo Glow para el tramo dasheado)
        for (let i = 0; i < polyPoints.length - 1; i++) {
          const pA = polyPoints[i];
          const pB = polyPoints[i + 1];
          const segDx = pB.x - pA.x;
          const segDz = pB.z - pA.z;
          const segLen = Math.hypot(segDx, segDz);
          if (segLen > 0.05) {
            // Hitbox interactiva (2.2m de ancho para fácil detección de hover y clic)
            const hitGeom = new THREE.PlaneGeometry(
              segLen + DIMENSIONS.grid.hitboxLengthPadding,
              DIMENSIONS.grid.hitboxWidth
            );
            hitGeom.rotateX(-Math.PI / 2);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
            const hitMesh = new THREE.Mesh(hitGeom, hitMat);
            hitMesh.position.set(
              (pA.x + pB.x) / 2,
              elev + DIMENSIONS.grid.yOffsets.hitbox,
              (pA.z + pB.z) / 2
            );
            hitMesh.rotation.y = -Math.atan2(segDz, segDx);
            hitMesh.userData = { isGridLineHit: true, gridId: grid.id };
            this.hitProxiesGroup.add(hitMesh);
            this.gridHitMeshes.push(hitMesh);

            // Resalte luminoso del tramo (Glow underlay debajo del dasheado)
            const hlGeom = new THREE.PlaneGeometry(segLen, DIMENSIONS.grid.glowWidth);
            hlGeom.rotateX(-Math.PI / 2);
            const hlMat = new THREE.MeshBasicMaterial({
              color: isSelected ? THEME.grid.lineActive : THEME.grid.lineHover,
              transparent: true,
              opacity: isSelected ? 0.4 : isHovered ? 0.55 : 0,
              depthTest: false,
              side: THREE.DoubleSide,
            });
            const hlMesh = new THREE.Mesh(hlGeom, hlMat);
            hlMesh.position.set(
              (pA.x + pB.x) / 2,
              elev + DIMENSIONS.grid.yOffsets.glow,
              (pA.z + pB.z) / 2
            );
            hlMesh.rotation.y = -Math.atan2(segDz, segDx);
            hlMesh.visible = isSelected || isHovered;
            hlMesh.renderOrder = DIMENSIONS.renderOrders.gridLine;
            this.highlightsGroup.add(hlMesh);
            hlMeshes.push(hlMesh);
          }
        }
        this.highlightMeshesMap.set(grid.id, hlMeshes);

        const dx = grid.end.x - grid.start.x;
        const dz = grid.end.z - grid.start.z;
        const len = Math.hypot(dx, dz) || 1.0;
        const ux = dx / len;
        const uz = dz / len;

        // Burbuja inicio
        if (grid.showStartBubble) {
          const spStart = GridSprites.createBubbleSprite(grid.name, isSelected, isHovered);
          spStart.position.set(
            elbowGeom.startBubblePos.x,
            elev + DIMENSIONS.grid.yOffsets.bubble,
            elbowGeom.startBubblePos.z
          );
          spStart.userData = { isGridLineHit: true, isBubbleHit: true, gridId: grid.id, end: 'start' };
          this.bubblesGroup.add(spStart);
          this.bubbleSprites.push(spStart);
          bubbleRecord.start = spStart;

          const bHit = this.createBubbleHitMesh(
            elbowGeom.startBubblePos.x,
            elev + DIMENSIONS.grid.yOffsets.bubbleHit,
            elbowGeom.startBubblePos.z,
            grid.id,
            'start'
          );
          this.hitProxiesGroup.add(bHit);
          this.gridHitMeshes.push(bHit);
          this.bubbleHits.push({
            gridId: grid.id,
            end: 'start',
            mesh: bHit,
            worldPos: new THREE.Vector3(
              elbowGeom.startBubblePos.x,
              elev + DIMENSIONS.grid.yOffsets.bubble,
              elbowGeom.startBubblePos.z
            ),
          });
        }

        // Burbuja fin
        if (grid.showEndBubble) {
          const spEnd = GridSprites.createBubbleSprite(grid.name, isSelected, isHovered);
          spEnd.position.set(
            elbowGeom.endBubblePos.x,
            elev + DIMENSIONS.grid.yOffsets.bubble,
            elbowGeom.endBubblePos.z
          );
          spEnd.userData = { isGridLineHit: true, isBubbleHit: true, gridId: grid.id, end: 'end' };
          this.bubblesGroup.add(spEnd);
          this.bubbleSprites.push(spEnd);
          bubbleRecord.end = spEnd;

          const bHit = this.createBubbleHitMesh(
            elbowGeom.endBubblePos.x,
            elev + DIMENSIONS.grid.yOffsets.bubbleHit,
            elbowGeom.endBubblePos.z,
            grid.id,
            'end'
          );
          this.hitProxiesGroup.add(bHit);
          this.gridHitMeshes.push(bHit);
          this.bubbleHits.push({
            gridId: grid.id,
            end: 'end',
            mesh: bHit,
            worldPos: new THREE.Vector3(
              elbowGeom.endBubblePos.x,
              elev + DIMENSIONS.grid.yOffsets.bubble,
              elbowGeom.endBubblePos.z
            ),
          });
        }

        // Controles al estar seleccionado
        if (isSelected) {
          // 1. Grips estándar de alineación en los extremos
          this.createGripAndToggle(grid, 'start', grid.start, -ux, -uz, elev, checkAlignedFn(grid, 'start'));
          this.createGripAndToggle(grid, 'end', grid.end, ux, uz, elev, checkAlignedFn(grid, 'end'));

          // 2. Iconos interactivos de Codo (Grid Elbow / Jog estilo Revit)
          if (grid.showStartBubble) {
            this.createElbowToggleIcon(grid, 'start', elbowGeom.startIconPos, elev, !!grid.startElbow?.active);
          }
          if (grid.showEndBubble) {
            this.createElbowToggleIcon(grid, 'end', elbowGeom.endIconPos, elev, !!grid.endElbow?.active);
          }

          // 3. Grips arrastrables en las rodillas del codo (si está activo)
          if (grid.startElbow?.active && elbowGeom.startElbowGripPos) {
            this.createElbowGripHandle(grid, 'start', elbowGeom.startElbowGripPos, elev);
          }
          if (grid.endElbow?.active && elbowGeom.endElbowGripPos) {
            this.createElbowGripHandle(grid, 'end', elbowGeom.endElbowGripPos, elev);
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

        // Submallas de colisión y bandas de resalte luminoso para arco
        for (let i = 0; i < curvePts3D.length - 1; i += 4) {
          const pA = curvePts3D[i];
          const pB = curvePts3D[Math.min(i + 4, curvePts3D.length - 1)];
          const segDx = pB.x - pA.x;
          const segDz = pB.z - pA.z;
          const segLen = Math.hypot(segDx, segDz);
          if (segLen > 0.05) {
            const segGeom = new THREE.PlaneGeometry(
              segLen + DIMENSIONS.grid.hitboxLengthPadding,
              DIMENSIONS.grid.hitboxWidth
            );
            segGeom.rotateX(-Math.PI / 2);
            const segMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
            const segMesh = new THREE.Mesh(segGeom, segMat);
            segMesh.position.set(
              (pA.x + pB.x) / 2,
              elev + DIMENSIONS.grid.yOffsets.hitbox,
              (pA.z + pB.z) / 2
            );
            segMesh.rotation.y = -Math.atan2(segDz, segDx);
            segMesh.userData = { isGridLineHit: true, gridId: grid.id };
            this.hitProxiesGroup.add(segMesh);
            this.gridHitMeshes.push(segMesh);

            const hlGeom = new THREE.PlaneGeometry(segLen, DIMENSIONS.grid.glowWidth);
            hlGeom.rotateX(-Math.PI / 2);
            const hlMat = new THREE.MeshBasicMaterial({
              color: isSelected ? THEME.grid.lineActive : THEME.grid.lineHover,
              transparent: true,
              opacity: isSelected ? 0.4 : isHovered ? 0.55 : 0,
              depthTest: false,
              side: THREE.DoubleSide,
            });
            const hlMesh = new THREE.Mesh(hlGeom, hlMat);
            hlMesh.position.set(
              (pA.x + pB.x) / 2,
              elev + DIMENSIONS.grid.yOffsets.glow,
              (pA.z + pB.z) / 2
            );
            hlMesh.rotation.y = -Math.atan2(segDz, segDx);
            hlMesh.visible = isSelected || isHovered;
            hlMesh.renderOrder = DIMENSIONS.renderOrders.gridLine;
            this.highlightsGroup.add(hlMesh);
            hlMeshes.push(hlMesh);
          }
        }
        this.highlightMeshesMap.set(grid.id, hlMeshes);

        const pStart = curvePts3D[0];
        const pEnd = curvePts3D[curvePts3D.length - 1];

        if (grid.showStartBubble && pStart) {
          const spStart = GridSprites.createBubbleSprite(grid.name, isSelected, isHovered);
          spStart.position.copy(pStart).add(new THREE.Vector3(0, DIMENSIONS.grid.yOffsets.bubble, 0));
          spStart.userData = { isGridLineHit: true, isBubbleHit: true, gridId: grid.id, end: 'start' };
          this.bubblesGroup.add(spStart);
          this.bubbleSprites.push(spStart);
          bubbleRecord.start = spStart;

          const bHit = this.createBubbleHitMesh(
            pStart.x,
            elev + DIMENSIONS.grid.yOffsets.bubbleHit,
            pStart.z,
            grid.id,
            'start'
          );
          this.hitProxiesGroup.add(bHit);
          this.gridHitMeshes.push(bHit);
          this.bubbleHits.push({
            gridId: grid.id,
            end: 'start',
            mesh: bHit,
            worldPos: new THREE.Vector3(pStart.x, elev + DIMENSIONS.grid.yOffsets.bubble, pStart.z),
          });
        }

        if (grid.showEndBubble && pEnd) {
          const spEnd = GridSprites.createBubbleSprite(grid.name, isSelected, isHovered);
          spEnd.position.copy(pEnd).add(new THREE.Vector3(0, DIMENSIONS.grid.yOffsets.bubble, 0));
          spEnd.userData = { isGridLineHit: true, isBubbleHit: true, gridId: grid.id, end: 'end' };
          this.bubblesGroup.add(spEnd);
          this.bubbleSprites.push(spEnd);
          bubbleRecord.end = spEnd;

          const bHit = this.createBubbleHitMesh(
            pEnd.x,
            elev + DIMENSIONS.grid.yOffsets.bubbleHit,
            pEnd.z,
            grid.id,
            'end'
          );
          this.hitProxiesGroup.add(bHit);
          this.gridHitMeshes.push(bHit);
          this.bubbleHits.push({
            gridId: grid.id,
            end: 'end',
            mesh: bHit,
            worldPos: new THREE.Vector3(pEnd.x, elev + DIMENSIONS.grid.yOffsets.bubble, pEnd.z),
          });
        }

        if (isSelected && pStart && pEnd) {
          this.createGripAndToggle(grid, 'start', { x: pStart.x, z: pStart.z }, 0, 0, elev, false);
          this.createGripAndToggle(grid, 'end', { x: pEnd.x, z: pEnd.z }, 0, 0, elev, false);
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

  private createBubbleHitMesh(
    x: number,
    y: number,
    z: number,
    gridId: string,
    end: 'start' | 'end'
  ): THREE.Mesh {
    const bubbleHitGeom = new THREE.CircleGeometry(DIMENSIONS.grid.bubbleHitRadius, 20);
    bubbleHitGeom.rotateX(-Math.PI / 2);
    const bubbleHitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const bubbleHitMesh = new THREE.Mesh(bubbleHitGeom, bubbleHitMat);
    bubbleHitMesh.position.set(x, y, z);
    bubbleHitMesh.userData = { isGridLineHit: true, isBubbleHit: true, gridId, end };
    return bubbleHitMesh;
  }

  private createElbowToggleIcon(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    elev: number,
    isActive: boolean
  ): void {
    const sprite = GridSprites.createElbowIconSprite(isActive);
    sprite.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.toggleIcon, point.z);
    this.elbowsGroup.add(sprite);

    const hitGeom = new THREE.PlaneGeometry(DIMENSIONS.grid.toggleHitSize, DIMENSIONS.grid.toggleHitSize);
    hitGeom.rotateX(-Math.PI / 2);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitMesh = new THREE.Mesh(hitGeom, hitMat);
    hitMesh.position.copy(sprite.position);
    hitMesh.userData = { isElbowToggle: true, gridId: grid.id, end };
    this.elbowsGroup.add(hitMesh);
    this.elbowToggles.push({ gridId: grid.id, end, mesh: hitMesh });
  }

  private createElbowGripHandle(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    elev: number
  ): void {
    const gripVisualGroup = new THREE.Group();
    gripVisualGroup.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.elbowGrip, point.z);

    const ringGeom = new THREE.RingGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripOuterRadius,
      DIMENSIONS.grid.gripSegments
    );
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: THEME.grid.elbowGripRing,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    gripVisualGroup.add(new THREE.Mesh(ringGeom, ringMat));

    const innerGeom = new THREE.CircleGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripSegments
    );
    innerGeom.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: THEME.grid.elbowGripInner,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    gripVisualGroup.add(new THREE.Mesh(innerGeom, innerMat));
    this.elbowsGroup.add(gripVisualGroup);

    // Hitbox Grip de codo
    const hitGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripHitRadius, 20);
    hitGeom.rotateX(-Math.PI / 2);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitMesh = new THREE.Mesh(hitGeom, hitMat);
    hitMesh.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.elbowGrip, point.z);
    hitMesh.userData = { isElbowGrip: true, gridId: grid.id, end };
    this.elbowsGroup.add(hitMesh);
    this.elbowGrips.push({ gridId: grid.id, end, mesh: hitMesh });
  }

  private createGripAndToggle(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    dirX: number,
    dirZ: number,
    elev: number,
    isAligned: boolean
  ): void {
    // 1. Grip Visual
    const gripVisualGroup = new THREE.Group();
    gripVisualGroup.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.grip, point.z);

    const ringGeom = new THREE.RingGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripOuterRadius,
      DIMENSIONS.grid.gripSegments
    );
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: THEME.grid.gripRing,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    gripVisualGroup.add(new THREE.Mesh(ringGeom, ringMat));

    const innerGeom = new THREE.CircleGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripSegments
    );
    innerGeom.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: THEME.grid.gripInner,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    gripVisualGroup.add(new THREE.Mesh(innerGeom, innerMat));
    this.gripsGroup.add(gripVisualGroup);

    // Hitbox Grip (radio 0.9m)
    const hitGripGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripHitRadius, 20);
    hitGripGeom.rotateX(-Math.PI / 2);
    const hitGripMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitGripMesh = new THREE.Mesh(hitGripGeom, hitGripMat);
    hitGripMesh.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.gripHit, point.z);
    hitGripMesh.userData = { isGrip: true, gridId: grid.id, end };
    this.gripsGroup.add(hitGripMesh);
    this.gripHandles.push({ gridId: grid.id, end, mesh: hitGripMesh });

    // Candado
    if (isAligned) {
      const lockSprite = GridSprites.createLockSprite(true);
      lockSprite.position.set(
        point.x + dirX * DIMENSIONS.grid.lockOffset,
        elev + DIMENSIONS.grid.yOffsets.lock,
        point.z + dirZ * DIMENSIONS.grid.lockOffset
      );
      this.gripsGroup.add(lockSprite);
    }

    // 2. Checkbox visibilidad
    const isChecked = end === 'start' ? grid.showStartBubble : grid.showEndBubble;
    const toggleSprite = GridSprites.createCheckboxSprite(isChecked);
    const perpX = -dirZ;
    const perpZ = dirX;
    toggleSprite.position.set(
      point.x + dirX * DIMENSIONS.grid.checkboxDirOffset + perpX * DIMENSIONS.grid.checkboxPerpOffset,
      elev + DIMENSIONS.grid.yOffsets.toggle,
      point.z + dirZ * DIMENSIONS.grid.checkboxDirOffset + perpZ * DIMENSIONS.grid.checkboxPerpOffset
    );

    const hitBoxGeom = new THREE.PlaneGeometry(DIMENSIONS.grid.toggleHitSize, DIMENSIONS.grid.toggleHitSize);
    hitBoxGeom.rotateX(-Math.PI / 2);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitMesh = new THREE.Mesh(hitBoxGeom, hitBoxMat);
    hitMesh.position.copy(toggleSprite.position);
    hitMesh.userData = { isBubbleToggle: true, gridId: grid.id, end };

    this.togglesGroup.add(toggleSprite);
    this.togglesGroup.add(hitMesh);
    this.toggleBoxes.push({ gridId: grid.id, end, mesh: hitMesh });
  }

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
    let pts: THREE.Vector3[] = [];

    if (isVert) {
      const z = activeEnd === 'start' ? mainGrid.start.z : mainGrid.end.z;
      coords.push(mainGrid.start.x);
      alignedGroup.forEach(item => {
        const g = elements.find(e => e.id === item.gridId);
        if (g) coords.push(g.start.x);
      });
      const validCoords = coords.filter(c => Number.isFinite(c));
      const minX =
        (validCoords.length > 0 ? Math.min(...validCoords) : mainGrid.start.x) -
        DIMENSIONS.grid.alignmentGuideMargin;
      const maxX =
        (validCoords.length > 0 ? Math.max(...validCoords) : mainGrid.start.x) +
        DIMENSIONS.grid.alignmentGuideMargin;
      pts = [new THREE.Vector3(minX, elev, z), new THREE.Vector3(maxX, elev, z)];
    } else if (isHoriz) {
      const x = activeEnd === 'start' ? mainGrid.start.x : mainGrid.end.x;
      coords.push(mainGrid.start.z);
      alignedGroup.forEach(item => {
        const g = elements.find(e => e.id === item.gridId);
        if (g) coords.push(g.start.z);
      });
      const validCoords = coords.filter(c => Number.isFinite(c));
      const minZ =
        (validCoords.length > 0 ? Math.min(...validCoords) : mainGrid.start.z) -
        DIMENSIONS.grid.alignmentGuideMargin;
      const maxZ =
        (validCoords.length > 0 ? Math.max(...validCoords) : mainGrid.start.z) +
        DIMENSIONS.grid.alignmentGuideMargin;
      pts = [new THREE.Vector3(x, elev, minZ), new THREE.Vector3(x, elev, maxZ)];
    }

    if (pts.length === 2 && Number.isFinite(pts[0].x) && Number.isFinite(pts[1].x)) {
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: THEME.grid.alignmentGuide,
        dashSize: DIMENSIONS.grid.alignmentDashSize,
        gapSize: DIMENSIONS.grid.alignmentGapSize,
        transparent: true,
        opacity: 0.9,
      });
      const guide = new THREE.Line(geom, mat);
      guide.computeLineDistances();
      this.alignmentGroup.add(guide);
    }
  }

  public clearAlignmentGuide(): void {
    while (this.alignmentGroup.children.length > 0) {
      const obj = this.alignmentGroup.children[0] as THREE.Line;
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose();
      this.alignmentGroup.remove(obj);
    }
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

    if (points.length > 0) {
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color: THEME.grid.alignmentGuide,
        dashSize: DIMENSIONS.grid.guideDashSize,
        gapSize: DIMENSIONS.grid.guideGapSize,
        depthTest: false,
      });
      const guide = new THREE.Line(geom, mat);
      guide.computeLineDistances();
      this.guidesGroup.add(guide);
    }
  }

  public hideGuideLine(): void {
    while (this.guidesGroup.children.length > 0) {
      const obj = this.guidesGroup.children[0] as THREE.Line;
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose();
      this.guidesGroup.remove(obj);
    }
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
    while (this.linesGroup.children.length > 0) {
      const obj = this.linesGroup.children[0] as THREE.Line;
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else (obj.material as THREE.Material)?.dispose();
      this.linesGroup.remove(obj);
    }
    this.lineMeshMap.clear();
  }

  private clearHighlights(): void {
    while (this.highlightsGroup.children.length > 0) {
      const obj = this.highlightsGroup.children[0] as THREE.Mesh;
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else (obj.material as THREE.Material)?.dispose();
      this.highlightsGroup.remove(obj);
    }
    this.highlightMeshesMap.clear();
  }

  private clearBubbles(): void {
    while (this.bubblesGroup.children.length > 0) {
      const sp = this.bubblesGroup.children[0] as THREE.Sprite;
      (sp.material as THREE.SpriteMaterial)?.map?.dispose();
      sp.material?.dispose();
      this.bubblesGroup.remove(sp);
    }
    this.bubbleSpritesMap.clear();
    this.bubbleSprites = [];
  }

  private clearHitProxies(): void {
    while (this.hitProxiesGroup.children.length > 0) {
      const obj = this.hitProxiesGroup.children[0] as THREE.Mesh;
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else (obj.material as THREE.Material)?.dispose();
      this.hitProxiesGroup.remove(obj);
    }
    this.gridHitMeshes = [];
    this.bubbleHits = [];
  }

  private clearElbows(): void {
    while (this.elbowsGroup.children.length > 0) {
      const obj = this.elbowsGroup.children[0];
      if (obj instanceof THREE.Group) {
        while (obj.children.length > 0) {
          const child = obj.children[0] as THREE.Mesh;
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else (child.material as THREE.Material)?.dispose();
          obj.remove(child);
        }
      } else if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else (obj.material as THREE.Material)?.dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
      this.elbowsGroup.remove(obj);
    }
    this.elbowToggles = [];
    this.elbowGrips = [];
  }

  private clearGripsAndToggles(): void {
    while (this.gripsGroup.children.length > 0) {
      const obj = this.gripsGroup.children[0];
      if (obj instanceof THREE.Group) {
        while (obj.children.length > 0) {
          const child = obj.children[0] as THREE.Mesh;
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else (child.material as THREE.Material)?.dispose();
          obj.remove(child);
        }
      } else if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else (obj.material as THREE.Material)?.dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
      this.gripsGroup.remove(obj);
    }
    this.gripHandles = [];

    while (this.togglesGroup.children.length > 0) {
      const obj = this.togglesGroup.children[0];
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else (obj.material as THREE.Material)?.dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
      this.togglesGroup.remove(obj);
    }
    this.toggleBoxes = [];
  }

  public disposeAll(): void {
    this.clearLines();
    this.clearBubbles();
    this.clearHitProxies();
    this.clearGripsAndToggles();
    this.clearElbows();
    this.clearAlignmentGuide();
    this.hideGuideLine();
  }
}
