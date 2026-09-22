import * as THREE from 'three';
import { ManagedElement } from './types';
import { BimDatabase } from '../../core/database/BimDatabase';
import { captureDefinition } from './ElementGeometry';

export class ElementRegistry {
  private elements: ManagedElement[] = [];
  public get totalVolume(): number { return this.elements.reduce((s,e)=>s+e.volume,0); }

  public add(element: ManagedElement, scene: THREE.Scene, synchronize=true): void {
    element.definition = captureDefinition(element);
    if (synchronize && element.uniqueId) BimDatabase.getInstance().updateGeometry(element.uniqueId, element.definition);
    if (element.bimDoc) { element.volume=element.bimDoc.instanceParameters.volume; element.dimensions=element.bimDoc.geometry.dimensionsString; }
    scene.add(element.mesh);
    this.elements.push(element);
  }

  public getAll(): ManagedElement[] {
    return this.elements;
  }

  public getMeshes(): THREE.Mesh[] {
    return this.elements.map(el => el.mesh);
  }

  public findByMesh(mesh: THREE.Mesh): ManagedElement | undefined {
    return this.elements.find(el => el.mesh === mesh);
  }

  public findById(id: string | number): ManagedElement | undefined {
    if (id === undefined || id === null) return undefined;
    const strId = String(id).trim();
    const numId = typeof id === 'number' ? id : (Number.isFinite(Number(strId)) ? Number(strId) : null);

    // 1. Direct search in registered elements
    const match = this.elements.find(el => {
      if (el.uniqueId && el.uniqueId === strId) return true;
      if (el.id === strId) return true;
      if (el.elementId !== undefined && (el.elementId === id || (numId !== null && el.elementId === numId))) return true;
      if (el.bimDoc && (el.bimDoc.uniqueId === strId || el.bimDoc._id === strId)) return true;
      return false;
    });
    if (match) return match;

    // 2. Search via BimDatabase
    try {
      const bimDb = BimDatabase.getInstance();
      const doc = bimDb.searchById(strId);
      if (doc) {
        return this.elements.find(el =>
          (el.uniqueId && el.uniqueId === doc.uniqueId) ||
          (el.elementId !== undefined && el.elementId === doc.elementId) ||
          el.id === doc.instanceParameters.mark ||
          el.id === (doc as any).legacyId
        );
      }
    } catch {
      // Ignorar errores si la base de datos no está disponible
    }

    return undefined;
  }

  public remove(element: ManagedElement, scene: THREE.Scene): void {
    const idx = this.elements.indexOf(element);
    if (idx !== -1) {
      if (element.uniqueId) {
        BimDatabase.getInstance().deleteElement(element.uniqueId);
      }
      element.mesh.geometry.dispose();
      element.line.geometry.dispose();
      (element.line.material as THREE.Material).dispose();
      scene.remove(element.mesh);
      this.elements.splice(idx, 1);
    }
  }

  public get count(): number {
    return this.elements.length;
  }

  public clear(scene: THREE.Scene): void {
    this.elements.forEach(el => {
      el.mesh.geometry.dispose();
      el.line.geometry.dispose();
      (el.line.material as THREE.Material).dispose();
      scene.remove(el.mesh);
    });

    BimDatabase.getInstance().clearAll();
    this.elements = [];
  }
}
