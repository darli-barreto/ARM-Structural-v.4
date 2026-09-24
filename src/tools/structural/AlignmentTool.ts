import * as THREE from 'three';
import type { AlignReference, ManagedElement } from './types';
import type { WasmBridge } from '../../kernel/WasmBridge';
import { BimDatabase } from '../../core/database/BimDatabase';
import { quantities } from '../../core/model/Geometry';
import { createStructuralGeometry } from './StructuralGeometryFactory';
import { translateDefinition } from './StructuralDefinitionTransforms';

export class AlignmentTool {
  public isActive = false;
  public step: 'pick_reference' | 'pick_target' = 'pick_reference';
  public reference: AlignReference | null = null;
  private guideMesh: THREE.LineSegments | null = null;

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private onStatusPrompt: (message: string) => void,
    private onElementsChanged: () => void,
  ) {}

  public start(): void {
    this.isActive = true;
    this.step = 'pick_reference';
    this.reference = null;
    this.removeGuide();
    this.onStatusPrompt('ALINEAR (AL): Paso 1 - Haz clic en una referencia de destino (Eje de rejilla, nivel o cara/arista)');
  }

  public cancel(): void {
    this.isActive = false;
    this.step = 'pick_reference';
    this.reference = null;
    this.removeGuide();
    this.onStatusPrompt('Herramienta Alinear cancelada.');
  }

  public setReference(reference: AlignReference): void {
    this.reference = reference;
    this.step = 'pick_target';
    this.renderGuide(reference);
    this.onStatusPrompt(`Referencia fijada en ${reference.label}. Paso 2 - Haz clic en el elemento que deseas alinear`);
  }

  public alignElement(target: ManagedElement): boolean {
    const reference = this.reference;
    const definition = target.definition;
    if (!reference || !definition) return false;

    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (reference.axis === 'X' && reference.coordinate !== undefined) {
      dx = reference.coordinate - this.getElementCenterX(target);
    } else if (reference.axis === 'Z' && reference.coordinate !== undefined) {
      dz = reference.coordinate - this.getElementCenterZ(target);
    } else if (reference.axis === 'Y' && reference.coordinate !== undefined) {
      if (definition.type === 'beam') dy = reference.coordinate - definition.startPoint.y;
      else if (definition.type === 'column') dy = reference.coordinate - definition.topPoint.y;
      else if (definition.type === 'slab') dy = reference.coordinate - definition.elevationY;
    } else if (reference.point) {
      dx = reference.point.x - this.getElementCenterX(target);
      dz = reference.point.z - this.getElementCenterZ(target);
    }

    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001 && Math.abs(dz) < 0.0001) {
      this.onStatusPrompt(`El elemento ${target.id} ya se encuentra perfectamente alineado.`);
      return true;
    }

    const translated = translateDefinition(definition, { x: dx, y: dy, z: dz });
    const mesh = createStructuralGeometry(translated, this.wasm);
    target.mesh.geometry.dispose();
    target.mesh.geometry = mesh.geometry;
    target.line.geometry.dispose();
    target.line.geometry = new THREE.EdgesGeometry(mesh.geometry, 20);
    target.definition = translated;
    target.mesh.updateMatrixWorld(true);

    if (target.uniqueId) {
      const result = quantities(translated);
      target.volume = result.volume;
      target.dimensions = result.dimensions;
      BimDatabase.getInstance().updateGeometry(target.uniqueId, translated);
    }
    this.onStatusPrompt(`✓ Elemento ${target.id} alineado con éxito a ${reference.label}.`);
    this.onElementsChanged();
    return true;
  }

  private getElementCenterX(element: ManagedElement): number {
    element.mesh.geometry.computeBoundingBox();
    const bounds = element.mesh.geometry.boundingBox || new THREE.Box3();
    return (bounds.min.x + bounds.max.x) / 2;
  }

  private getElementCenterZ(element: ManagedElement): number {
    element.mesh.geometry.computeBoundingBox();
    const bounds = element.mesh.geometry.boundingBox || new THREE.Box3();
    return (bounds.min.z + bounds.max.z) / 2;
  }

  private renderGuide(reference: AlignReference): void {
    this.removeGuide();
    const points: THREE.Vector3[] = [];
    if (reference.axis === 'X' && reference.coordinate !== undefined) {
      points.push(new THREE.Vector3(reference.coordinate, -1, -50), new THREE.Vector3(reference.coordinate, 15, 50));
    } else if (reference.axis === 'Z' && reference.coordinate !== undefined) {
      points.push(new THREE.Vector3(-50, -1, reference.coordinate), new THREE.Vector3(50, 15, reference.coordinate));
    } else if (reference.axis === 'Y' && reference.coordinate !== undefined) {
      points.push(
        new THREE.Vector3(-30, reference.coordinate, -30), new THREE.Vector3(30, reference.coordinate, -30),
        new THREE.Vector3(30, reference.coordinate, -30), new THREE.Vector3(30, reference.coordinate, 30),
        new THREE.Vector3(30, reference.coordinate, 30), new THREE.Vector3(-30, reference.coordinate, 30),
        new THREE.Vector3(-30, reference.coordinate, 30), new THREE.Vector3(-30, reference.coordinate, -30),
      );
    }
    if (!points.length) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: 0xec4899, dashSize: 0.5, gapSize: 0.25, depthTest: false });
    this.guideMesh = new THREE.LineSegments(geometry, material);
    this.guideMesh.computeLineDistances();
    this.guideMesh.renderOrder = 9999;
    this.scene.add(this.guideMesh);
  }

  private removeGuide(): void {
    if (!this.guideMesh) return;
    this.scene.remove(this.guideMesh);
    this.guideMesh.geometry.dispose();
    (this.guideMesh.material as THREE.Material).dispose();
    this.guideMesh = null;
  }
}
