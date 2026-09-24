import * as THREE from 'three';
import type { StructuralDefinition, Vector3D } from '../../core/model/Geometry';
import type { ManagedElement } from './types';

export interface GripHandleData {
  elementId: string;
  gripType: 'linear_start' | 'linear_end' | 'col_top' | 'col_base' | 'slab_vertex' | 'slab_edge_mid' | 'void_vertex' | 'move';
  index?: number;
  originalPoint: Vector3D;
  edgeStartIndex?: number;
  edgeEndIndex?: number;
  voidIndex?: number;
}

export class StructuralGripRenderer {
  public readonly group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];

  constructor() {
    this.group.name = 'structural-grips-group';
  }

  public render(element: ManagedElement, definition: StructuralDefinition): void {
    this.clear();
    if (definition.type === 'beam') {
      this.addLinearGrip(element.id, 'linear_start', definition.startPoint, 0);
      this.addLinearGrip(element.id, 'linear_end', definition.endPoint, 1);
    } else if (definition.type === 'column') {
      if (definition.columnStyle === 'slanted') {
        this.addLinearGrip(element.id, 'col_base', definition.basePoint, 0);
        this.addLinearGrip(element.id, 'col_top', definition.topPoint, 1);
      } else {
        this.addColumnHeightGrip(element.id, 'col_base', definition.basePoint);
        this.addColumnHeightGrip(element.id, 'col_top', definition.topPoint);
      }
    } else if (definition.type === 'slab') {
      definition.boundary.forEach((point, index) => this.addVertexGrip(element.id, point, index));
      for (let index = 0; index < definition.boundary.length; index++) {
        const next = (index + 1) % definition.boundary.length;
        const a = definition.boundary[index];
        const b = definition.boundary[next];
        this.addEdgeMidGrip(element.id, {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          z: (a.z + b.z) / 2,
        }, index, next);
      }
      definition.voids?.forEach((ring, voidIndex) => {
        ring.forEach((point, index) => {
          const next = (index + 1) % ring.length;
          this.addVoidVertexGrip(element.id, point, voidIndex, index);
          this.addEdgeMidGrip(element.id, {
            x: (point.x + ring[next].x) / 2,
            y: point.y,
            z: (point.z + ring[next].z) / 2,
          }, index, next, voidIndex);
        });
      });
    } else {
      const halfWidth = definition.width / 2;
      const halfLength = definition.length / 2;
      const corners = [
        { x: definition.center.x - halfWidth, y: definition.center.y, z: definition.center.z - halfLength },
        { x: definition.center.x + halfWidth, y: definition.center.y, z: definition.center.z - halfLength },
        { x: definition.center.x + halfWidth, y: definition.center.y, z: definition.center.z + halfLength },
        { x: definition.center.x - halfWidth, y: definition.center.y, z: definition.center.z + halfLength },
      ];
      corners.forEach((point, index) => this.addVertexGrip(element.id, point, index));
    }

    element.mesh.geometry.computeBoundingBox();
    const center = element.mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    if (definition.type === 'slab') center.y = definition.elevationY;
    this.addLinearGrip(element.id, 'move', { x: center.x, y: center.y, z: center.z }, 0);
    (this.meshes[this.meshes.length - 1].material as THREE.MeshBasicMaterial).color.setHex(0xf2b544);
  }

  public clear(): void {
    for (const grip of [...this.group.children]) {
      this.group.remove(grip);
      grip.traverse(object => {
        const renderable = object as THREE.Mesh;
        renderable.geometry?.dispose?.();
        if (!renderable.material) return;
        const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
        materials.forEach(material => material.dispose());
      });
    }
    this.meshes = [];
  }

  public getMeshes(): THREE.Mesh[] {
    return this.meshes;
  }

  private addMesh(mesh: THREE.Mesh, elementId: string, gripType: GripHandleData['gripType'], point: Vector3D, extra: Partial<GripHandleData> = {}): void {
    mesh.userData = { elementId, gripType, originalPoint: { ...point }, ...extra } satisfies GripHandleData;
    this.meshes.push(mesh);
    this.group.add(mesh);
  }

  private addLinearGrip(elementId: string, role: 'linear_start' | 'linear_end' | 'col_base' | 'col_top' | 'move', point: Vector3D, index: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, depthWrite: false }),
    );
    mesh.position.set(point.x, point.y, point.z);
    mesh.renderOrder = 10000;
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    center.renderOrder = 10001;
    mesh.add(center);
    this.addMesh(mesh, elementId, role, point, { index });
  }

  private addColumnHeightGrip(elementId: string, role: 'col_base' | 'col_top', point: Vector3D): void {
    const isTop = role === 'col_top';
    const geometry = new THREE.ConeGeometry(0.18, 0.32, 16);
    if (!isTop) geometry.rotateX(Math.PI);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false, depthWrite: false }));
    mesh.position.set(point.x, point.y + (isTop ? 0.16 : -0.16), point.z);
    mesh.renderOrder = 10000;
    this.addMesh(mesh, elementId, role, point);
  }

  private addVertexGrip(elementId: string, point: Vector3D, index: number): void {
    const geometry = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x0284c7, depthTest: false, depthWrite: false }));
    mesh.position.set(point.x, point.y + 0.12, point.z);
    mesh.renderOrder = 10000;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    outline.renderOrder = 10001;
    mesh.add(outline);
    this.addMesh(mesh, elementId, 'slab_vertex', point, { index });
  }

  private addEdgeMidGrip(elementId: string, point: Vector3D, startIndex: number, endIndex: number, voidIndex?: number): void {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, depthWrite: false }),
    );
    mesh.position.set(point.x, point.y + 0.1, point.z);
    mesh.renderOrder = 10000;
    this.addMesh(mesh, elementId, 'slab_edge_mid', point, { edgeStartIndex: startIndex, edgeEndIndex: endIndex, voidIndex });
  }

  private addVoidVertexGrip(elementId: string, point: Vector3D, voidIndex: number, index: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, depthWrite: false }),
    );
    mesh.position.set(point.x, point.y + 0.1, point.z);
    mesh.renderOrder = 10000;
    this.addMesh(mesh, elementId, 'void_vertex', point, { voidIndex, index });
  }
}
