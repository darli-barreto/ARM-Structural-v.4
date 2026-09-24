'use client';

import type { ViewTabsSnapshot } from '@/features/workspace/ViewTabsBridge.ts';
import ViewTabs from './ViewTabs';
import ViewControlBar from './ViewControlBar';

export default function WorkspaceViewport({
  viewTabs,
}: {
  viewTabs: ViewTabsSnapshot | null;
}) {
  return (
    <main id="app-workspace" className="relative flex h-full min-w-0 flex-1 touch-none flex-col overflow-hidden bg-slate-950">
      <div
        id="view-tabs-bar"
        className="h-8 bg-slate-950 border-b border-white/10 flex items-center justify-between px-1.5 z-40 select-none relative"
      >
        <div id="react-view-tabs-slot" className="flex items-center gap-1 w-full h-full min-w-0">
          {viewTabs && <ViewTabs {...viewTabs} />}
        </div>
      </div>
      <div
        id="canvas-container"
        className="pointer-events-none absolute inset-x-0 bottom-8 top-8 z-0 w-full md:bottom-7"
      />
      <div
        id="viewports-container"
        className="pointer-events-none absolute inset-x-0 bottom-8 top-8 z-10 grid w-full grid-cols-1 grid-rows-1 gap-0.5 bg-transparent md:bottom-7"
      />
      <ViewControlBar />
    </main>
  );
}
