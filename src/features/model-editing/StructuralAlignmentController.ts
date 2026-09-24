import * as THREE from 'three';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { BimView } from '../../core/views/BimView';
import type { SnappingManager } from '../../tools/SnappingManager';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { GripManager } from '../../tools/structural/GripManager';
import type { ModificationTools } from '../../tools/structural/ModificationTools';
import type { ContextualSubheader } from '../datum/ContextualSubheaderController';

export class StructuralAlignmentController {
  constructor(
    private gridSystem: GridSystem,
    private levelSystem: LevelSystem,
    private structural: StructuralManager,
    private modificationTools: ModificationTools,
    private gripManager: GripManager,
    private selection: SelectionManager,
    private snapping: SnappingManager,
    private contextualBar: ContextualSubheader,
  ) {}

  public handleClick(event: MouseEvent, activeView: BimView, raycaster: THREE.Raycaster): boolean {
    if (!this.modificationTools.isAlignActive) return false;
    this.setRay(event, activeView, raycaster);

    if (this.modificationTools.alignStep === 'pick_reference') {
      const gridHit = raycaster.intersectObjects(this.gridSystem.gridHitMeshes)[0];
      if (gridHit) {
        const gridId = gridHit.object.userData?.gridId as string;
        const grid = this.gridSystem.elements.find(item => item.id === gridId);
        if (grid) {
          const isX = Math.abs(grid.start.x - grid.end.x) < 0.1;
          this.modificationTools.setReference({
            type: 'grid',
            label: `Eje de Rejilla ${grid.name}`,
            point: { x: grid.start.x, y: 0, z: grid.start.z },
            axis: isX ? 'X' : 'Z',
            coordinate: isX ? grid.start.x : grid.start.z,
          });
          this.contextualBar.renderAlignBar(`Referencia fija: Eje ${grid.name}. Paso 2: Clic en elemento a alinear.`);
          return true;
        }
      }

      const levelHit = raycaster.intersectObjects(this.levelSystem.levelHitMeshes)[0];
      if (levelHit) {
        const levelId = levelHit.object.userData?.levelId as string;
        const level = this.levelSystem.getLevels().find(item => item.id === levelId);
        if (level) {
          this.modificationTools.setReference({
            type: 'level',
            label: `Nivel ${level.name}`,
            point: { x: 0, y: level.elevation, z: 0 },
            axis: 'Y',
            coordinate: level.elevation,
          });
          this.contextualBar.renderAlignBar(`Referencia fija: Nivel ${level.name}. Paso 2: Clic en elemento a alinear.`);
          return true;
        }
      }

      const elementHit = raycaster.intersectObjects(this.structural.registry.getMeshes(), true)[0];
      if (elementHit) {
        const point = elementHit.point;
        this.modificationTools.setReference({
          type: 'element_edge',
          label: 'Punto de referencia',
          point: { x: point.x, y: point.y, z: point.z },
          axis: 'X',
          coordinate: point.x,
        });
        this.contextualBar.renderAlignBar(`Referencia fija: X=${point.x.toFixed(2)}m. Paso 2: Clic en elemento a alinear.`);
        return true;
      }
      return false;
    }

    const elementHit = raycaster.intersectObjects(this.structural.registry.getMeshes(), true)[0];
    if (!elementHit) return false;
    const object = elementHit.object;
    const mesh = object instanceof THREE.Mesh ? object : object.parent instanceof THREE.Mesh ? object.parent : null;
    if (!mesh) return false;
    const element = this.structural.registry.findByMesh(mesh);
    if (!element) return false;

    this.gripManager.ensureDefinition(element);
    this.modificationTools.alignElement(element);
    this.selection.select(element);
    this.gripManager.updateGripsForElement(element);
    const activeLevel = this.levelSystem.getLevels()[this.snapping.activeLevelIdx]?.name || 'Nivel Activo';
    this.contextualBar.updateForSelectedElement(element, activeLevel);
    this.modificationTools.cancelAlign();
    return true;
  }

  private setRay(event: MouseEvent, view: BimView, raycaster: THREE.Raycaster): void {
    const rect = view.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(2 * (event.clientX - rect.left) / rect.width - 1, -2 * (event.clientY - rect.top) / rect.height + 1),
      view.camera,
    );
  }
}
