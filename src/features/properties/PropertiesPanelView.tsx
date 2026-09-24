'use client';

import { useSyncExternalStore } from 'react';
import { sidebarPropertiesStore } from '@/features/properties/SidebarPropertiesStore.ts';
import EmptyPropertiesPanel from './EmptyPropertiesPanel';
import GridPropertiesPanel from './GridPropertiesPanel';
import LevelPropertiesPanel from './LevelPropertiesPanel';
import ElementPropertiesPanel from './ElementPropertiesPanel';

export default function PropertiesPanel() {
  const snapshot = useSyncExternalStore(
    sidebarPropertiesStore.subscribe,
    sidebarPropertiesStore.getSnapshot,
    sidebarPropertiesStore.getServerSnapshot,
  );

  return (
    <>
      {snapshot.kind === 'empty' && <EmptyPropertiesPanel />}
      {snapshot.kind === 'grid' && <GridPropertiesPanel grid={snapshot.grid} />}
      {snapshot.kind === 'level' && <LevelPropertiesPanel level={snapshot.level} />}
      {snapshot.kind === 'element' && <ElementPropertiesPanel element={snapshot.element} />}
    </>
  );
}
