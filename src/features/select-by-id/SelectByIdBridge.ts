import type { SelectByIdResult } from './SelectByIdTypes';

export const OPEN_SELECT_BY_ID_EVENT = 'arm:select-by-id:open';
export const SELECT_BY_ID_RESULT_EVENT = 'arm:select-by-id:result';

export function requestOpenSelectById(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SELECT_BY_ID_EVENT));
}

export function publishSelectByIdResult(result: SelectByIdResult): void {
  window.dispatchEvent(new CustomEvent<SelectByIdResult>(SELECT_BY_ID_RESULT_EVENT, { detail: result }));
}
