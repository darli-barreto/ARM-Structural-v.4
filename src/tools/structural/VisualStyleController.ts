import * as THREE from 'three';
import { THEME, VisualStyle } from '../../config/theme.config';
import { ManagedElement } from './types';
import { ElementFactory } from './ElementFactory';
import { WasmBridge } from '../../kernel/WasmBridge';
import { Viewer } from '../../core/Viewer';
import { GridSystem } from '../../core/GridSystem';

export class VisualStyleController {
  public currentStyle: VisualStyle = 'hidden_line';

  constructor(
    private wasm: WasmBridge,
    private factory: ElementFactory
  ) {}

  public apply(
    style: VisualStyle,
    elements: ManagedElement[],
    viewer: Viewer,
    gridSystem: GridSystem
  ): void {
    this.currentStyle = style;

    // 1. Configuración de fondo y luces
    if (style === 'hidden_line' || style === 'wireframe') {
      viewer.setBackground(THEME.styles.hidden_line.background);
      viewer.configureLighting('flat');
    } else if (style === 'consistent_colors') {
      viewer.setBackground(THEME.styles.consistent_colors.background);
      viewer.configureLighting('flat');
    } else {
      viewer.setBackground(THEME.viewport.background);
      viewer.configureLighting('shaded');
    }

    // 2. Grillas de referencia
    gridSystem.updateStyle(style);

    // 3. Mallas y bordes existentes
    const isWireframe = style === 'wireframe';
    elements.forEach(el => {
      el.mesh.material = this.wasm.getMaterial(el.type, style);

      const edgeColor = this.factory.getEdgeColor(el.type, style);
      const lineMat = el.line.material as THREE.LineBasicMaterial;
      lineMat.color.set(edgeColor);
      lineMat.depthTest = !isWireframe;
      lineMat.needsUpdate = true;
    });
  }
}
