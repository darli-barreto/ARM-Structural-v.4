'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Calculator, FileText } from 'lucide-react';
import { requestProjectAction } from '@/features/project/ProjectToolsBridge.ts';
import { projectToolsStore } from '@/features/project/ProjectToolsStore.ts';
import { requestRibbonAction } from '@/features/ribbon/RibbonActionsBridge.ts';
import { useMobileViewerMode } from '@/shared/ui/useMobileViewerMode.ts';

export default function MobileInspectorDock() {
  const project = useSyncExternalStore(projectToolsStore.subscribe, projectToolsStore.getSnapshot, projectToolsStore.getServerSnapshot);
  const mobileViewer = useMobileViewerMode();

  useEffect(() => {
    document.documentElement.dataset.armMobileMode = mobileViewer ? 'viewer' : 'editor';
    if (mobileViewer) requestRibbonAction({ type: 'tool', tool: 'select' });
    return () => {
      delete document.documentElement.dataset.armMobileMode;
    };
  }, [mobileViewer]);

  useEffect(() => {
    if (!project.ready || !mobileViewer) return;
    const timer = window.setTimeout(() => document.getElementById('model-fit')?.click(), 250);
    return () => window.clearTimeout(timer);
  }, [mobileViewer, project.ready]);

  const buttonClass = 'flex h-10 w-10 items-center justify-center border border-sky-200/30 bg-slate-900/95 text-sky-100 shadow-lg backdrop-blur-sm disabled:opacity-40';
  return <nav className="fixed bottom-16 right-3 z-[80] flex items-center gap-2 md:hidden" aria-label="Consultas técnicas">
    <button type="button" className={buttonClass} title="Consultar análisis estructural" aria-label="Consultar análisis estructural" disabled={!project.ready} onClick={() => requestProjectAction('analysis')}><Calculator aria-hidden="true" className="h-5 w-5" /></button>
    <button type="button" className={buttonClass} title="Consultar normativa RNE" aria-label="Consultar normativa RNE" disabled={!project.ready} onClick={() => requestProjectAction('normative')}><FileText aria-hidden="true" className="h-5 w-5" /></button>
  </nav>;
}
