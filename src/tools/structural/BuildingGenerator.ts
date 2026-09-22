import * as THREE from 'three';
import { GRID_X, GRID_Z, LEVELS, LEVELS_Y, STRUCTURAL_SPECS, ToolType } from '../../config/structural.config';
import { VisualStyle } from '../../config/theme.config';
import { WasmBridge } from '../../kernel/WasmBridge';
import { JointResolver } from '../JointResolver';
import { ElementFactory } from './ElementFactory';
import { ElementRegistry } from './ElementRegistry';
import { ElementCategory, ManagedElement } from './types';
import { BimDatabase } from '../../core/database/BimDatabase';

export class BuildingGenerator {
  private counters = { footing: 0, column: 0, beam: 0, slab: 0 };

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private factory: ElementFactory,
    private registry: ElementRegistry
  ) {}

  private spawn(
    geometry: THREE.BufferGeometry, 
    type: ElementCategory, 
    volume: number, 
    style: VisualStyle,
    levelName: string,
    dimensions: string,
    coords?: { x: number; y: number; z: number },
    length?: number,
    height?: number
  ): ManagedElement {
    this.counters[type]++;
    const idPrefix = { footing: 'ZAP', column: 'COL', beam: 'VIG', slab: 'LOS' }[type];
    const id = `${idPrefix}-${this.counters[type].toString().padStart(3, '0')}`;

    // Registro formal en la Base de Datos Relacional Orientada a Objetos (MongoDB Ready)
    const bimDoc = BimDatabase.getInstance().registerElement({
      definition: geometry.userData.definition,
      legacyId: id,
      category: type,
      volume,
      levelName,
      dimensions,
      coordinates: coords,
      length,
      height,
    });

    const base = this.factory.create(geometry, type, style);
    const managed: ManagedElement = {
      ...base,
      id,
      elementId: bimDoc.elementId,
      uniqueId: bimDoc.uniqueId,
      bimDoc,
      definition: structuredClone(bimDoc.geometry.definition),
      volume,
      levelName,
      dimensions
    };

    base.mesh.userData = {
      id,
      elementId: bimDoc.elementId,
      uniqueId: bimDoc.uniqueId,
      type,
      bimDoc,
    };

    this.registry.add(managed, this.scene);
    return managed;
  }

  public buildSingle(tool: ToolType, x: number, z: number, levelIdx: number, style: VisualStyle): void {
    const specs = STRUCTURAL_SPECS;
    const levelName = LEVELS[levelIdx]?.name || `Nivel ${levelIdx}`;

    if (tool === 'zapata') {
      const data = this.wasm.createFooting(x, 0, z, specs.footing.width, specs.footing.length, specs.footing.height);
      const dims = `${specs.footing.width}m × ${specs.footing.length}m × ${specs.footing.height}m`;
      this.spawn(this.wasm.buildGeometry(data), 'footing', data.volume, style, 'Cimentación', dims, { x, y: 0, z });
    } else if (tool === 'columna') {
      const baseElev = LEVELS_Y[levelIdx];
      const topElev = LEVELS_Y[Math.min(levelIdx + 1, LEVELS_Y.length - 1)];
      const { yStart, yEnd, height } = JointResolver.resolveColumnElevations(levelIdx, baseElev, topElev);
      const data = this.wasm.createColumn(x, z, yStart, yEnd, specs.column.width, specs.column.depth);
      const dims = `${specs.column.width}m × ${specs.column.depth}m (h=${height.toFixed(2)}m)`;
      this.spawn(this.wasm.buildGeometry(data), 'column', data.volume, style, levelName, dims, { x, y: yStart, z }, undefined, height);
    } else if (tool === 'viga') {
      const idxX = GRID_X.indexOf(x);
      const totalBaysX = GRID_X.length - 1;
      if (idxX >= 0 && idxX < totalBaysX) {
        const nextX = GRID_X[idxX + 1];
        const elevY = LEVELS_Y[Math.max(1, levelIdx)];
        const span = JointResolver.resolveBeamX(idxX, totalBaysX, x, nextX, elevY, z);
        const data = this.wasm.createBeam(span.x1, span.y1, span.z1, span.x2, span.y2, span.z2, specs.beam.width, specs.beam.height);
        const length = Math.abs(span.x2 - span.x1);
        const dims = `${specs.beam.width}m × ${specs.beam.height}m (L=${length.toFixed(2)}m)`;
        this.spawn(this.wasm.buildGeometry(data), 'beam', data.volume, style, levelName, dims, { x: span.x1, y: span.y1, z: span.z1 }, length);
      }
    } else if (tool === 'techo') {
      const idxX = GRID_X.indexOf(x);
      const idxZ = GRID_Z.indexOf(z);
      if (idxX < GRID_X.length - 1 && idxZ < GRID_Z.length - 1) {
        const bay = JointResolver.resolveSlabBay(x, GRID_X[idxX + 1], z, GRID_Z[idxZ + 1]);
        const elevY = LEVELS_Y[Math.max(1, levelIdx)] - specs.slab.thickness;
        const data = this.wasm.createSlab(bay.centerX, elevY, bay.centerZ, bay.widthX, bay.lengthZ, specs.slab.thickness);
        const dims = `${bay.widthX.toFixed(2)}m × ${bay.lengthZ.toFixed(2)}m (e=${specs.slab.thickness}m)`;
        this.spawn(this.wasm.buildGeometry(data), 'slab', data.volume, style, levelName, dims, { x: bay.centerX, y: elevY, z: bay.centerZ });
      }
    }
  }

  public buildAtGridIntersections(tool: ToolType, levelIdx: number, style: VisualStyle): void {
    const specs = STRUCTURAL_SPECS;
    const levelName = LEVELS[levelIdx]?.name || `Nivel ${levelIdx}`;

    if (tool === 'zapata') {
      GRID_X.forEach(x => {
        GRID_Z.forEach(z => {
          const data = this.wasm.createFooting(x, 0, z, specs.footing.width, specs.footing.length, specs.footing.height);
          const dims = `${specs.footing.width}m × ${specs.footing.length}m × ${specs.footing.height}m`;
          this.spawn(this.wasm.buildGeometry(data), 'footing', data.volume, style, 'Cimentación', dims, { x, y: 0, z });
        });
      });
    } else if (tool === 'columna') {
      const baseElev = LEVELS_Y[levelIdx];
      const topElev = LEVELS_Y[Math.min(levelIdx + 1, LEVELS_Y.length - 1)];
      const { yStart, yEnd, height } = JointResolver.resolveColumnElevations(levelIdx, baseElev, topElev);

      GRID_X.forEach(x => {
        GRID_Z.forEach(z => {
          const data = this.wasm.createColumn(x, z, yStart, yEnd, specs.column.width, specs.column.depth);
          const dims = `${specs.column.width}m × ${specs.column.depth}m (h=${height.toFixed(2)}m)`;
          this.spawn(this.wasm.buildGeometry(data), 'column', data.volume, style, levelName, dims, { x, y: yStart, z }, undefined, height);
        });
      });
    } else if (tool === 'viga') {
      this.buildBeamsForLevel(LEVELS_Y[Math.max(1, levelIdx)], levelName, style);
    } else if (tool === 'techo') {
      this.buildSlabsForLevel(LEVELS_Y[Math.max(1, levelIdx)], levelName, style);
    }
  }

  public buildBeamsForLevel(elevY: number, levelName: string, style: VisualStyle): void {
    const specs = STRUCTURAL_SPECS;
    const totalBaysX = GRID_X.length - 1;

    for (let i = 0; i < totalBaysX; i++) {
      for (let j = 0; j < GRID_Z.length; j++) {
        const span = JointResolver.resolveBeamX(i, totalBaysX, GRID_X[i], GRID_X[i + 1], elevY, GRID_Z[j]);
        const data = this.wasm.createBeam(span.x1, span.y1, span.z1, span.x2, span.y2, span.z2, specs.beam.width, specs.beam.height);
        const length = Math.abs(span.x2 - span.x1);
        const dims = `${specs.beam.width}m × ${specs.beam.height}m (L=${length.toFixed(2)}m)`;
        this.spawn(this.wasm.buildGeometry(data), 'beam', data.volume, style, levelName, dims, { x: span.x1, y: span.y1, z: span.z1 }, length);
      }
    }

    for (let i = 0; i < GRID_X.length; i++) {
      for (let j = 0; j < GRID_Z.length - 1; j++) {
        const span = JointResolver.resolveBeamZ(GRID_Z[j], GRID_Z[j + 1], elevY, GRID_X[i]);
        const data = this.wasm.createBeam(span.x1, span.y1, span.z1, span.x2, span.y2, span.z2, specs.beam.width, specs.beam.height);
        const length = Math.abs(span.z2 - span.z1);
        const dims = `${specs.beam.width}m × ${specs.beam.height}m (L=${length.toFixed(2)}m)`;
        this.spawn(this.wasm.buildGeometry(data), 'beam', data.volume, style, levelName, dims, { x: span.x1, y: span.y1, z: span.z1 }, length);
      }
    }
  }

  public buildSlabsForLevel(elevY: number, levelName: string, style: VisualStyle): void {
    const specs = STRUCTURAL_SPECS;
    const slabY = elevY - specs.slab.thickness;

    for (let i = 0; i < GRID_X.length - 1; i++) {
      for (let j = 0; j < GRID_Z.length - 1; j++) {
        const bay = JointResolver.resolveSlabBay(GRID_X[i], GRID_X[i + 1], GRID_Z[j], GRID_Z[j + 1]);
        const data = this.wasm.createSlab(bay.centerX, slabY, bay.centerZ, bay.widthX, bay.lengthZ, specs.slab.thickness);
        const dims = `${bay.widthX.toFixed(2)}m × ${bay.lengthZ.toFixed(2)}m (e=${specs.slab.thickness}m)`;
        this.spawn(this.wasm.buildGeometry(data), 'slab', data.volume, style, levelName, dims, { x: bay.centerX, y: slabY, z: bay.centerZ });
      }
    }
  }

  public buildFullBuilding(style: VisualStyle): void {
    const specs = STRUCTURAL_SPECS;

    // 1. Zapatas
    GRID_X.forEach(x => GRID_Z.forEach(z => {
      const data = this.wasm.createFooting(x, 0, z, specs.footing.width, specs.footing.length, specs.footing.height);
      const dims = `${specs.footing.width}m × ${specs.footing.length}m × ${specs.footing.height}m`;
      this.spawn(this.wasm.buildGeometry(data), 'footing', data.volume, style, 'Cimentación', dims, { x, y: 0, z });
    }));

    // 2. Pisos
    for (let l = 0; l < LEVELS_Y.length - 1; l++) {
      const yBase = LEVELS_Y[l];
      const yTecho = LEVELS_Y[l + 1];
      const levelName = LEVELS[l + 1]?.name || `Nivel ${l + 1}`;

      const { yStart, yEnd, height } = JointResolver.resolveColumnElevations(l, yBase, yTecho);
      GRID_X.forEach(x => GRID_Z.forEach(z => {
        const col = this.wasm.createColumn(x, z, yStart, yEnd, specs.column.width, specs.column.depth);
        const dims = `${specs.column.width}m × ${specs.column.depth}m (h=${height.toFixed(2)}m)`;
        this.spawn(this.wasm.buildGeometry(col), 'column', col.volume, style, levelName, dims, { x, y: yStart, z }, undefined, height);
      }));

      this.buildBeamsForLevel(yTecho, levelName, style);
      this.buildSlabsForLevel(yTecho, levelName, style);
    }
  }
}
