import * as THREE from 'three';
import type { ArrayOptions, ManagedElement, Vector3D } from './types';
import type { WasmBridge } from '../../kernel/WasmBridge';
import type { VisualStyle } from '../../config/theme.config';
import { BimDatabase } from '../../core/database/BimDatabase';
import { distance } from '../../core/model/Geometry';
import { ElementFactory } from './ElementFactory';
import { ElementRegistry } from './ElementRegistry';
import { rotateDefinitionAroundCenter, translateDefinition } from './StructuralDefinitionTransforms';
import { createStructuralGeometry } from './StructuralGeometryFactory';

export class ArrayTool {
  public isActive = false;
  public config: ArrayOptions = {
    type: 'linear', count: 3, spacingMethod: 'second', delta: { x: 6, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 }, angleDegrees: 360,
  };

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private factory: ElementFactory,
    private registry: ElementRegistry,
    private currentStyleGetter: () => VisualStyle,
    private onStatusPrompt: (message: string) => void,
    private onElementsChanged: () => void,
  ) {}

  public start(): void {
    this.isActive = true;
    this.onStatusPrompt("MATRIZ (AR): Configura parámetros en la barra superior y pulsa 'Ejecutar Matriz'");
  }

  public cancel(): void {
    this.isActive = false;
    this.onStatusPrompt('Herramienta Matriz cancelada.');
  }

  public execute(source: ManagedElement, options: ArrayOptions): ManagedElement[] {
    const count = Math.max(2, Math.min(50, options.count));
    const created: ManagedElement[] = [];
    const sourceDefinition = source.definition;
    if (!sourceDefinition) return [];

    const isLinear = options.type === 'linear';
    const isSecond = options.spacingMethod === 'second';
    const rawDelta = options.delta || { x: 6, y: 0, z: 0 };
    const stepDelta: Vector3D = isSecond
      ? { ...rawDelta }
      : { x: rawDelta.x / (count - 1), y: rawDelta.y / (count - 1), z: rawDelta.z / (count - 1) };
    const center = options.center || { x: this.getElementCenterX(source), y: 0, z: this.getElementCenterZ(source) };
    const angleTotal = THREE.MathUtils.degToRad(options.angleDegrees || 360);
    const angleStep = isSecond ? angleTotal / count : angleTotal / (count - 1);
    const style = this.currentStyleGetter();

    for (let index = 1; index < count; index++) {
      const definition = isLinear
        ? translateDefinition(sourceDefinition, { x: stepDelta.x * index, y: stepDelta.y * index, z: stepDelta.z * index })
        : rotateDefinitionAroundCenter(sourceDefinition, center, angleStep * index);
      const element = this.spawnFromDefinition(definition, source, style);
      if (element) created.push(element);
    }

    this.isActive = false;
    this.onStatusPrompt(`✓ Matriz generada con éxito: ${created.length} nuevos elementos agregados.`);
    this.onElementsChanged();
    return created;
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

  private spawnFromDefinition(definition: ManagedElement['definition'], template: ManagedElement, style: VisualStyle): ManagedElement {
    const meshData = createStructuralGeometry(definition, this.wasm);
    let dimensions = template.dimensions;
    if (definition.type === 'beam') {
      const length = distance(definition.startPoint, definition.endPoint);
      dimensions = `${definition.width.toFixed(2)}m × ${definition.height.toFixed(2)}m (L=${length.toFixed(2)}m)`;
    }

    const prefixes: Record<ManagedElement['type'], string> = { footing: 'ZAP', column: 'COL', beam: 'VIG', slab: 'LOS' };
    const legacyId = `${prefixes[template.type]}-M${Math.floor(100 + Math.random() * 899)}`;
    const document = BimDatabase.getInstance().registerElement({
      definition,
      legacyId,
      category: template.type,
      volume: meshData.volume,
      levelName: template.levelName,
      dimensions,
    });
    const base = this.factory.create(meshData.geometry, template.type, style);
    const element: ManagedElement = {
      ...base,
      id: legacyId,
      elementId: document.elementId,
      uniqueId: document.uniqueId,
      bimDoc: document,
      volume: meshData.volume,
      levelName: template.levelName,
      dimensions,
      definition,
    };
    base.mesh.userData = {
      id: legacyId,
      elementId: document.elementId,
      uniqueId: document.uniqueId,
      type: template.type,
      bimDoc: document,
    };
    this.registry.add(element, this.scene);
    return element;
  }
}
