import type { BimCategory } from '../../core/database/BimDatabaseTypes';

export const OPEN_PROJECT_VIEW_EVENT = 'arm:project-browser:open-view';
export const OPEN_PROJECT_SCHEDULE_EVENT = 'arm:project-browser:open-schedule';

export function requestOpenProjectView(viewId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_PROJECT_VIEW_EVENT, { detail: viewId }));
}

export function requestOpenProjectSchedule(category: BimCategory | 'ALL'): void {
  window.dispatchEvent(new CustomEvent<BimCategory | 'ALL'>(OPEN_PROJECT_SCHEDULE_EVENT, { detail: category }));
}
