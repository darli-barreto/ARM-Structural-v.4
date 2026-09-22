import * as THREE from 'three';
import { ElementCategory, ManagedElement } from './types';
import { THEME, VisualStyle } from '../../config/theme.config';
import { DIMENSIONS } from '../../config/dimensions.config';
import { WasmBridge } from '../../kernel/WasmBridge';

export class ElementFactory {
  constructor(private wasm: WasmBridge) {}

  public create(
    geometry: THREE.BufferGeometry,
    type: ElementCategory,
    style: VisualStyle
  ): Pick<ManagedElement, 'mesh' | 'line' | 'type'> {
    const material = this.wasm.getMaterial(type, style);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Asignación de jerarquía de renderizado
    mesh.renderOrder = this.getRenderOrder(type);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Aristas de contorno CAD
    const edges = new THREE.EdgesGeometry(geometry, 20);
    const edgeColor = this.getEdgeColor(type, style);
    const isWireframe = style === 'wireframe';

    const lineMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthTest: !isWireframe
    });

    const line = new THREE.LineSegments(edges, lineMat);
    line.renderOrder = mesh.renderOrder + DIMENSIONS.renderOrders.edgesOffset;
    mesh.add(line);

    return { mesh, line, type };
  }

  public getRenderOrder(type: ElementCategory): number {
    switch (type) {
      case 'footing': return DIMENSIONS.renderOrders.footing;
      case 'column':  return DIMENSIONS.renderOrders.column;
      case 'beam':    return DIMENSIONS.renderOrders.beam;
      case 'slab':    return DIMENSIONS.renderOrders.slab;
    }
  }

  public getEdgeColor(type: ElementCategory, style: VisualStyle): number {
    if (style === 'hidden_line' || style === 'wireframe') {
      return THEME.styles.hidden_line.edge;
    }
    if (style === 'consistent_colors') {
      return THEME.styles.consistent_colors.edge;
    }
    return THEME.elements[type].edge;
  }
}
