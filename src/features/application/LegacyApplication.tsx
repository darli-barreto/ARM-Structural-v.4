'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExamplesModalView, type ExamplesLoader } from '@/features/examples/ExamplesModalView.tsx';
import { SIDEBAR_NAVIGATE_EVENT, type SidebarTabId } from '@/features/sidebar/SidebarNavigationBridge.ts';
import type { ViewTabsSnapshot } from '@/features/workspace/ViewTabsBridge.ts';
import AppShell from './AppShell';
import RibbonTabs from '../ribbon/RibbonTabs';
import SidebarNavigation from '../sidebar/SidebarNavigationView';
import FooterStatus from '../footer-status/FooterStatusView';
import ProjectBrowser from '../project-browser/ProjectBrowserView';
import RibbonPanels from '../ribbon/RibbonPanels';
import WorkspaceViewport from '../workspace/WorkspaceViewport';
import ScheduleModal from '../quantification/ScheduleModal';
import SelectByIdModal from '../select-by-id/SelectByIdModal';
import MongoInspectorModal from '../data-inspector/MongoInspectorModal';
import NormativePanel from '../normative/NormativePanelView';
import AnalysisPanel from '../analysis/AnalysisPanelView';
import ContextualSubheader from '../datum/ContextualSubheaderView';
import StructuralEngineMount from './StructuralEngineMount';
import ApplicationTitleBar from './ApplicationTitleBar';
import MobileInspectorDock from './MobileInspectorDock';
import type { RibbonTabId } from '../ribbon/RibbonTabs';

export default function LegacyApplication() {
  const [error, setError] = useState<string | null>(null);
  const [examplesLoader, setExamplesLoader] = useState<ExamplesLoader | null>(null);
  const [viewTabs, setViewTabs] = useState<ViewTabsSnapshot | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('properties');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ribbonTab, setRibbonTab] = useState<RibbonTabId>('structure');

  useEffect(() => {
    const closeSidebar = () => setSidebarOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeSidebar(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    const registerExamples = (event: Event) => {
      setExamplesLoader(() => (event as CustomEvent<ExamplesLoader>).detail);
    };
    const updateViewTabs = (event: Event) => {
      setViewTabs((event as CustomEvent<ViewTabsSnapshot>).detail);
    };
    const navigateSidebar = (event: Event) => {
      setSidebarTab((event as CustomEvent<SidebarTabId>).detail);
    };
    window.addEventListener('arm:examples:register', registerExamples);
    window.addEventListener('arm:view-tabs:updated', updateViewTabs);
    window.addEventListener(SIDEBAR_NAVIGATE_EVENT, navigateSidebar);
    return () => {
      window.removeEventListener('arm:examples:register', registerExamples);
      window.removeEventListener('arm:view-tabs:updated', updateViewTabs);
      window.removeEventListener(SIDEBAR_NAVIGATE_EVENT, navigateSidebar);
    };
  }, []);

  const handleEngineError = useCallback((message: string) => setError(message), []);

  return (
    <>
      <AppShell
        titleBar={<ApplicationTitleBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(open => !open)} viewTabs={viewTabs} />}
        ribbonTabs={<RibbonTabs active={ribbonTab} onSelect={setRibbonTab} />}
        ribbonPanels={<RibbonPanels active={ribbonTab} />}
        contextualBar={<ContextualSubheader />}
        sidebarNavigation={<SidebarNavigation active={sidebarTab} />}
        projectBrowser={<ProjectBrowser />}
        workspace={<><StructuralEngineMount onError={handleEngineError} /><WorkspaceViewport viewTabs={viewTabs} /></>}
        footerStatus={<FooterStatus />}
        sidebarOpen={sidebarOpen}
        onCloseMobileSidebar={() => setSidebarOpen(false)}
      />
      <ExamplesModalView load={examplesLoader} />
      <ScheduleModal />
      <SelectByIdModal />
      <MongoInspectorModal />
      <NormativePanel />
      <AnalysisPanel />
      <MobileInspectorDock />
      {error && (
        <div role="alert" className="fixed inset-x-4 top-4 z-[100] bg-red-950 p-3 text-sm text-white">
          No se pudo iniciar el modelador: {error}
        </div>
      )}
    </>
  );
}
