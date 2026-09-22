import {
  DEFAULT_GRID_X,
  DEFAULT_GRID_Z,
  GridAxis,
  GridElement,
  updateActiveGrids,
} from '../../../config/structural.config';
import { GridDisplayMode } from '../types/GridTypes';

export class GridStateManager {
  public elements: GridElement[] = [];
  public axesX: GridAxis[] = [];
  public axesZ: GridAxis[] = [];

  public selectedGridId: string | null = null;
  public hoveredGridId: string | null = null;
  public currentMode: GridDisplayMode = 'all';
  public activeLevelIdx = 0;

  /**
   * Carga la grilla por defecto para el modelo de prueba (5x5).
   */
  public loadDefaultTestGrid(): void {
    this.axesX = [...DEFAULT_GRID_X];
    this.axesZ = [...DEFAULT_GRID_Z];
    this.elements = [];

    const minX = -12;
    const maxX = 12;
    const minZ = -12;
    const maxZ = 12;

    this.axesX.forEach(ax => {
      this.elements.push({
        id: ax.id,
        name: ax.name,
        geomType: 'line',
        start: { x: ax.coord, z: minZ - 3 },
        end: { x: ax.coord, z: maxZ + 3 },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
    });

    this.axesZ.forEach(ax => {
      this.elements.push({
        id: ax.id,
        name: ax.name,
        geomType: 'line',
        start: { x: minX - 3, z: ax.coord },
        end: { x: maxX + 3, z: ax.coord },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
    });

    this.syncOrthogonalAxes();
  }

  public hasGrids(): boolean {
    return this.elements.length > 0;
  }

  public clear(): void {
    this.elements = [];
    this.axesX = [];
    this.axesZ = [];
    this.selectedGridId = null;
    this.hoveredGridId = null;
    this.syncOrthogonalAxes();
  }

  public getGridX(): number[] {
    const xs = new Set<number>();
    this.elements.forEach(el => {
      if (el.geomType === 'line' && Math.abs(el.start.x - el.end.x) < 0.05) {
        xs.add(Number(el.start.x.toFixed(2)));
      }
    });
    return Array.from(xs).sort((a, b) => a - b);
  }

  public getGridZ(): number[] {
    const zs = new Set<number>();
    this.elements.forEach(el => {
      if (el.geomType === 'line' && Math.abs(el.start.z - el.end.z) < 0.05) {
        zs.add(Number(el.start.z.toFixed(2)));
      }
    });
    return Array.from(zs).sort((a, b) => a - b);
  }

  public quickGenerate(spacingX: number, spacingZ: number, countX = 5, countZ = 5): void {
    this.elements = [];
    this.axesX = [];
    this.axesZ = [];

    const totalWidthX = (countX - 1) * spacingX;
    const totalWidthZ = (countZ - 1) * spacingZ;
    const startX = -totalWidthX / 2;
    const startZ = -totalWidthZ / 2;

    const extX = totalWidthX / 2 + 4;
    const extZ = totalWidthZ / 2 + 4;

    for (let i = 0; i < countX; i++) {
      const coord = Number((startX + i * spacingX).toFixed(2));
      const id = `x-${i + 1}`;
      const name = (i + 1).toString();
      this.axesX.push({ id, name, type: 'x', coord });
      this.elements.push({
        id,
        name,
        geomType: 'line',
        start: { x: coord, z: -extZ },
        end: { x: coord, z: extZ },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
    }

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let j = 0; j < countZ; j++) {
      const coord = Number((startZ + j * spacingZ).toFixed(2));
      const letName = letters[j] || `${j + 1}`;
      const id = `z-${letName.toLowerCase()}`;
      this.axesZ.push({ id, name: letName, type: 'z', coord });
      this.elements.push({
        id,
        name: letName,
        geomType: 'line',
        start: { x: -extX, z: coord },
        end: { x: extX, z: coord },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
    }

    this.syncOrthogonalAxes();
  }

  public applyTemplate(type: '5x5' | '4x4' | '6x6'): void {
    if (type === '5x5') this.quickGenerate(6, 6, 5, 5);
    else if (type === '4x4') this.quickGenerate(6, 6, 4, 4);
    else if (type === '6x6') this.quickGenerate(5, 5, 6, 6);
  }

  public addGridElement(el: GridElement): GridElement {
    this.elements.push(el);
    this.syncOrthogonalAxes();
    return el;
  }

  public addAxis(type: 'x' | 'z', coord: number): GridAxis {
    const ext = 16;
    if (type === 'x') {
      const nextNum = (this.axesX.length + 1).toString();
      const id = `x-${Date.now()}`;
      const axis: GridAxis = { id, name: nextNum, type: 'x', coord };
      this.axesX.push(axis);
      this.elements.push({
        id,
        name: nextNum,
        geomType: 'line',
        start: { x: coord, z: -ext },
        end: { x: coord, z: ext },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
      this.syncOrthogonalAxes();
      return axis;
    } else {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nextLet = letters[this.axesZ.length] || `${this.axesZ.length + 1}`;
      const id = `z-${Date.now()}`;
      const axis: GridAxis = { id, name: nextLet, type: 'z', coord };
      this.axesZ.push(axis);
      this.elements.push({
        id,
        name: nextLet,
        geomType: 'line',
        start: { x: -ext, z: coord },
        end: { x: ext, z: coord },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
      });
      this.syncOrthogonalAxes();
      return axis;
    }
  }

  public deleteGrid(gridId: string): void {
    this.elements = this.elements.filter(e => e.id !== gridId);
    if (this.selectedGridId === gridId) this.selectedGridId = null;
    if (this.hoveredGridId === gridId) this.hoveredGridId = null;
    this.syncOrthogonalAxes();
  }

  public selectGrid(gridId: string | null): void {
    this.selectedGridId = gridId;
  }

  public getSelectedGrid(): GridElement | null {
    if (!this.selectedGridId) return null;
    return this.elements.find(e => e.id === this.selectedGridId) || null;
  }

  public toggleBubble(gridId: string, end: 'start' | 'end'): void {
    const grid = this.elements.find(e => e.id === gridId);
    if (!grid) return;
    if (end === 'start') {
      grid.showStartBubble = !grid.showStartBubble;
    } else {
      grid.showEndBubble = !grid.showEndBubble;
    }
  }

  public toggleElbow(gridId: string, end: 'start' | 'end'): void {
    const grid = this.elements.find(e => e.id === gridId);
    if (!grid || grid.geomType !== 'line') return;

    if (end === 'start') {
      if (!grid.startElbow) {
        grid.startElbow = { active: true, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.startElbow.active = !grid.startElbow.active;
      }
    } else {
      if (!grid.endElbow) {
        grid.endElbow = { active: true, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.endElbow.active = !grid.endElbow.active;
      }
    }
  }

  public renameGrid(gridId: string, newName: string): boolean {
    const grid = this.elements.find(e => e.id === gridId);
    if (!grid) return false;
    grid.name = newName;
    const axX = this.axesX.find(a => a.id === gridId);
    if (axX) axX.name = newName;
    const axZ = this.axesZ.find(a => a.id === gridId);
    if (axZ) axZ.name = newName;
    return true;
  }

  public syncOrthogonalAxes(): void {
    this.axesX = [];
    this.axesZ = [];
    this.elements.forEach(el => {
      if (el.geomType === 'line') {
        if (Math.abs(el.start.x - el.end.x) < 0.05) {
          this.axesX.push({
            id: el.id,
            name: el.name,
            type: 'x',
            coord: Number(el.start.x.toFixed(2)),
          });
        } else if (Math.abs(el.start.z - el.end.z) < 0.05) {
          this.axesZ.push({
            id: el.id,
            name: el.name,
            type: 'z',
            coord: Number(el.start.z.toFixed(2)),
          });
        }
      }
    });
    this.axesX.sort((a, b) => a.coord - b.coord);
    this.axesZ.sort((a, b) => a.coord - b.coord);
    updateActiveGrids(this.getGridX(), this.getGridZ());
  }
}
