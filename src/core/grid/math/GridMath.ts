import { GridElement } from '../../../config/structural.config';
import { DIMENSIONS } from '../../../config/dimensions.config';
import { AlignedDragItem } from '../types/GridTypes';

export class GridMath {
  /**
   * Restringe un punto destino a 0°, 90°, 180°, 270° respecto a un origen dado (Modo Ortho).
   */
  public static applyOrtho<T extends { x: number; y: number }>(origin: T, target: T, factory: (x: number, y: number) => T): T {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return factory(target.x, origin.y);
    } else {
      return factory(origin.x, target.y);
    }
  }

  /**
   * Comprueba si una grilla lineal es vertical (X constante).
   */
  public static isVertical(grid: GridElement, tolerance = DIMENSIONS.grid.orthoTolerance): boolean {
    if (grid.geomType !== 'line') return false;
    return Math.abs(grid.start.x - grid.end.x) < tolerance;
  }

  /**
   * Comprueba si una grilla lineal es horizontal (Z constante).
   */
  public static isHorizontal(grid: GridElement, tolerance = DIMENSIONS.grid.orthoTolerance): boolean {
    if (grid.geomType !== 'line') return false;
    return Math.abs(grid.start.z - grid.end.z) < tolerance;
  }

  /**
   * Verifica si el extremo de una grilla está alineado con otras grillas paralelas.
   */
  public static isEndpointAligned(
    targetGrid: GridElement,
    end: 'start' | 'end',
    elements: GridElement[],
    angleTolerance = DIMENSIONS.grid.alignmentAngleTolerance,
    posTolerance = DIMENSIONS.grid.alignmentPosTolerance
  ): boolean {
    if (targetGrid.geomType !== 'line') return false;

    const pt = end === 'start' ? targetGrid.start : targetGrid.end;
    const isVert = this.isVertical(targetGrid, angleTolerance);
    const isHoriz = this.isHorizontal(targetGrid, angleTolerance);

    for (const other of elements) {
      if (other.id === targetGrid.id || other.geomType !== 'line') continue;

      if (isVert && this.isVertical(other, angleTolerance)) {
        if (
          Math.abs(pt.z - other.start.z) < posTolerance ||
          Math.abs(pt.z - other.end.z) < posTolerance
        ) {
          return true;
        }
      } else if (isHoriz && this.isHorizontal(other, angleTolerance)) {
        if (
          Math.abs(pt.x - other.start.x) < posTolerance ||
          Math.abs(pt.x - other.end.x) < posTolerance
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Identifica el grupo de grillas paralelas alineadas con el extremo seleccionado para arrastre simultáneo.
   */
  public static findAlignedGroup(
    mainGrid: GridElement,
    end: 'start' | 'end',
    elements: GridElement[],
    angleTolerance = DIMENSIONS.grid.alignmentAngleTolerance,
    posTolerance = DIMENSIONS.grid.alignmentPosTolerance
  ): AlignedDragItem[] {
    const group: AlignedDragItem[] = [];
    if (mainGrid.geomType !== 'line') return group;

    const isVert = this.isVertical(mainGrid, angleTolerance);
    const isHoriz = this.isHorizontal(mainGrid, angleTolerance);
    const mainPt = end === 'start' ? mainGrid.start : mainGrid.end;

    group.push({
      gridId: mainGrid.id,
      end,
      originalCoord: isVert ? mainPt.z : mainPt.x,
    });

    elements.forEach(other => {
      if (other.id === mainGrid.id || other.geomType !== 'line') return;

      if (isVert && this.isVertical(other, angleTolerance)) {
        let matchedEnd: 'start' | 'end' | null = null;
        if (Math.abs(mainPt.z - other.start.z) < posTolerance) {
          matchedEnd = 'start';
        } else if (Math.abs(mainPt.z - other.end.z) < posTolerance) {
          matchedEnd = 'end';
        }

        if (matchedEnd) {
          group.push({
            gridId: other.id,
            end: matchedEnd,
            originalCoord: matchedEnd === 'start' ? other.start.z : other.end.z,
          });
        }
      } else if (isHoriz && this.isHorizontal(other, angleTolerance)) {
        let matchedEnd: 'start' | 'end' | null = null;
        if (Math.abs(mainPt.x - other.start.x) < posTolerance) {
          matchedEnd = 'start';
        } else if (Math.abs(mainPt.x - other.end.x) < posTolerance) {
          matchedEnd = 'end';
        }

        if (matchedEnd) {
          group.push({
            gridId: other.id,
            end: matchedEnd,
            originalCoord: matchedEnd === 'start' ? other.start.x : other.end.x,
          });
        }
      }
    });

    return group;
  }

  /**
   * Actualiza las coordenadas de un grupo de grillas alineadas durante el arrastre,
   * garantizando el blindaje matemático contra colapso geométrico (longitud mínima = 1.0m).
   */
  public static applyDragUpdate(
    mainGrid: GridElement,
    activeEnd: 'start' | 'end',
    alignedGroup: AlignedDragItem[],
    elements: GridElement[],
    cursorPos: { x: number; z: number },
    minLength: number = DIMENSIONS.grid.minSegmentLength
  ): void {
    const isVert = this.isVertical(mainGrid, DIMENSIONS.grid.orthoTolerance);
    const isHoriz = this.isHorizontal(mainGrid, DIMENSIONS.grid.orthoTolerance);

    if (isVert) {
      const newZ = cursorPos.z;
      alignedGroup.forEach(item => {
        const g = elements.find(e => e.id === item.gridId);
        if (g && g.geomType === 'line') {
          g.end.x = g.start.x; // Mantener rigurosamente la ortogonalidad

          if (item.end === 'start') {
            if (Math.abs(newZ - g.end.z) < minLength) {
              g.start.z = g.end.z + (newZ < g.end.z ? -minLength : minLength);
            } else {
              g.start.z = newZ;
            }
          } else {
            if (Math.abs(newZ - g.start.z) < minLength) {
              g.end.z = g.start.z + (newZ < g.start.z ? -minLength : minLength);
            } else {
              g.end.z = newZ;
            }
          }
        }
      });
    } else if (isHoriz) {
      const newX = cursorPos.x;
      alignedGroup.forEach(item => {
        const g = elements.find(e => e.id === item.gridId);
        if (g && g.geomType === 'line') {
          g.end.z = g.start.z; // Mantener rigurosamente la ortogonalidad

          if (item.end === 'start') {
            if (Math.abs(newX - g.end.x) < minLength) {
              g.start.x = g.end.x + (newX < g.end.x ? -minLength : minLength);
            } else {
              g.start.x = newX;
            }
          } else {
            if (Math.abs(newX - g.start.x) < minLength) {
              g.end.x = g.start.x + (newX < g.start.x ? -minLength : minLength);
            } else {
              g.end.x = newX;
            }
          }
        }
      });
    } else {
      // Rejilla inclinada: proyectar el cursor sobre la recta del eje
      const dx = mainGrid.end.x - mainGrid.start.x;
      const dz = mainGrid.end.z - mainGrid.start.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.1) {
        const ux = dx / len;
        const uz = dz / len;

        if (activeEnd === 'start') {
          const proj = (cursorPos.x - mainGrid.end.x) * ux + (cursorPos.z - mainGrid.end.z) * uz;
          const safeProj = Math.abs(proj) < minLength ? (proj < 0 ? -minLength : minLength) : proj;
          mainGrid.start.x = mainGrid.end.x + ux * safeProj;
          mainGrid.start.z = mainGrid.end.z + uz * safeProj;
        } else {
          const proj = (cursorPos.x - mainGrid.start.x) * ux + (cursorPos.z - mainGrid.start.z) * uz;
          const safeProj = Math.abs(proj) < minLength ? (proj < 0 ? -minLength : minLength) : proj;
          mainGrid.end.x = mainGrid.start.x + ux * safeProj;
          mainGrid.end.z = mainGrid.start.z + uz * safeProj;
        }
      }
    }
  }

  /**
   * Calcula la polilínea, posiciones de burbujas, empalmes (codos) e iconos de control.
   */
  public static computeElbowGeometry(grid: GridElement): {
    points: { x: number; z: number }[];
    startBubblePos: { x: number; z: number };
    endBubblePos: { x: number; z: number };
    startKneePos?: { x: number; z: number };
    endKneePos?: { x: number; z: number };
    startIconPos: { x: number; z: number };
    endIconPos: { x: number; z: number };
    startElbowGripPos?: { x: number; z: number };
    endElbowGripPos?: { x: number; z: number };
  } {
    const dx = grid.end.x - grid.start.x;
    const dz = grid.end.z - grid.start.z;
    const len = Math.hypot(dx, dz);
    const safeLen = len < 0.2 ? 1.0 : len;
    const ux = dx / safeLen;
    const uz = dz / safeLen;
    // Vector perpendicular 2D normalizado (rotación +90° en XZ)
    const vx = -uz;
    const vz = ux;

    const breakLen = Math.min(
      safeLen * DIMENSIONS.grid.controls.elbow.breakFactor,
      DIMENSIONS.grid.controls.elbow.maxBreakDistance
    );

    // 1. Extremo inicial
    const isStartElbow = !!grid.startElbow?.active;
    const startOffset = grid.startElbow?.lateralOffset || DIMENSIONS.grid.controls.elbow.defaultLateralOffset;

    let startBubblePos: { x: number; z: number };
    let startKneePos: { x: number; z: number } | undefined;
    let startIconPos: { x: number; z: number };
    let startElbowGripPos: { x: number; z: number } | undefined;

    const startPolyPoints: { x: number; z: number }[] = [];

    if (isStartElbow) {
      const k1 = { x: grid.start.x + ux * breakLen, z: grid.start.z + uz * breakLen };
      const k2 = {
        x: grid.start.x + ux * (breakLen * 0.5) + vx * startOffset,
        z: grid.start.z + uz * (breakLen * 0.5) + vz * startOffset,
      };
      const k3 = { x: grid.start.x + vx * startOffset, z: grid.start.z + vz * startOffset };

      startPolyPoints.push(k3, k2, k1);
      startBubblePos = { x: k3.x - ux * DIMENSIONS.grid.bubbleOffset, z: k3.z - uz * DIMENSIONS.grid.bubbleOffset };
      startKneePos = k2;
      startElbowGripPos = k2;
      startIconPos = { x: k1.x, z: k1.z };
    } else {
      startPolyPoints.push({ x: grid.start.x, z: grid.start.z });
      startBubblePos = { x: grid.start.x - ux * DIMENSIONS.grid.bubbleOffset, z: grid.start.z - uz * DIMENSIONS.grid.bubbleOffset };
      startIconPos = { x: grid.start.x + ux * DIMENSIONS.grid.controls.elbow.offset, z: grid.start.z + uz * DIMENSIONS.grid.controls.elbow.offset };
    }

    // 2. Extremo final
    const isEndElbow = !!grid.endElbow?.active;
    const endOffset = grid.endElbow?.lateralOffset || DIMENSIONS.grid.controls.elbow.defaultLateralOffset;

    let endBubblePos: { x: number; z: number };
    let endKneePos: { x: number; z: number } | undefined;
    let endIconPos: { x: number; z: number };
    let endElbowGripPos: { x: number; z: number } | undefined;

    const endPolyPoints: { x: number; z: number }[] = [];

    if (isEndElbow) {
      const k1 = { x: grid.end.x - ux * breakLen, z: grid.end.z - uz * breakLen };
      const k2 = {
        x: grid.end.x - ux * (breakLen * 0.5) + vx * endOffset,
        z: grid.end.z - uz * (breakLen * 0.5) + vz * endOffset,
      };
      const k3 = { x: grid.end.x + vx * endOffset, z: grid.end.z + vz * endOffset };

      endPolyPoints.push(k1, k2, k3);
      endBubblePos = { x: k3.x + ux * DIMENSIONS.grid.bubbleOffset, z: k3.z + uz * DIMENSIONS.grid.bubbleOffset };
      endKneePos = k2;
      endElbowGripPos = k2;
      endIconPos = { x: k1.x, z: k1.z };
    } else {
      endPolyPoints.push({ x: grid.end.x, z: grid.end.z });
      endBubblePos = { x: grid.end.x + ux * DIMENSIONS.grid.bubbleOffset, z: grid.end.z + uz * DIMENSIONS.grid.bubbleOffset };
      endIconPos = { x: grid.end.x - ux * DIMENSIONS.grid.controls.elbow.offset, z: grid.end.z - uz * DIMENSIONS.grid.controls.elbow.offset };
    }

    const points = [...startPolyPoints, ...endPolyPoints];

    return {
      points,
      startBubblePos,
      endBubblePos,
      startKneePos,
      endKneePos,
      startIconPos,
      endIconPos,
      startElbowGripPos,
      endElbowGripPos,
    };
  }

  /**
   * Calcula el desplazamiento lateral del codo proyectando la posición del cursor
   * sobre el eje perpendicular al elemento de rejilla.
   */
  public static calculateElbowLateralOffset(
    grid: GridElement,
    cursorPos: { x: number; z: number }
  ): number {
    const dx = grid.end.x - grid.start.x;
    const dz = grid.end.z - grid.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return DIMENSIONS.grid.controls.elbow.defaultLateralOffset;

    const ux = dx / len;
    const uz = dz / len;
    // Perpendicular vx, vz
    const vx = -uz;
    const vz = ux;

    // Vector desde start al cursor
    const cx = cursorPos.x - grid.start.x;
    const cz = cursorPos.z - grid.start.z;

    // Proyección escalar sobre el vector perpendicular
    const offset = cx * vx + cz * vz;

    // Acotar a un rango razonable y asegurar un mínimo para que se perciba el quiebre
    const clamped = Math.max(
      DIMENSIONS.grid.controls.elbow.minClampedOffset,
      Math.min(DIMENSIONS.grid.controls.elbow.maxClampedOffset, offset)
    );
    if (Math.abs(clamped) < DIMENSIONS.grid.controls.elbow.lateralThreshold) {
      return clamped < 0
        ? -DIMENSIONS.grid.controls.elbow.minFallbackOffset
        : DIMENSIONS.grid.controls.elbow.minFallbackOffset;
    }
    return Number(clamped.toFixed(2));
  }
}

