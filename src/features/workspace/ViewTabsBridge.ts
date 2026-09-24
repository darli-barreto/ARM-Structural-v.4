import type { BimView } from '../../core/views/BimView';
import type { SplitLayout, ViewManager } from '../../core/views/ViewManager';

export const VIEW_TABS_UPDATED_EVENT = 'arm:view-tabs:updated';

export interface ViewTabsSnapshot {
  manager: ViewManager;
  openViews: BimView[];
  activeId: string;
  allViews: BimView[];
  layoutMode: SplitLayout;
}

export function publishViewTabs(
  manager: ViewManager,
  openViews: BimView[],
  activeId: string,
  allViews: BimView[]
): void {
  window.dispatchEvent(new CustomEvent<ViewTabsSnapshot>(VIEW_TABS_UPDATED_EVENT, {
    detail: { manager, openViews, activeId, allViews, layoutMode: manager.layoutMode },
  }));
}
