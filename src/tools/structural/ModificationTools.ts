import * as THREE from 'three';
import { ManagedElement, AlignReference, ArrayOptions, Vector3D, ColumnDefinition, BeamDefinition, SlabDefinition, FootingDefinition } from './types';
import { WasmBridge } from '../../kernel/WasmBridge';
import { ElementFactory } from './ElementFactory';
import { ElementRegistry } from './ElementRegistry';
import { BuildingGenerator } from './BuildingGenerator';
import { VisualStyle } from '../../config/theme.config';
import { BimDatabase } from '../../core/database/BimDatabase';
import { quantities } from '../../core/model/Geometry';

export class ModificationTools {
  // Estado de la herramienta Alinear
  public isAlignActive = false;
  public alignStep: 'pick_reference' | 'pick_target' = 'pick_reference';
  public currentReference: AlignReference | null = null;
  private alignGuideMesh: THREE.LineSegments | null = null;

  // Estado de la herramienta Matriz
  public isArrayActive = false;
  public arrayConfig: ArrayOptions = {
    type: 'linear',
    count: 3,
    spacingMethod: 'second',
    delta: { x: 6.0, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    angleDegrees: 360,
  };

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private factory: ElementFactory,
    private registry: ElementRegistry,
    private currentStyleGetter: () => VisualStyle,
    private onStatusPrompt: (msg: string) => void,
    private onElementsChanged: () => void
  ) {}

  // =========================================================================
  // 1. HERRAMIENTA ALINEAR (ALIGN - ATAJO 'AL')
  // =========================================================================

  public startAlign(preselectedElement?: ManagedElement): void {
    this.isAlignActive = true;
    this.alignStep = 'pick_reference';
    this.currentReference = null;
    this.removeAlignGuide();
    this.onStatusPrompt('ALINEAR (AL): Paso 1 - Haz clic en una referencia de destino (Eje de rejilla, nivel o cara/arista)');
  }

  public cancelAlign(): void {
    this.isAlignActive = false;
    this.alignStep = 'pick_reference';
    this.currentReference = null;
    this.removeAlignGuide();
    this.onStatusPrompt('Herramienta Alinear cancelada.');
  }

  /**
   * Registra una referencia de destino (Eje X/Z de rejilla, nivel Y, o borde de elemento)
   */
  public setReference(ref: AlignReference): void {
    this.currentReference = ref;
    this.alignStep = 'pick_target';
    this.renderAlignGuide(ref);
    this.onStatusPrompt(`Referencia fijada en ${ref.label}. Paso 2 - Haz clic en el elemento que deseas alinear`);
  }

