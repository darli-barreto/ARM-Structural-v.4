import * as THREE from 'three';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { THEME } from '../../../config/theme.config';

export interface GridSegmentRenderResult {
  hitMeshes: THREE.Mesh[];
  highlightMeshes: THREE.Mesh[];
}

export class GridSegmentRenderer {
  constructor(
    private readonly hitProxiesGroup: THREE.Group,
    private readonly highlightsGroup: THREE.Group
  ) {}

  public renderInteractiveSegments(
    points: THREE.Vector3[],
    stride: number,
    gridId: string,
    elevation: number,
    isSelected: boolean,
    isHovered: boolean
  ): GridSegmentRenderResult {
    const hitMeshes: THREE.Mesh[] = [];
    const highlightMeshes: THREE.Mesh[] = [];
    const step = Math.max(1, Math.floor(stride));

    for (let index = 0; index < points.length - 1; index += step) {
      const start = points[index];
      const end = points[Math.min(index + step, points.length - 1)];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      if (length <= 0.05) continue;

      const hitGeometry = new THREE.PlaneGeometry(
        length + DIMENSIONS.grid.hitboxLengthPadding,
        DIMENSIONS.grid.hitboxWidth
      );
      hitGeometry.rotateX(-Math.PI / 2);
      const hitMesh = new THREE.Mesh(
        hitGeometry,
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      hitMesh.position.set(
        (start.x + end.x) / 2,
        elevation + DIMENSIONS.grid.yOffsets.hitbox,
        (start.z + end.z) / 2
      );
      hitMesh.rotation.y = -Math.atan2(dz, dx);
      hitMesh.userData = { isGridLineHit: true, gridId };
      this.hitProxiesGroup.add(hitMesh);
      hitMeshes.push(hitMesh);

      const highlightGeometry = new THREE.PlaneGeometry(length, DIMENSIONS.grid.glowWidth);
      highlightGeometry.rotateX(-Math.PI / 2);
      const highlightMesh = new THREE.Mesh(highlightGeometry, new THREE.MeshBasicMaterial({
        color: isSelected ? THEME.grid.lineActive : THEME.grid.lineHover,
        transparent: true,
        opacity: isSelected ? 0.4 : isHovered ? 0.55 : 0,
        depthTest: false,
        side: THREE.DoubleSide,
      }));
      highlightMesh.position.set(
        (start.x + end.x) / 2,
        elevation + DIMENSIONS.grid.yOffsets.glow,
        (start.z + end.z) / 2
      );
      highlightMesh.rotation.y = -Math.atan2(dz, dx);
      highlightMesh.visible = isSelected || isHovered;
      highlightMesh.renderOrder = DIMENSIONS.renderOrders.gridLine;
      this.highlightsGroup.add(highlightMesh);
      highlightMeshes.push(highlightMesh);
    }

    return { hitMeshes, highlightMeshes };
  }
}
