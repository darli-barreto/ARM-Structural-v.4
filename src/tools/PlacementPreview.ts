import * as THREE from 'three';
import { STRUCTURAL_SPECS, ToolType, LEVELS_Y } from '../config/structural.config';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';
import { JointResolver } from './JointResolver';

export class PlacementPreview {
  public group = new THREE.Group();
  private mesh: THREE.Mesh;
  private line: THREE.LineSegments;

  private ghostMaterial = new THREE.MeshBasicMaterial({
    color: THEME.preview.ghostSurface,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  private ghostEdgeMaterial = new THREE.LineBasicMaterial({
    color: THEME.preview.ghostEdge,
    depthTest: false,
    linewidth: 2
  });

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMaterial);
    this.line = new THREE.LineSegments(new THREE.BufferGeometry(), this.ghostEdgeMaterial);
    this.line.renderOrder = DIMENSIONS.renderOrders.placementEdges;
    this.mesh.renderOrder = DIMENSIONS.renderOrders.placementMesh;

    this.group.add(this.mesh);
    this.group.add(this.line);
    this.group.visible = false;
    scene.add(this.group);
  }

  public update(tool: ToolType, x: number, z: number, levelIdx: number, allGridX: number[], allGridZ: number[]): void {
    if (tool === 'select' || tool === 'grid') {
      this.hide();
      return;
    }

    const specs = STRUCTURAL_SPECS;
    const baseElev = LEVELS_Y[levelIdx] || 0;

    let geom: THREE.BufferGeometry | null = null;
    let posY = 0;

    if (tool === 'zapata') {
      geom = new THREE.BoxGeometry(specs.footing.width, specs.footing.height, specs.footing.length);
      posY = specs.footing.height / 2;
      this.group.position.set(x, posY, z);
    } else if (tool === 'columna') {
      const topElev = LEVELS_Y[Math.min(levelIdx + 1, LEVELS_Y.length - 1)];
      const { yStart, height } = JointResolver.resolveColumnElevations(levelIdx, baseElev, topElev);
      geom = new THREE.BoxGeometry(specs.column.width, height, specs.column.depth);
      posY = yStart + height / 2;
      this.group.position.set(x, posY, z);
    } else if (tool === 'viga') {
      const nextX = allGridX.find(gx => gx > x) || x + 6;
      const length = nextX - x;
      geom = new THREE.BoxGeometry(length, specs.beam.height, specs.beam.width);
      posY = (LEVELS_Y[Math.max(1, levelIdx)] || 3.5) - specs.beam.height / 2;
      this.group.position.set(x + length / 2, posY, z);
    } else if (tool === 'techo') {
      const nextX = allGridX.find(gx => gx > x) || x + 6;
      const nextZ = allGridZ.find(gz => gz > z) || z + 6;
      const bay = JointResolver.resolveSlabBay(x, nextX, z, nextZ);
      geom = new THREE.BoxGeometry(bay.widthX, specs.slab.thickness, bay.lengthZ);
      posY = (LEVELS_Y[Math.max(1, levelIdx)] || 3.5) - specs.slab.thickness / 2;
      this.group.position.set(bay.centerX, posY, bay.centerZ);
    }

    if (geom) {
      this.mesh.geometry.dispose();
      this.line.geometry.dispose();

      this.mesh.geometry = geom;
      this.line.geometry = new THREE.EdgesGeometry(geom);
      this.group.visible = true;
    } else {
      this.hide();
    }
  }

  public hide(): void {
    this.group.visible = false;
  }
}