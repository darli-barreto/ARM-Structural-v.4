import * as THREE from 'three';
import type { GridElement } from '../../../config/structural.config';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { THEME } from '../../../config/theme.config';
import type {
  BubbleHitProxy,
  BubbleToggleHit,
  ElbowGripHandle,
  ElbowToggleHit,
  GripHandle,
} from '../types/GridTypes';
import { GridSprites } from './GridSprites';

interface GridEndpointRenderState {
  bubbleSprites: THREE.Sprite[];
  gridHitMeshes: THREE.Mesh[];
  bubbleHits: BubbleHitProxy[];
  gripHandles: GripHandle[];
  elbowGrips: ElbowGripHandle[];
  elbowToggles: ElbowToggleHit[];
  toggleBoxes: BubbleToggleHit[];
}

interface GridEndpointRendererDependencies {
  bubblesGroup: THREE.Group;
  hitProxiesGroup: THREE.Group;
  gripsGroup: THREE.Group;
  togglesGroup: THREE.Group;
  elbowsGroup: THREE.Group;
  getState: () => GridEndpointRenderState;
}

export class GridEndpointRenderer {
  constructor(private readonly deps: GridEndpointRendererDependencies) {}

  public renderBubble(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    elev: number,
    isSelected: boolean,
    isHovered: boolean,
  ): THREE.Sprite {
    const sprite = GridSprites.createBubbleSprite(grid.name, isSelected, isHovered);
    sprite.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.bubble, point.z);
    sprite.userData = { isGridLineHit: true, isBubbleHit: true, gridId: grid.id, end };
    this.deps.bubblesGroup.add(sprite);

    const hitMesh = this.createBubbleHitMesh(
      point.x,
      elev + DIMENSIONS.grid.yOffsets.bubbleHit,
      point.z,
      grid.id,
      end,
    );
    this.deps.hitProxiesGroup.add(hitMesh);

