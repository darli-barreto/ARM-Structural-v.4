import type { ToolType } from '../../config/structural.config';
import type { VisualStyle } from '../../config/theme.config';

export type RibbonAction =
  | { type: 'tool'; tool: ToolType }
  | { type: 'at-grid' }
  | { type: 'examples' }
  | { type: 'clear' }
  | { type: 'visual-style'; style: VisualStyle }
  | { type: 'toggle-grids' }
  | { type: 'level'; levelIdx: number }
  | { type: 'open-schedule' }
  | { type: 'select-by-id' }
  | { type: 'open-mongo-inspector' }
  | { type: 'export-csv' }
  | { type: 'export-json' };

export const RIBBON_ACTION_EVENT = 'arm:ribbon:action';

export function requestRibbonAction(action: RibbonAction): void {
  window.dispatchEvent(new CustomEvent<RibbonAction>(RIBBON_ACTION_EVENT, { detail: action }));
}
