export const OPEN_MONGO_INSPECTOR_EVENT = 'arm:mongo-inspector:open';

export function requestOpenMongoInspector(): void {
  window.dispatchEvent(new CustomEvent(OPEN_MONGO_INSPECTOR_EVENT));
}
