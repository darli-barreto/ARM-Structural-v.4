import * as THREE from 'three';
import { ManagedElement, StructuralDefinition, Vector3D, ColumnDefinition, BeamDefinition, SlabDefinition, FootingDefinition } from './types';
import { WasmBridge } from '../../kernel/WasmBridge';
import { ElementFactory } from './ElementFactory';
import { BimDatabase } from '../../core/database/BimDatabase';
import { BimView } from '../../core/views/BimView';
import { VisualStyle } from '../../config/theme.config';
import { validateDefinition } from '../../core/model/Geometry';
import { applyGeometry } from './ElementGeometry';
import { AxisConstraint } from '../../core/model/GeometryEditing';
import { StructuralGripRenderer, type GripHandleData } from './StructuralGripRenderer';
import { GripGeometryEditor } from './GripGeometryEditor';
export type { GripHandleData } from './StructuralGripRenderer';

export class GripManager {
  private readonly gripRenderer = new StructuralGripRenderer();
  private readonly geometryEditor: GripGeometryEditor;
  public gripsGroup = this.gripRenderer.group;
  public activeGrip: THREE.Mesh | null = null;
  public isDragging = false;

  private currentElement: ManagedElement | null = null;
  private initialDefinition: StructuralDefinition | null = null;
  private floatingBadge: HTMLElement | null = null;
  private dragPlane = new THREE.Plane();
  private raycaster = new THREE.Raycaster();
  private pointerStart=new THREE.Vector3();private constraint=new AxisConstraint();
  private guide:THREE.Line|null=null;

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private factory: ElementFactory,
    private activeViewGetter: () => BimView,
    private onElementModified: (element: ManagedElement) => void,
    private currentStyleGetter: () => VisualStyle
  ) {
    this.geometryEditor = new GripGeometryEditor(wasm);
    this.scene.add(this.gripsGroup);
    this.createFloatingBadge();
  }

  private createFloatingBadge(): void {
    const existing = document.getElementById('bim-floating-dimension-badge');
    if (existing) existing.remove();

    this.floatingBadge = document.createElement('div');
    this.floatingBadge.id = 'bim-floating-dimension-badge';
    this.floatingBadge.className =
      'hidden fixed pointer-events-none z-50 bg-slate-950/90 text-sky-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded shadow-lg border border-sky-400/60 backdrop-blur-xs select-none -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap transition-transform duration-75';
    document.body.appendChild(this.floatingBadge);
  }

  /**
   * Garantiza que cualquier elemento seleccionado posea una definición paramétrica 3D completa.
   */
  public ensureDefinition(element: ManagedElement): StructuralDefinition {
    if (element.definition) return element.definition;

    element.mesh.geometry.computeBoundingBox();
    const bb = element.mesh.geometry.boundingBox || new THREE.Box3();
    const min = bb.min;
    const max = bb.max;

    if (element.type === 'column') {
      const centerX = (min.x + max.x) / 2;
      const centerZ = (min.z + max.z) / 2;
      const width = Math.max(0.2, max.x - min.x);
      const depth = Math.max(0.2, max.z - min.z);
      const def: ColumnDefinition = {
        type: 'column',
        columnStyle: 'vertical',
        basePoint: { x: centerX, y: min.y, z: centerZ },
        topPoint: { x: centerX, y: max.y, z: centerZ },
        width,
        depth,
      };
      element.definition = def;
      return def;
    }

    if (element.type === 'beam') {
      const dx = max.x - min.x;
      const dz = max.z - min.z;
      const height = Math.max(0.2, max.y - min.y);
      let def: BeamDefinition;

      if (dx >= dz) {
        const midZ = (min.z + max.z) / 2;
        const width = Math.max(0.2, dz);
        def = {
          type: 'beam',
          startPoint: { x: min.x, y: max.y, z: midZ },
          endPoint: { x: max.x, y: max.y, z: midZ },
          width,
          height,
        };
      } else {
        const midX = (min.x + max.x) / 2;
        const width = Math.max(0.2, dx);
        def = {
          type: 'beam',
          startPoint: { x: midX, y: max.y, z: min.z },
          endPoint: { x: midX, y: max.y, z: max.z },
          width,
          height,
        };
      }
      element.definition = def;
      return def;
    }

    if (element.type === 'slab') {
      const thickness = Math.max(0.1, max.y - min.y);
      const elevY = min.y;
      const boundary: Vector3D[] = [
        { x: min.x, y: elevY, z: min.z },
        { x: max.x, y: elevY, z: min.z },
        { x: max.x, y: elevY, z: max.z },
        { x: min.x, y: elevY, z: max.z },
      ];
      const def: SlabDefinition = {
        type: 'slab',
        boundary,
        thickness,
        elevationY: elevY,
      };
      element.definition = def;
      return def;
    }

    // Footing
    const w = Math.max(0.5, max.x - min.x);
    const l = Math.max(0.5, max.z - min.z);
    const h = Math.max(0.2, max.y - min.y);
    const center: Vector3D = {
      x: (min.x + max.x) / 2,
      y: min.y,
      z: (min.z + max.z) / 2,
    };
    const def: FootingDefinition = {
      type: 'footing',
      center,
      width: w,
      length: l,
      height: h,
    };
    element.definition = def;
    return def;
  }

  /**
   * Actualiza y dibuja los grips para el elemento seleccionado
   */
  public updateGripsForElement(element: ManagedElement | null): void {
    this.clearGrips();
    if (!element) {
      this.currentElement = null;
      return;
    }
    this.currentElement = element;
    this.gripRenderer.render(element, this.ensureDefinition(element));
  }

  public clearGrips(): void {
    this.hideGuide();
    this.gripRenderer.clear();
    this.activeGrip = null;
    this.isDragging = false;
    this.hideFloatingBadge();
  }

  public getGripMeshes(): THREE.Mesh[] {
    return this.gripRenderer.getMeshes();
  }
  /**
   * Detección de puntero sobre un grip
   */
  public testPointerIntersection(e: MouseEvent): THREE.Mesh | null {
    const gripMeshes = this.gripRenderer.getMeshes();
    if (gripMeshes.length === 0) return null;

    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, activeView.camera);

    const hits = this.raycaster.intersectObjects(gripMeshes, true);
    if (hits.length > 0) {
      const topObj = hits[0].object;
      const gripMesh = (topObj.parent && topObj.parent instanceof THREE.Mesh && topObj.parent.userData?.gripType)
        ? topObj.parent
        : (topObj instanceof THREE.Mesh ? topObj : null);
      return gripMesh;
    }
    return null;
  }

  /**
   * Inicia el arrastre interactivo de un grip
   */
  public startDrag(gripMesh: THREE.Mesh, e: MouseEvent): boolean {
    if (e.button!==0 || !this.currentElement || !this.currentElement.definition) return false;

    this.activeGrip = gripMesh;
    this.isDragging = true;
    this.initialDefinition = JSON.parse(JSON.stringify(this.currentElement.definition));

    const activeView = this.activeViewGetter();
    const gripData = gripMesh.userData as GripHandleData;
    this.constraint.reset();

    // Configurar el plano de arrastre 3D
    if (activeView.type==='elevation' || (this.currentElement.type === 'column' && (gripData.gripType === 'col_top' || gripData.gripType === 'col_base'))) {
      // Para columnas verticales, arrastrar en plano vertical orientado hacia la cámara
      const camDir = new THREE.Vector3();
      activeView.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 0.001) camDir.set(0, 0, -1);
      camDir.normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), gripMesh.position);
    } else {
      // Para vigas, losas y zapatas, plano horizontal en la elevación del grip
      this.dragPlane.set(new THREE.Vector3(0, 1, 0), -gripMesh.position.y);
    }

    const rect=activeView.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1),activeView.camera);
    if(!this.raycaster.ray.intersectPlane(this.dragPlane,this.pointerStart)){this.isDragging=false;this.activeGrip=null;return false;}

    this.showFloatingBadge(e.clientX, e.clientY, 'Ajustando...');
    return true;
  }

  /**
   * Actualiza el arrastre en tiempo real recalculando geometría con Snapping
   */
  public updateDrag(
    e: MouseEvent,
    gridCoordsX: number[],
    gridCoordsZ: number[],
    levelsY: number[]
  ): void {
    if (!this.isDragging || !this.activeGrip || !this.currentElement || !this.initialDefinition) return;

    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, activeView.camera);

    const hitPoint = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, hitPoint)) return;
    const gripData = this.activeGrip.userData as GripHandleData;
    hitPoint.sub(this.pointerStart).add(new THREE.Vector3(gripData.originalPoint.x,gripData.originalPoint.y,gripData.originalPoint.z));

    // 1. Snapping inteligente
    let snappedX = hitPoint.x;
    let snappedY = hitPoint.y;
    let snappedZ = hitPoint.z;

    const SNAP_DIST = 0.35;

    // Snap a rejillas en X y Z
    if (gridCoordsX.length > 0) {
      const nearX = gridCoordsX.reduce((p, c) => (Math.abs(c - hitPoint.x) < Math.abs(p - hitPoint.x) ? c : p));
      if (Math.abs(nearX - hitPoint.x) < SNAP_DIST) snappedX = nearX;
      else snappedX = Math.round(snappedX * 20) / 20; // Snap fino a 5cm
    } else {
      snappedX = Math.round(snappedX * 10) / 10;
    }

    if (gridCoordsZ.length > 0) {
      const nearZ = gridCoordsZ.reduce((p, c) => (Math.abs(c - hitPoint.z) < Math.abs(p - hitPoint.z) ? c : p));
      if (Math.abs(nearZ - hitPoint.z) < SNAP_DIST) snappedZ = nearZ;
      else snappedZ = Math.round(snappedZ * 20) / 20;
    } else {
      snappedZ = Math.round(snappedZ * 10) / 10;
    }

    // Snap a niveles en Y
    if (levelsY && levelsY.length > 0) {
      const nearY = levelsY.reduce((p, c) => (Math.abs(c - hitPoint.y) < Math.abs(p - hitPoint.y) ? c : p));
      if (Math.abs(nearY - hitPoint.y) < SNAP_DIST) snappedY = nearY;
      else snappedY = Math.round(snappedY * 20) / 20;
    }

    if(Math.abs(this.dragPlane.normal.y)>.999)snappedY=gripData.originalPoint.y;
    const origin=gripData.originalPoint;
    const delta=this.constraint.constrain({x:snappedX-origin.x,y:snappedY-origin.y,z:snappedZ-origin.z},e.ctrlKey||e.shiftKey,Math.abs(this.dragPlane.normal.y)>.999?['x','z']:['x','y','z']);
    snappedX=origin.x+delta.x;snappedY=origin.y+delta.y;snappedZ=origin.z+delta.z;
    const axis=this.constraint.axis;
    if(axis)this.showGuide(origin,{x:axis==='x'?1:0,y:axis==='y'?1:0,z:axis==='z'?1:0});else this.hideGuide();
    const result = this.geometryEditor.update({
      element: this.currentElement,
      initialDefinition: this.initialDefinition,
      grip: gripData,
      snappedPoint: { x: snappedX, y: snappedY, z: snappedZ },
      delta,
      hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
    });
    if (result.status === 'rejected') {
      if (result.guideDirection) this.showGuide(origin, result.guideDirection);
      this.showFloatingBadge(e.clientX, e.clientY, result.message);
      return;
    }
    if (result.guideDirection) this.showGuide(origin, result.guideDirection);
    this.activeGrip.position.set(result.gripPosition.x, result.gripPosition.y, result.gripPosition.z);
    this.showFloatingBadge(e.clientX, e.clientY, result.badgeText);
  }

  private showGuide(origin:Vector3D,direction:Vector3D):void {
    this.hideGuide();
    const a=new THREE.Vector3(origin.x-direction.x*100,origin.y-direction.y*100,origin.z-direction.z*100);
    const b=new THREE.Vector3(origin.x+direction.x*100,origin.y+direction.y*100,origin.z+direction.z*100);
    this.guide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineDashedMaterial({color:0x169bb7,dashSize:.3,gapSize:.15,depthTest:false,depthWrite:false}));
    this.guide.computeLineDistances();this.guide.renderOrder=9999;this.scene.add(this.guide);
  }
  private hideGuide():void {
    if(!this.guide)return;this.scene.remove(this.guide);this.guide.geometry.dispose();(this.guide.material as THREE.Material).dispose();this.guide=null;
  }
  public cancelDrag():void {
    if(!this.isDragging||!this.currentElement||!this.initialDefinition)return;
    const element=this.currentElement;applyGeometry(element,this.initialDefinition,this.wasm);
    this.initialDefinition=null;this.updateGripsForElement(element);this.onElementModified(element);
  }

  /**
   * Finaliza el arrastre y consolida el elemento en la base de datos BIM
   */
  public endDrag(): void {
    if (!this.isDragging || !this.currentElement || !this.currentElement.definition) {
      this.clearGrips();
      return;
    }

    const element = this.currentElement;
    const def = element.definition!;
    try { validateDefinition(def); } catch (error) {
      if (this.initialDefinition) applyGeometry(element, this.initialDefinition, this.wasm);
      this.isDragging=false;this.activeGrip=null;this.initialDefinition=null;this.hideFloatingBadge();
      this.updateGripsForElement(element);this.onElementModified(element);
      alert((error as Error).message);return;
    }
    const style = this.currentStyleGetter();

    let newVolume = 0;
    let newDims = '';

    if (def.type === 'beam') {
      const p1 = new THREE.Vector3(def.startPoint.x, def.startPoint.y, def.startPoint.z);
      const p2 = new THREE.Vector3(def.endPoint.x, def.endPoint.y, def.endPoint.z);
      const length = p1.distanceTo(p2);
      newVolume = length * def.width * def.height;
      newDims = `${def.width.toFixed(2)}m × ${def.height.toFixed(2)}m (L=${length.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'column') {
      const p1 = new THREE.Vector3(def.basePoint.x, def.basePoint.y, def.basePoint.z);
      const p2 = new THREE.Vector3(def.topPoint.x, def.topPoint.y, def.topPoint.z);
      const h = p1.distanceTo(p2);
      newVolume = def.width * def.depth * h;
      newDims = `${def.width.toFixed(2)}m × ${def.depth.toFixed(2)}m (${def.columnStyle === 'slanted' ? 'Inclinada L' : 'h'}=${h.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'slab') {
      const meshData = this.wasm.createPolygonSlab(def.boundary, def.voids, def.thickness, def.elevationY);
      newVolume = meshData.volume;
      newDims = `Losa Perimetral N=${def.boundary.length} (e=${def.thickness.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'footing') {
      newVolume = def.width * def.length * def.height;
      newDims = `${def.width.toFixed(2)}m × ${def.length.toFixed(2)}m × ${def.height.toFixed(2)}m`;
      element.volume = newVolume;
      element.dimensions = newDims;
    }

    // Actualizar registro en MongoDB / BimDatabase
    if (element.uniqueId) {
      BimDatabase.getInstance().updateGeometry(element.uniqueId, def);
    }

    this.isDragging = false;
    this.activeGrip = null;
    this.initialDefinition = null;
    this.hideFloatingBadge();

    // Re-posicionar todos los grips con la geometría consolidada
    this.updateGripsForElement(element);
    this.onElementModified(element);
  }

  private showFloatingBadge(clientX: number, clientY: number, text: string): void {
    if (!this.floatingBadge) return;
    this.floatingBadge.textContent = text;
    this.floatingBadge.style.left = `${clientX + 16}px`;
    this.floatingBadge.style.top = `${clientY - 24}px`;
    this.floatingBadge.classList.remove('hidden');
  }

  private hideFloatingBadge(): void {
    if (!this.floatingBadge) return;
    this.floatingBadge.classList.add('hidden');
  }
}
