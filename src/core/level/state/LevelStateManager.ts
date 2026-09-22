import {
  Level,
  LevelTemplateType,
  LevelValidationResult,
  QuickGenerateLevelConfig,
} from '../types/LevelTypes';
import { LevelQuickGenerator } from '../generator/LevelQuickGenerator';
import { LevelInfo, updateActiveLevels } from '../../../config/structural.config';

export class LevelStateManager {
  /**
   * Colección en memoria de niveles del proyecto BIM.
   * ESTADO INICIAL: Totalmente vacío (canvas en blanco).
   */
  public elements: Level[] = [];

  public selectedLevelId: string | null = null;
  public hoveredLevelId: string | null = null;
  public activeLevelIdx: number = 0;

  constructor(withDefaultLevel: boolean = true) {
    this.elements = [];
    if (withDefaultLevel) {
      this.initDefaultLevel();
    } else {
      this.syncWithGlobalConfig();
    }
  }

  /**
   * Inicializa la plantilla por defecto estándar de Revit:
   * 1 solo nivel base: Nivel 1 (0.00 m)
   */
  public initDefaultLevel(): void {
    const defaultBounds = 22.0;
    this.elements = [
      {
        id: 'lvl-1',
        name: 'Nivel 1 (0.00 m)',
        elevation: 0.00,
        start: { x: -defaultBounds, z: -defaultBounds },
        end: { x: defaultBounds, z: defaultBounds },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
        hasPlanView: true,
      },
    ];
    this.selectedLevelId = null;
    this.hoveredLevelId = null;
    this.activeLevelIdx = 0;
    this.syncWithGlobalConfig();
  }

  /**
   * Retorna true si hay al menos un nivel cargado en el proyecto
   */
  public hasLevels(): boolean {
    return this.elements.length > 0;
  }

  /**
   * Limpia todos los niveles del modelo (reinicio a canvas en blanco)
   */
  public clear(): void {
    this.elements = [];
    this.selectedLevelId = null;
    this.hoveredLevelId = null;
    this.activeLevelIdx = 0;
    this.syncWithGlobalConfig();
  }

  /**
   * Retorna una copia de los niveles ordenados por cota de elevación ascendente
   */
  public getLevels(): Level[] {
    return [...this.elements].sort((a, b) => a.elevation - b.elevation);
  }

  /**
   * Obtiene un nivel por su ID único
   */
  public getLevel(id: string): Level | undefined {
    return this.elements.find(l => l.id === id);
  }

  /**
   * Obtiene un nivel por su nombre (búsqueda insensible a mayúsculas)
   */
  public getLevelByName(name: string): Level | undefined {
    const clean = name.trim().toLowerCase();
    return this.elements.find(l => l.name.trim().toLowerCase() === clean);
  }

  /**
   * Valida si un nombre propuesto es único en el proyecto
   */
  public isNameUnique(name: string, excludeId?: string): boolean {
    const clean = name.trim().toLowerCase();
    return !this.elements.some(
      l => l.id !== excludeId && l.name.trim().toLowerCase() === clean
    );
  }

  /**
   * Genera un nombre garantizado como único (añade sufijo si ya existe)
   */
  public getUniqueName(desiredName: string, excludeId?: string): string {
    const trimmed = desiredName.trim();
    if (this.isNameUnique(trimmed, excludeId)) {
      return trimmed;
    }

    let counter = 1;
    let candidate = `${trimmed} (${counter})`;
    while (!this.isNameUnique(candidate, excludeId)) {
      counter++;
      candidate = `${trimmed} (${counter})`;
    }
    return candidate;
  }

  /**
   * Valida nombre y cota para un nivel
   */
  public validateLevel(
    name: string,
    elevation: number,
    excludeId?: string,
    tolerance = 0.01
  ): LevelValidationResult {
    if (!name || !name.trim()) {
      return { valid: false, error: 'El nombre del nivel no puede estar vacío.' };
    }

    if (!this.isNameUnique(name, excludeId)) {
      const suggested = this.getUniqueName(name, excludeId);
      return {
        valid: false,
        error: `Ya existe un nivel llamado "${name.trim()}".`,
        suggestedName: suggested,
      };
    }

    // Verificar si ya existe un nivel exactamente a la misma cota
    const duplicateElev = this.elements.find(
      l => l.id !== excludeId && Math.abs(l.elevation - elevation) < tolerance
    );
    if (duplicateElev) {
      return {
        valid: false,
        error: `Ya existe el nivel "${duplicateElev.name}" en la cota ${LevelQuickGenerator.formatElevation(elevation)}.`,
      };
    }

    return { valid: true };
  }

