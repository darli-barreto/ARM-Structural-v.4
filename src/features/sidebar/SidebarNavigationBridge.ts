export type SidebarTabId = 'properties' | 'browser';

export const SIDEBAR_NAVIGATE_EVENT = 'arm:sidebar:navigate';

export function requestSidebarTab(tab: SidebarTabId): void {
  window.dispatchEvent(new CustomEvent<SidebarTabId>(SIDEBAR_NAVIGATE_EVENT, { detail: tab }));
}
