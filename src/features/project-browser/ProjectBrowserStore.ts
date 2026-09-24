import type { Level } from '../../core/level/types/LevelTypes';
import type { BimView } from '../../core/views/BimView';

export interface ProjectBrowserLevel {
  id: string;
  name: string;
  elevation: number;
  hasPlanView: boolean;
}

export interface ProjectBrowserView {
  id: string;
  title: string;
  type: BimView['type'];
}

export interface ProjectBrowserSnapshot {
  levels: ProjectBrowserLevel[];
  views: ProjectBrowserView[];
  activeViewId: string;
}

const initialSnapshot: ProjectBrowserSnapshot = {
  levels: [],
  views: [],
  activeViewId: 'view-3d',
};

let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function sameItems<T extends { id: string }>(left: T[], right: T[], keys: (keyof T)[]): boolean {
  return left.length === right.length && left.every((item, index) =>
    keys.every(key => item[key] === right[index][key])
  );
}

export const projectBrowserStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  getServerSnapshot() {
    return initialSnapshot;
  },
  update(levels: Level[], views: BimView[], activeViewId: string) {
    const nextLevels = levels.map(({ id, name, elevation, hasPlanView }) => ({ id, name, elevation, hasPlanView }));
    const nextViews = views.filter(view => !view.id.startsWith('dual-')).map(({ id, title, type }) => ({ id, title, type }));
    if (
      snapshot.activeViewId === activeViewId &&
      sameItems(snapshot.levels, nextLevels, ['id', 'name', 'elevation', 'hasPlanView']) &&
      sameItems(snapshot.views, nextViews, ['id', 'title', 'type'])
    ) return;

    snapshot = { levels: nextLevels, views: nextViews, activeViewId };
    listeners.forEach(listener => listener());
  },
};
