import * as THREE from 'three';
import { DIMENSIONS } from '../config/dimensions.config';
import {
  Level,
  LevelElement,
  LevelTemplateType,
  QuickGenerateLevelConfig,
} from './level/types/LevelTypes';
import { LevelStateManager } from './level/state/LevelStateManager';
import { LevelRenderer } from './level/rendering/LevelRenderer';
import { LevelInlineEditor } from './level/interaction/LevelInlineEditor';

export class LevelSystem {
  public group = new THREE.Group();
  public state: LevelStateManager;
  public renderer: LevelRenderer;
  public inlineEditor: LevelInlineEditor;

  public selectedLevelId: string | null = null;
  public hoveredLevelId: string | null = null;

  // Estados de arrastre interactivo (Grips estándar y Grips de Codo)
  public isDraggingGrip = false;
  public activeDraggingGrip: { levelId: string; end: 'start' | 'end' } | null = null;

  public isDraggingElbowGrip = false;
  public activeDraggingElbow: { levelId: string; end: 'start' | 'end' } | null = null;

  public onLevelsChanged?: (levels: Level[]) => void;

  constructor(scene: THREE.Scene) {
    this.group.name = 'BimLevelSystem';
    scene.add(this.group);

    this.state = new LevelStateManager();
    this.renderer = new LevelRenderer();
    this.inlineEditor = new LevelInlineEditor();

    this.group.add(this.renderer.rootGroup);

    // ESTADO INICIAL OBLIGATORIO: Canvas 100% limpio / en blanco
    this.rebuildMeshes();
  }

  public get levelHitMeshes(): THREE.Mesh[] {
    return this.renderer.levelHitMeshes;
  }

  public get headsGroup(): THREE.Group {
    return this.renderer.headsGroup;
  }