    const state = this.deps.getState();
    state.bubbleSprites.push(sprite);
    state.gridHitMeshes.push(hitMesh);
    state.bubbleHits.push({
      gridId: grid.id,
      end,
      mesh: hitMesh,
      worldPos: new THREE.Vector3(point.x, elev + DIMENSIONS.grid.yOffsets.bubble, point.z),
    });
    return sprite;
  }

  public createElbowToggleIcon(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    elev: number,
    isActive: boolean,
  ): void {
    const sprite = GridSprites.createElbowIconSprite(isActive);
    sprite.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.toggleIcon, point.z);
    this.deps.elbowsGroup.add(sprite);

    const hitGeom = new THREE.PlaneGeometry(DIMENSIONS.grid.toggleHitSize, DIMENSIONS.grid.toggleHitSize);
    hitGeom.rotateX(-Math.PI / 2);
    const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hitMesh.position.copy(sprite.position);
    hitMesh.userData = { isElbowToggle: true, gridId: grid.id, end };
    this.deps.elbowsGroup.add(hitMesh);
    this.deps.getState().elbowToggles.push({ gridId: grid.id, end, mesh: hitMesh });
  }

  public createElbowGripHandle(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    elev: number,
  ): void {
    const position = new THREE.Vector3(point.x, elev + DIMENSIONS.grid.yOffsets.elbowGrip, point.z);
    const visual = new THREE.Group();
    visual.position.copy(position);

    const ringGeom = new THREE.RingGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripOuterRadius,
      DIMENSIONS.grid.gripSegments,
    );
    ringGeom.rotateX(-Math.PI / 2);
    visual.add(new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
      color: THEME.grid.elbowGripRing,
      side: THREE.DoubleSide,
      depthTest: false,
    })));

    const innerGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripInnerRadius, DIMENSIONS.grid.gripSegments);
    innerGeom.rotateX(-Math.PI / 2);
    visual.add(new THREE.Mesh(innerGeom, new THREE.MeshBasicMaterial({
      color: THEME.grid.elbowGripInner,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
    })));
    this.deps.elbowsGroup.add(visual);

    const hitGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripHitRadius, 20);
    hitGeom.rotateX(-Math.PI / 2);
    const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hitMesh.position.copy(position);
    hitMesh.userData = { isElbowGrip: true, gridId: grid.id, end };
    this.deps.elbowsGroup.add(hitMesh);
    this.deps.getState().elbowGrips.push({ gridId: grid.id, end, mesh: hitMesh });
  }

  public createGripAndToggle(
    grid: GridElement,
    end: 'start' | 'end',
    point: { x: number; z: number },
    dirX: number,
    dirZ: number,
    elev: number,
    isAligned: boolean,
  ): void {
    const gripVisual = new THREE.Group();
    gripVisual.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.grip, point.z);

    const ringGeom = new THREE.RingGeometry(
      DIMENSIONS.grid.gripInnerRadius,
      DIMENSIONS.grid.gripOuterRadius,
      DIMENSIONS.grid.gripSegments,
    );
    ringGeom.rotateX(-Math.PI / 2);
    gripVisual.add(new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
      color: THEME.grid.gripRing,
      side: THREE.DoubleSide,
      depthTest: false,
    })));

    const innerGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripInnerRadius, DIMENSIONS.grid.gripSegments);
    innerGeom.rotateX(-Math.PI / 2);
    gripVisual.add(new THREE.Mesh(innerGeom, new THREE.MeshBasicMaterial({
      color: THEME.grid.gripInner,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false,
    })));
    this.deps.gripsGroup.add(gripVisual);

    const hitGripGeom = new THREE.CircleGeometry(DIMENSIONS.grid.gripHitRadius, 20);
    hitGripGeom.rotateX(-Math.PI / 2);
    const hitGripMesh = new THREE.Mesh(hitGripGeom, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hitGripMesh.position.set(point.x, elev + DIMENSIONS.grid.yOffsets.gripHit, point.z);
    hitGripMesh.userData = { isGrip: true, gridId: grid.id, end };
    this.deps.gripsGroup.add(hitGripMesh);
    this.deps.getState().gripHandles.push({ gridId: grid.id, end, mesh: hitGripMesh });

    if (isAligned) {
      const lockSprite = GridSprites.createLockSprite(true);
      lockSprite.position.set(
        point.x + dirX * DIMENSIONS.grid.lockOffset,
        elev + DIMENSIONS.grid.yOffsets.lock,
        point.z + dirZ * DIMENSIONS.grid.lockOffset,
      );
      this.deps.gripsGroup.add(lockSprite);
    }

    const isChecked = end === 'start' ? grid.showStartBubble : grid.showEndBubble;
    const toggleSprite = GridSprites.createCheckboxSprite(isChecked);
    const perpX = -dirZ;
    const perpZ = dirX;
    toggleSprite.position.set(
      point.x + dirX * DIMENSIONS.grid.checkboxDirOffset + perpX * DIMENSIONS.grid.checkboxPerpOffset,
      elev + DIMENSIONS.grid.yOffsets.toggle,
      point.z + dirZ * DIMENSIONS.grid.checkboxDirOffset + perpZ * DIMENSIONS.grid.checkboxPerpOffset,
    );

    const hitBoxGeom = new THREE.PlaneGeometry(DIMENSIONS.grid.toggleHitSize, DIMENSIONS.grid.toggleHitSize);
    hitBoxGeom.rotateX(-Math.PI / 2);
    const hitMesh = new THREE.Mesh(hitBoxGeom, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hitMesh.position.copy(toggleSprite.position);
    hitMesh.userData = { isBubbleToggle: true, gridId: grid.id, end };

    this.deps.togglesGroup.add(toggleSprite, hitMesh);
    this.deps.getState().toggleBoxes.push({ gridId: grid.id, end, mesh: hitMesh });
  }

  private createBubbleHitMesh(
    x: number,
    y: number,
    z: number,
    gridId: string,
    end: 'start' | 'end',
  ): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(DIMENSIONS.grid.bubbleHitRadius, 20);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.userData = { isGridLineHit: true, isBubbleHit: true, gridId, end };
    return mesh;
  }
}
