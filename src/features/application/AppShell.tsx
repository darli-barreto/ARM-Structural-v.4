import type { ReactNode } from 'react';
import PropertiesPanel from '../properties/PropertiesPanelView';

type AppShellProps = {
  titleBar: ReactNode;
  ribbonTabs: ReactNode;
  ribbonPanels: ReactNode;
  contextualBar: ReactNode;
  sidebarNavigation: ReactNode;
  projectBrowser: ReactNode;
  workspace: ReactNode;
  footerStatus: ReactNode;
  sidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
};

export default function AppShell({
  titleBar,
  ribbonTabs,
  ribbonPanels,
  contextualBar,
  sidebarNavigation,
  projectBrowser,
  workspace,
  footerStatus,
  sidebarOpen,
  onCloseMobileSidebar,
}: AppShellProps) {
  return (
    <div id="app-root" className="flex h-[100dvh] w-full flex-col overflow-hidden overflow-x-hidden overscroll-none">
      <header id="app-header" className="z-50 flex shrink-0 flex-col border-b border-slate-300 bg-slate-100">
        <div id="react-title-bar-slot">{titleBar}</div>
        <div
          id="react-ribbon-tabs-slot"
          className="ribbon-tabs-bar hidden gap-0.5 overflow-x-auto border-b border-slate-300 bg-slate-100 px-2 md:flex"
        >{ribbonTabs}</div>
        <div id="react-ribbon-panels-slot" className="hidden md:block">{ribbonPanels}</div>
        <div id="react-contextual-subbar-slot" className="hidden md:block">{contextualBar}</div>
      </header>

      <div id="app-body" className="relative flex flex-1 overflow-hidden">
        <aside
          id="app-sidebar"
          className={`absolute inset-y-0 left-0 z-40 w-[min(320px,calc(100vw-44px))] shrink-0 select-none flex-col border-r border-white/10 bg-slate-800 shadow-xl ${sidebarOpen ? 'flex' : 'hidden'} md:relative md:inset-auto md:flex md:w-70 md:shadow-none`}
        >
          <div
            id="sidebar-properties"
            className="sidebar-tab-content block flex-1 overflow-y-auto p-3 text-xs max-md:[&_input]:pointer-events-none max-md:[&_input]:opacity-60 max-md:[&_select]:pointer-events-none max-md:[&_select]:opacity-60"
          >
            <div id="properties-content"><PropertiesPanel /></div>
          </div>
          <div
            id="sidebar-browser"
            className="sidebar-tab-content hidden flex-1 select-none overflow-y-auto p-3 text-xs"
          >
            <div id="react-project-browser-slot" className="flex flex-col gap-3">{projectBrowser}</div>
          </div>
          <div className="sidebar-tabs-nav flex border-b border-white/10 bg-slate-950">
            <div id="react-sidebar-nav-slot" className="flex w-full">{sidebarNavigation}</div>
          </div>
        </aside>

        <div
          id="react-workspace-slot"
          className="relative flex min-w-0 flex-1 touch-none overflow-hidden bg-slate-950"
          onPointerDown={onCloseMobileSidebar}
        >{workspace}</div>
      </div>

      <footer
        id="app-footer"
        className="z-50 flex h-6 shrink-0 select-none items-center justify-between border-t border-slate-300 bg-slate-100 px-2 font-mono text-[11px] text-slate-600"
      >
        <div id="react-footer-slot" className="flex h-full w-full min-w-0">{footerStatus}</div>
      </footer>
    </div>
  );
}