  public get bubbleHits(): Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh; worldPos: THREE.Vector3 }> {
    return this.renderer.bubbleHits;
  }

  public get elbowToggles(): Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }> {
    return this.renderer.elbowToggles;
  }

  public get bubbleToggles(): Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }> {
    return this.renderer.bubbleToggles;
  }

  public get grips(): Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }> {
    return this.renderer.grips;
  }

  public get elbowGrips(): Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }> {
    return this.renderer.elbowGrips;
  }

  public getLineMeshes(): THREE.Line[] {
    return this.renderer.getLineMeshes();
  }

  public selectLevel(id: string | null): void {
    this.selectedLevelId = id;
    this.rebuildMeshes();
  }

  public getSelectedLevel(): Level | undefined {
    if (!this.selectedLevelId) return undefined;
    return this.state.getLevel(this.selectedLevelId);
  }

  public setHoveredLevel(id: string | null): void {
    if (this.hoveredLevelId === id) return;
    this.hoveredLevelId = id;
    this.renderer.setHoveredLevel(id, this.selectedLevelId, this.state.getLevels());
  }

  // =========================================================================
  // MANIPULACIÓN Y ARRASTRE DE GRIPS (ALARGAR / ACHICAR NIVELES)
  // =========================================================================

  public startGripDrag(levelId: string, end: 'start' | 'end'): boolean {
    const lvl = this.state.getLevel(levelId);
    if (!lvl) return false;
    this.isDraggingGrip = true;
    this.activeDraggingGrip = { levelId, end };
    return true;
  }

  public updateGripDrag(pos: { x: number; y: number; z: number }): void {
    if (!this.isDraggingGrip || !this.activeDraggingGrip) return;
    const mainLvl = this.state.getLevel(this.activeDraggingGrip.levelId);
    if (!mainLvl) return;

    const end = this.activeDraggingGrip.end;

    if (end === 'end') {
      const newX = Math.round(pos.x * 20) / 20;
      const newZ = Math.round(pos.z * 20) / 20;

      const currentStartX = typeof mainLvl.start.x === 'number' ? mainLvl.start.x : -22;
      const currentStartZ = typeof mainLvl.start.z === 'number' ? mainLvl.start.z : -22;

      // Actualizar X si es mayor que start.x + 2.0
      if (newX > currentStartX + 2.0) {
        mainLvl.end.x = newX;
        // Si el nivel tiene bloqueo de alineación (Revit lock), propagar a todos los niveles bloqueados
        if (mainLvl.isLocked) {
          this.state.getLevels().forEach(other => {
            if (other.id !== mainLvl.id && other.isLocked) {
              other.end.x = newX;
            }
          });
        }
      }

      // Actualizar Z si es mayor que start.z + 2.0
      if (newZ > currentStartZ + 2.0) {
        mainLvl.end.z = newZ;
        if (mainLvl.isLocked) {
          this.state.getLevels().forEach(other => {
            if (other.id !== mainLvl.id && other.isLocked) {
              other.end.z = newZ;
            }
          });
        }
      }
    } else {
      // end === 'start'
      const newX = Math.round(pos.x * 20) / 20;
      const newZ = Math.round(pos.z * 20) / 20;

      const currentEndX = typeof mainLvl.end.x === 'number' ? mainLvl.end.x : 22;
      const currentEndZ = typeof mainLvl.end.z === 'number' ? mainLvl.end.z : 22;

      if (newX < currentEndX - 2.0) {
        mainLvl.start.x = newX;
        if (mainLvl.isLocked) {
          this.state.getLevels().forEach(other => {
            if (other.id !== mainLvl.id && other.isLocked) {
              other.start.x = newX;
            }
          });
        }
      }

      if (newZ < currentEndZ - 2.0) {
        mainLvl.start.z = newZ;
        if (mainLvl.isLocked) {
          this.state.getLevels().forEach(other => {
            if (other.id !== mainLvl.id && other.isLocked) {
              other.start.z = newZ;
            }
          });
        }
      }
    }

    this.rebuildMeshes();
  }

  public endGripDrag(): void {
    this.isDraggingGrip = false;
    this.activeDraggingGrip = null;
    this.rebuildMeshes();
  }

  // =========================================================================
  // MANIPULACIÓN Y ARRASTRE DE CODO (ELBOW JOG DRAG)
  // =========================================================================

  public startElbowDrag(levelId: string, end: 'start' | 'end'): boolean {
    const lvl = this.state.getLevel(levelId);
    if (!lvl) return false;
    this.isDraggingElbowGrip = true;
    this.activeDraggingElbow = { levelId, end };
    return true;
  }

  public updateElbowDrag(pos: { x: number; y: number; z: number }): void {
    if (!this.isDraggingElbowGrip || !this.activeDraggingElbow) return;
    const lvl = this.state.getLevel(this.activeDraggingElbow.levelId);
    if (!lvl) return;

    // Calcular desplazamiento vertical relativo a la cota del nivel
    const diffY = pos.y - lvl.elevation;
    const newOffset = Math.round(diffY * 20) / 20;
    // Clamping seguro entre -5.0m y +5.0m
    const clampedOffset = Math.max(-5.0, Math.min(5.0, newOffset));

    if (this.activeDraggingElbow.end === 'end') {
      if (!lvl.endElbow) {
        lvl.endElbow = { active: true, verticalOffset: 1.0, breakDistance: 2.0 };
      }
      lvl.endElbow.active = true;
      lvl.endElbow.verticalOffset = clampedOffset;
    } else {
      if (!lvl.startElbow) {
        lvl.startElbow = { active: true, verticalOffset: 1.0, breakDistance: 2.0 };
      }
      lvl.startElbow.active = true;
      lvl.startElbow.verticalOffset = clampedOffset;
    }

    this.rebuildMeshes();
  }

  public endElbowDrag(): void {
    this.isDraggingElbowGrip = false;
    this.activeDraggingElbow = null;
    this.rebuildMeshes();
  }

  // =========================================================================
  // EDICIÓN EN LÍNEA Y GESTIÓN DE PLANTILLAS / ELEMENTOS
  // =========================================================================

  public openInlineEditor(
    levelId: string,
    worldPos: THREE.Vector3,
    camera: THREE.Camera,
    domElement: HTMLElement,
    onSuccess?: () => void,
    onWarning?: (msg: string) => void
  ): void {
    const lvl = this.state.getLevel(levelId);
    if (!lvl) return;

    this.inlineEditor.open({
      worldPos,
      level: lvl,
      camera,
      domElement,
      isNameUnique: (name, excludeId) => this.state.isNameUnique(name, excludeId),
      onCommit: (newName, newElev) => {
        this.updateLevel(levelId, { name: newName, elevation: newElev });
        onSuccess?.();
      },
      onValidationWarning: onWarning,
    });
  }

  public closeInlineEditor(): void {
    this.inlineEditor.close();
  }

  private notifyLevelsChanged(): void {
    if (this.onLevelsChanged) {
      this.onLevelsChanged(this.getLevels());
    }
  }

  /**
   * Aplica un esquema predeterminado de niveles
   */
  public applyTemplate(templateId: LevelTemplateType): Level[] {
    const levels = this.state.applyTemplate(templateId, DIMENSIONS.levels.boundsExtentDefault);
    this.rebuildMeshes();
    this.notifyLevelsChanged();
    return levels;
  }

  /**
   * Generación Rápida de Niveles en lote a partir de una configuración
   */
  public quickGenerate(config: QuickGenerateLevelConfig): Level[] {
    const levels = this.state.quickGenerate(config, DIMENSIONS.levels.boundsExtentDefault);
    this.rebuildMeshes();
    this.notifyLevelsChanged();
    return levels;
  }

  public setLevels(elements: Level[]): void {
    this.state.elements = [...elements].sort((a, b) => a.elevation - b.elevation);
    this.state.syncWithGlobalConfig();
    this.rebuildMeshes();
    this.notifyLevelsChanged();
  }

  public getLevels(): Level[] {
    return this.state.getLevels();
  }

  public getLevel(id: string): Level | undefined {
    return this.state.getLevel(id);
  }

  public addLevel(levelData: Partial<Level> & { elevation: number }): Level {
    const lvl = this.state.addLevel(levelData);
    this.rebuildMeshes();
    this.notifyLevelsChanged();
    return lvl;
  }

  public updateLevel(id: string, partial: Partial<Level>): void {
    const success = this.state.updateLevel(id, partial);
    if (success) {
      this.rebuildMeshes();
      this.notifyLevelsChanged();
    }
  }

  public deleteLevel(id: string): void {
    const success = this.state.deleteLevel(id);
    if (success) {
      if (this.selectedLevelId === id) {
        this.selectedLevelId = null;
      }
      this.rebuildMeshes();
      this.notifyLevelsChanged();
    }
  }

  public clear(): void {
    this.state.clear();
    this.selectedLevelId = null;
    this.hoveredLevelId = null;
    this.rebuildMeshes();
    this.notifyLevelsChanged();
  }

  public resetToDefault(): void {
    this.state.initDefaultLevel();
    this.selectedLevelId = null;
    this.hoveredLevelId = null;
    this.rebuildMeshes();
    this.notifyLevelsChanged();
  }

  public toggleElbow(id: string, end: 'start' | 'end'): void {
    this.state.toggleElbow(id, end);
    this.rebuildMeshes();
  }

  public toggleBubble(id: string, end: 'start' | 'end'): void {
    this.state.toggleBubble(id, end);
    this.rebuildMeshes();
  }

  public toggleLock(id: string): void {
    this.state.toggleLock(id);
    this.rebuildMeshes();
  }

  /**
   * Reconstruye los gráficos en la escena
   */
  public rebuildMeshes(boundsExtent: number = DIMENSIONS.levels.boundsExtentDefault): void {
    const levels = this.state.getLevels();
    this.renderer.rebuild(levels, this.selectedLevelId, this.hoveredLevelId, boundsExtent);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}

export default LevelSystem;
