export type ProjectAction = 'save' | 'analysis' | 'normative';

export const PROJECT_ACTION_EVENT = 'arm:project-tools:action';
export const PROJECT_FILE_EVENT = 'arm:project-tools:restore-file';

export function requestProjectAction(action: ProjectAction): void {
  window.dispatchEvent(new CustomEvent<ProjectAction>(PROJECT_ACTION_EVENT, { detail: action }));
}

export function requestProjectRestore(file: File): void {
  window.dispatchEvent(new CustomEvent<File>(PROJECT_FILE_EVENT, { detail: file }));
}