  /**
   * Agrega un nuevo nivel individual al proyecto
   */
  public addLevel(levelData: Partial<Level> & { elevation: number }): Level {
    const defaultBounds = 22.0;
    const elevation = Number(levelData.elevation.toFixed(2));
    const rawName = levelData.name?.trim() || `Nivel (${LevelQuickGenerator.formatElevation(elevation)})`;
    const uniqueName = this.getUniqueName(rawName);

    const newLevel: Level = {
      id: levelData.id || `lvl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: uniqueName,
      elevation,
      start: levelData.start || { x: -defaultBounds, z: -defaultBounds },
      end: levelData.end || { x: defaultBounds, z: defaultBounds },
      showStartBubble: levelData.showStartBubble ?? true,
      showEndBubble: levelData.showEndBubble ?? true,
      isLocked: levelData.isLocked ?? true,
      hasPlanView: levelData.hasPlanView ?? true,
      startElbow: levelData.startElbow,
      endElbow: levelData.endElbow,
    };

    this.elements.push(newLevel);
    this.elements.sort((a, b) => a.elevation - b.elevation);
    this.syncWithGlobalConfig();

    return newLevel;
  }

  /**
   * Actualiza las propiedades de un nivel existente
   */
  public updateLevel(id: string, partial: Partial<Level>): boolean {
    const idx = this.elements.findIndex(l => l.id === id);
    if (idx === -1) return false;

    const current = this.elements[idx];
    let updatedName = current.name;
    if (partial.name && partial.name.trim() !== current.name) {
      updatedName = this.getUniqueName(partial.name, id);
    }

    let updatedElevation = current.elevation;
    if (partial.elevation !== undefined && !isNaN(partial.elevation)) {
      updatedElevation = Number(partial.elevation.toFixed(2));
    }

    this.elements[idx] = {
      ...current,
      ...partial,
      name: updatedName,
      elevation: updatedElevation,
    };

    this.elements.sort((a, b) => a.elevation - b.elevation);
    this.syncWithGlobalConfig();
    return true;
  }

  /**
   * Elimina un nivel por su ID
   */
  public deleteLevel(id: string): boolean {
    const initialLen = this.elements.length;
    this.elements = this.elements.filter(l => l.id !== id);

    if (this.selectedLevelId === id) this.selectedLevelId = null;
    if (this.hoveredLevelId === id) this.hoveredLevelId = null;

    if (this.elements.length !== initialLen) {
      this.syncWithGlobalConfig();
      return true;
    }
    return false;
  }

  /**
   * Crea un nuevo nivel por desfase (Pick Line / Offset) a partir de uno existente
   */
  public createLevelByOffset(
    referenceLevelId: string,
    offset: number,
    makePlanView: boolean = true
  ): Level | null {
    const ref = this.getLevel(referenceLevelId);
    if (!ref) return null;

    const newElev = Number((ref.elevation + offset).toFixed(2));
    const baseName = ref.name.split('(')[0]?.trim() || 'Nivel';
    const desiredName = `${baseName} (+${offset > 0 ? '+' : ''}${offset.toFixed(2)}m)`;

    return this.addLevel({
      elevation: newElev,
      name: desiredName,
      start: { ...ref.start },
      end: { ...ref.end },
      hasPlanView: makePlanView,
      isLocked: true,
      showStartBubble: ref.showStartBubble,
      showEndBubble: ref.showEndBubble,
    });
  }

  /**
   * Alterna la visibilidad de la burbuja/cabezal diana en el extremo
   */
  public toggleBubble(id: string, end: 'start' | 'end'): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;
    if (end === 'end') {
      lvl.showEndBubble = !lvl.showEndBubble;
    } else {
      lvl.showStartBubble = !lvl.showStartBubble;
    }
  }

  /**
   * Alterna el codo (Elbow / shoulder break) para evitar solape de textos
   */
  public toggleElbow(id: string, end: 'start' | 'end'): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;

    if (end === 'end') {
      const active = lvl.endElbow?.active;
      lvl.endElbow = {
        active: !active,
        verticalOffset: active ? 0 : 0.8,
        breakDistance: 2.5,
      };
    } else {
      const active = lvl.startElbow?.active;
      lvl.startElbow = {
        active: !active,
        verticalOffset: active ? 0 : 0.8,
        breakDistance: 2.5,
      };
    }
  }

  /**
   * Alterna el candado de alineación (lock)
   */
  public toggleLock(id: string): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;
    lvl.isLocked = !lvl.isLocked;
  }

  /**
   * Manejo de selección
   */
  public selectLevel(id: string | null): void {
    this.selectedLevelId = id;
  }

  public getSelectedLevel(): Level | null {
    if (!this.selectedLevelId) return null;
    return this.getLevel(this.selectedLevelId) || null;
  }

  /**
   * Manejo de hover (previsualización antes de clic)
   */
  public setHoveredLevel(id: string | null): void {
    this.hoveredLevelId = id;
  }

  public getHoveredLevel(): Level | null {
    if (!this.hoveredLevelId) return null;
    return this.getLevel(this.hoveredLevelId) || null;
  }

  /**
   * Generación rápida en lote (Quick Generate)
   * Reemplaza los niveles y genera entidades 100% independientes y editables.
   */
  public quickGenerate(config: QuickGenerateLevelConfig, halfExtent = 22.0): Level[] {
    const generated = LevelQuickGenerator.generate(config, halfExtent);
    this.elements = generated;
    this.selectedLevelId = null;
    this.hoveredLevelId = null;
    this.syncWithGlobalConfig();
    return this.getLevels();
  }

  /**
   * Aplica una plantilla predeterminada (Preset)
   */
  public applyTemplate(templateId: LevelTemplateType, halfExtent = 22.0): Level[] {
    const tmpl = LevelQuickGenerator.getTemplate(templateId);
    return this.quickGenerate(tmpl.config, halfExtent);
  }

  /**
   * Sincroniza con el almacén global (structural.config.ts) para que
   * herramientas de modelado y selectores reflejen las cotas reales
   */
  public syncWithGlobalConfig(): void {
    const levelInfos: LevelInfo[] = this.elements.map((lvl, index) => ({
      id: lvl.id,
      index,
      name: lvl.name,
      elevation: lvl.elevation,
    }));

    updateActiveLevels(levelInfos);

    if (this.activeLevelIdx >= this.elements.length) {
      this.activeLevelIdx = Math.max(0, this.elements.length - 1);
    }
  }
}