  /**
   * Alinea el elemento objetivo a la referencia previamente seleccionada
   */
  public alignElement(targetElement: ManagedElement): boolean {
    if (!this.currentReference) return false;

    const ref = this.currentReference;
    const def = targetElement.definition;
    if (!def) return false;

    let deltaX = 0;
    let deltaY = 0;
    let deltaZ = 0;

    // Calcular desplazamiento según el tipo de referencia
    if (ref.axis === 'X' && ref.coordinate !== undefined) {
      const currentCenterX = this.getElementCenterX(targetElement);
      deltaX = ref.coordinate - currentCenterX;
    } else if (ref.axis === 'Z' && ref.coordinate !== undefined) {
      const currentCenterZ = this.getElementCenterZ(targetElement);
      deltaZ = ref.coordinate - currentCenterZ;
    } else if (ref.axis === 'Y' && ref.coordinate !== undefined) {
      if (def.type === 'beam') {
        deltaY = ref.coordinate - def.startPoint.y;
      } else if (def.type === 'column') {
        deltaY = ref.coordinate - def.topPoint.y;
      } else if (def.type === 'slab') {
        deltaY = ref.coordinate - def.elevationY;
      }
    } else if (ref.point) {
      const curX = this.getElementCenterX(targetElement);
      const curZ = this.getElementCenterZ(targetElement);
      deltaX = ref.point.x - curX;
      deltaZ = ref.point.z - curZ;
    }

    if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaY) < 0.0001 && Math.abs(deltaZ) < 0.0001) {
      this.onStatusPrompt(`El elemento ${targetElement.id} ya se encuentra perfectamente alineado.`);
      return true;
    }

    // Aplicar desplazamiento a la definición geométrica
    this.translateElementDefinition(targetElement, deltaX, deltaY, deltaZ);
    this.rebuildElementGeometry(targetElement);

    this.onStatusPrompt(`✓ Elemento ${targetElement.id} alineado con éxito a ${ref.label}.`);
    this.onElementsChanged();
    return true;
  }

  private getElementCenterX(el: ManagedElement): number {
    el.mesh.geometry.computeBoundingBox();
    const bb = el.mesh.geometry.boundingBox || new THREE.Box3();
    return (bb.min.x + bb.max.x) / 2;
  }

  private getElementCenterZ(el: ManagedElement): number {
    el.mesh.geometry.computeBoundingBox();
    const bb = el.mesh.geometry.boundingBox || new THREE.Box3();
    return (bb.min.z + bb.max.z) / 2;
  }

  private translateElementDefinition(el: ManagedElement, dx: number, dy: number, dz: number): void {
    const def = el.definition;
    if (!def) return;

    if (def.type === 'beam') {
      def.startPoint.x += dx; def.startPoint.y += dy; def.startPoint.z += dz;
      def.endPoint.x += dx; def.endPoint.y += dy; def.endPoint.z += dz;
    } else if (def.type === 'column') {
      def.basePoint.x += dx; def.basePoint.y += dy; def.basePoint.z += dz;
      def.topPoint.x += dx; def.topPoint.y += dy; def.topPoint.z += dz;
    } else if (def.type === 'slab') {
      def.elevationY += dy;
      def.boundary.forEach(pt => { pt.x += dx; pt.y += dy; pt.z += dz; });
      if (def.voids) {
        def.voids.forEach(v => v.forEach(pt => { pt.x += dx; pt.y += dy; pt.z += dz; }));
      }
    } else if (def.type === 'footing') {
      def.center.x += dx; def.center.y += dy; def.center.z += dz;
    }
  }

  private rebuildElementGeometry(el: ManagedElement): void {
    const def = el.definition;
    if (!def) return;

    let newGeom: THREE.BufferGeometry;
    if (def.type === 'beam') {
      newGeom = this.wasm.createArbitraryBeam(def.startPoint, def.endPoint, def.width, def.height).geometry;
    } else if (def.type === 'column') {
      newGeom = def.columnStyle === 'slanted'
        ? this.wasm.createSlantedColumn(def.basePoint, def.topPoint, def.width, def.depth).geometry
        : this.wasm.createColumn(def.basePoint.x, def.basePoint.z, def.basePoint.y, def.topPoint.y, def.width, def.depth).geometry;
    } else if (def.type === 'slab') {
      newGeom = this.wasm.createPolygonSlab(def.boundary, def.voids, def.thickness, def.elevationY).geometry;
    } else {
      newGeom = this.wasm.createFooting(def.center.x, def.center.y, def.center.z, def.width, def.length, def.height).geometry;
    }

    el.mesh.geometry.dispose();
    el.mesh.geometry = newGeom;
    el.line.geometry.dispose();
    el.line.geometry = new THREE.EdgesGeometry(newGeom, 20);
    el.mesh.updateMatrixWorld(true);

    if (el.uniqueId) {
      const q=quantities(def);el.volume=q.volume;el.dimensions=q.dimensions;
      BimDatabase.getInstance().updateGeometry(el.uniqueId, def);
    }
  }

  private renderAlignGuide(ref: AlignReference): void {
    this.removeAlignGuide();

    const pts: THREE.Vector3[] = [];
    if (ref.axis === 'X' && ref.coordinate !== undefined) {
      pts.push(new THREE.Vector3(ref.coordinate, -1, -50), new THREE.Vector3(ref.coordinate, 15, 50));
    } else if (ref.axis === 'Z' && ref.coordinate !== undefined) {
      pts.push(new THREE.Vector3(-50, -1, ref.coordinate), new THREE.Vector3(50, 15, ref.coordinate));
    } else if (ref.axis === 'Y' && ref.coordinate !== undefined) {
      pts.push(
        new THREE.Vector3(-30, ref.coordinate, -30), new THREE.Vector3(30, ref.coordinate, -30),
        new THREE.Vector3(30, ref.coordinate, -30), new THREE.Vector3(30, ref.coordinate, 30),
        new THREE.Vector3(30, ref.coordinate, 30), new THREE.Vector3(-30, ref.coordinate, 30),
        new THREE.Vector3(-30, ref.coordinate, 30), new THREE.Vector3(-30, ref.coordinate, -30)
      );
    }

    if (pts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: 0xec4899, // Magenta brillante Revit
        dashSize: 0.5,
        gapSize: 0.25,
        depthTest: false,
      });
      this.alignGuideMesh = new THREE.LineSegments(geo, mat);
      this.alignGuideMesh.computeLineDistances();
      this.alignGuideMesh.renderOrder = 9999;
      this.scene.add(this.alignGuideMesh);
    }
  }

  private removeAlignGuide(): void {
    if (this.alignGuideMesh) {
      this.scene.remove(this.alignGuideMesh);
      this.alignGuideMesh.geometry.dispose();
      (this.alignGuideMesh.material as THREE.Material).dispose();
      this.alignGuideMesh = null;
    }
  }

  // =========================================================================
  // 2. HERRAMIENTA MATRIZ (ARRAY - ATAJO 'AR')
  // =========================================================================

  public startArray(element: ManagedElement): void {
    this.isArrayActive = true;
    this.onStatusPrompt(`MATRIZ (AR): Configura parámetros en la barra superior y pulsa 'Ejecutar Matriz'`);
  }

  public cancelArray(): void {
    this.isArrayActive = false;
    this.onStatusPrompt('Herramienta Matriz cancelada.');
  }

  /**
   * Ejecuta la generación de copias paramétricas lineales o radiales
   */
  public executeArray(sourceElement: ManagedElement, options: ArrayOptions): ManagedElement[] {
    const count = Math.max(2, Math.min(50, options.count));
    const createdElements: ManagedElement[] = [];
    const style = this.currentStyleGetter();

    const def = sourceElement.definition;
    if (!def) return [];

    const isLinear = options.type === 'linear';
    const isSecond = options.spacingMethod === 'second';

    // Desplazamiento base
    const rawDelta = options.delta || { x: 6.0, y: 0, z: 0 };
    const stepDelta: Vector3D = isSecond
      ? { ...rawDelta }
      : { x: rawDelta.x / (count - 1), y: rawDelta.y / (count - 1), z: rawDelta.z / (count - 1) };

    const center = options.center || {
      x: this.getElementCenterX(sourceElement),
      y: 0,
      z: this.getElementCenterZ(sourceElement),
    };
    const angleTotal = THREE.MathUtils.degToRad(options.angleDegrees || 360);
    const angleStep = isSecond ? angleTotal / count : angleTotal / (count - 1);

    for (let k = 1; k < count; k++) {
      let clonedDef: any;

      if (isLinear) {
        // Desplazamiento lineal
        const dx = stepDelta.x * k;
        const dy = stepDelta.y * k;
        const dz = stepDelta.z * k;
        clonedDef = JSON.parse(JSON.stringify(def));
        this.translateDefObject(clonedDef, dx, dy, dz);
      } else {
        // Desplazamiento radial (rotación en torno al centro)
        const angle = angleStep * k;
        clonedDef = JSON.parse(JSON.stringify(def));
        this.rotateDefAroundCenter(clonedDef, center, angle);
      }

      // Generar malla para el elemento clonado
      const newElem = this.spawnFromDefinition(clonedDef, sourceElement, style);
      if (newElem) {
        createdElements.push(newElem);
      }
    }

    this.isArrayActive = false;
    this.onStatusPrompt(`✓ Matriz generada con éxito: ${createdElements.length} nuevos elementos agregados.`);
    this.onElementsChanged();
    return createdElements;
  }

  private translateDefObject(def: any, dx: number, dy: number, dz: number): void {
    if (def.type === 'beam') {
      def.startPoint.x += dx; def.startPoint.y += dy; def.startPoint.z += dz;
      def.endPoint.x += dx; def.endPoint.y += dy; def.endPoint.z += dz;
    } else if (def.type === 'column') {
      def.basePoint.x += dx; def.basePoint.y += dy; def.basePoint.z += dz;
      def.topPoint.x += dx; def.topPoint.y += dy; def.topPoint.z += dz;
    } else if (def.type === 'slab') {
      def.elevationY += dy;
      def.boundary.forEach((pt: any) => { pt.x += dx; pt.y += dy; pt.z += dz; });
      if (def.voids) {
        def.voids.forEach((v: any) => v.forEach((pt: any) => { pt.x += dx; pt.y += dy; pt.z += dz; }));
      }
    } else if (def.type === 'footing') {
      def.center.x += dx; def.center.y += dy; def.center.z += dz;
    }
  }

  private rotateDefAroundCenter(def: any, center: Vector3D, angle: number): void {
    const rotPoint = (pt: Vector3D) => {
      const rx = pt.x - center.x;
      const rz = pt.z - center.z;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      pt.x = center.x + (rx * cosA - rz * sinA);
      pt.z = center.z + (rx * sinA + rz * cosA);
    };

    if (def.type === 'beam') {
      rotPoint(def.startPoint);
      rotPoint(def.endPoint);
    } else if (def.type === 'column') {
      rotPoint(def.basePoint);
      rotPoint(def.topPoint);
    } else if (def.type === 'slab') {
      def.boundary.forEach((pt: any) => rotPoint(pt));
      if (def.voids) {
        def.voids.forEach((v: any) => v.forEach((pt: any) => rotPoint(pt)));
      }
    } else if (def.type === 'footing') {
      rotPoint(def.center);
    }
  }

  private spawnFromDefinition(
    def: any,
    template: ManagedElement,
    style: VisualStyle
  ): ManagedElement | null {
    let geo: THREE.BufferGeometry;
    let volume = 0;
    let dims = template.dimensions;

    if (def.type === 'beam') {
      const m = this.wasm.createArbitraryBeam(def.startPoint, def.endPoint, def.width, def.height);
      geo = m.geometry;
      volume = m.volume;
      const len = new THREE.Vector3(def.endPoint.x - def.startPoint.x, def.endPoint.y - def.startPoint.y, def.endPoint.z - def.startPoint.z).length();
      dims = `${def.width.toFixed(2)}m × ${def.height.toFixed(2)}m (L=${len.toFixed(2)}m)`;
    } else if (def.type === 'column') {
      const m = def.columnStyle === 'slanted'
        ? this.wasm.createSlantedColumn(def.basePoint, def.topPoint, def.width, def.depth)
        : this.wasm.createColumn(def.basePoint.x, def.basePoint.z, def.basePoint.y, def.topPoint.y, def.width, def.depth);
      geo = m.geometry;
      volume = m.volume;
    } else if (def.type === 'slab') {
      const m = this.wasm.createPolygonSlab(def.boundary, def.voids, def.thickness, def.elevationY);
      geo = m.geometry;
      volume = m.volume;
    } else {
      const m = this.wasm.createFooting(def.center.x, def.center.y, def.center.z, def.width, def.length, def.height);
      geo = m.geometry;
      volume = m.volume;
    }

    const idPrefix = { footing: 'ZAP', column: 'COL', beam: 'VIG', slab: 'LOS' }[template.type];
    const newLegacyId = `${idPrefix}-M${Math.floor(100 + Math.random() * 899)}`;

    const bimDoc = BimDatabase.getInstance().registerElement({
      definition: def,
      legacyId: newLegacyId,
      category: template.type,
      volume,
      levelName: template.levelName,
      dimensions: dims,
      length: (def as any).length,
      height: (def as any).height,
    });

    const base = this.factory.create(geo, template.type, style);
    const managed: ManagedElement = {
      ...base,
      id: newLegacyId,
      elementId: bimDoc.elementId,
      uniqueId: bimDoc.uniqueId,
      bimDoc,
      volume,
      levelName: template.levelName,
      dimensions: dims,
      definition: def,
    };

    base.mesh.userData = {
      id: newLegacyId,
      elementId: bimDoc.elementId,
      uniqueId: bimDoc.uniqueId,
      type: template.type,
      bimDoc,
    };

    this.registry.add(managed, this.scene);
    return managed;
  }
}
