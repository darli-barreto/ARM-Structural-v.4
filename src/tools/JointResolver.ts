import { STRUCTURAL_SPECS } from '../config/structural.config';

export interface ColumnElevations {
  yStart: number;
  yEnd: number;
  height: number;
}

export interface SpanCoordinates {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
}

export interface BayBoundary {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  widthX: number;
  lengthZ: number;
}

export class JointResolver {
  public static resolveColumnElevations(levelIdx: number, baseLevelElev: number, topLevelElev: number): ColumnElevations {
    const specs = STRUCTURAL_SPECS;
    
    let yStart: number;
    if (levelIdx === 0) {
      yStart = specs.footing.height;
    } else {
      yStart = baseLevelElev;
    }

    const yEnd = topLevelElev - specs.beam.height;
    const height = Math.max(0, yEnd - yStart);

    return { yStart, yEnd, height };
  }

  /**
   * Extiende las vigas en X en los bordes del edificio para cubrir completamente
   * las cabezas de las columnas exteriores (eliminando el diente de 20cm expuesto).
   */
  public static resolveBeamX(
    bayIdxX: number,
    totalBaysX: number,
    startX: number,
    endX: number,
    elevY: number,
    z: number
  ): SpanCoordinates {
    const colHalfW = STRUCTURAL_SPECS.column.width / 2; // 0.20m

    let x1 = startX;
    let x2 = endX;

    if (bayIdxX === 0) {
      x1 = startX - colHalfW;
    }
    if (bayIdxX === totalBaysX - 1) {
      x2 = endX + colHalfW;
    }

    return { x1, y1: elevY, z1: z, x2, y2: elevY, z2: z };
  }

  public static resolveBeamZ(startZ: number, endZ: number, elevY: number, x: number): SpanCoordinates {
    const beamHalfW = STRUCTURAL_SPECS.beam.width / 2;
    return {
      x1: x,
      y1: elevY,
      z1: startZ + beamHalfW,
      x2: x,
      y2: elevY,
      z2: endZ - beamHalfW
    };
  }

  public static resolveSlabBay(gridX1: number, gridX2: number, gridZ1: number, gridZ2: number): BayBoundary {
    const beamHalfW = STRUCTURAL_SPECS.beam.width / 2;

    const minX = Math.min(gridX1, gridX2) + beamHalfW;
    const maxX = Math.max(gridX1, gridX2) - beamHalfW;
    const minZ = Math.min(gridZ1, gridZ2) + beamHalfW;
    const maxZ = Math.max(gridZ1, gridZ2) - beamHalfW;

    const widthX = Math.max(0, maxX - minX);
    const lengthZ = Math.max(0, maxZ - minZ);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return { minX, maxX, minZ, maxZ, centerX, centerZ, widthX, lengthZ };
  }
}
