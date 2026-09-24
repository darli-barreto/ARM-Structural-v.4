export const SCHEDULE_ACTION_EVENT = 'arm:schedule:action';

export type ScheduleAction =
  | { type: 'select'; id: string }
  | { type: 'delete'; id: string };

export function requestScheduleAction(action: ScheduleAction): void {
  window.dispatchEvent(new CustomEvent<ScheduleAction>(SCHEDULE_ACTION_EVENT, { detail: action }));
}
