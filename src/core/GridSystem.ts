import { GridFacade } from './grid/GridFacade';

export type {
  GripHandle,
  BubbleToggleHit,
  AlignedDragItem,
  GridDisplayMode,
  ElbowGripHandle,
  ElbowToggleHit,
  BubbleHitProxy,
} from './grid/types/GridTypes';
export { GridMath } from './grid/math/GridMath';
export { GridSprites } from './grid/rendering/GridSprites';
export { GridRenderer } from './grid/rendering/GridRenderer';
export { GridStateManager } from './grid/state/GridStateManager';
export { GridAlignmentHandler } from './grid/interaction/GridAlignmentHandler';
export { GridFacade } from './grid/GridFacade';

/**
 * GridSystem (Facade)
 * Punto de entrada principal retrocompatible para el sistema de grillas BIM.
 * Hereda de GridFacade, delegando sus responsabilidades a submódulos de arquitectura limpia.
 */
export class GridSystem extends GridFacade {}

export default GridSystem;
