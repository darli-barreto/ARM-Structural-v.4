'use client';

import { useRef, useSyncExternalStore, type ChangeEvent } from 'react';
import { Calculator, FileText, PanelLeft, Save, Upload } from 'lucide-react';
import { requestProjectAction, requestProjectRestore } from '@/features/project/ProjectToolsBridge.ts';
import { projectToolsStore } from '@/features/project/ProjectToolsStore.ts';

export default function ProjectTools({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const project = useSyncExternalStore(projectToolsStore.subscribe, projectToolsStore.getSnapshot, projectToolsStore.getServerSnapshot);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) requestProjectRestore(file);
  };

  return <div className="ml-auto flex shrink-0 items-center gap-1 px-1" aria-label="Herramientas del proyecto">
    <span id="project-save-status" className="hidden text-[10px] text-emerald-100 min-[701px]:block" role="status" aria-live="polite">{project.status}</span>
    <button id="project-sidebar" className="hidden h-8 w-8 items-center justify-center border border-white/10 max-[700px]:inline-flex" type="button" title="Propiedades y navegador" aria-label="Propiedades y navegador" aria-controls="app-sidebar" aria-expanded={sidebarOpen} onClick={onToggleSidebar}><PanelLeft aria-hidden="true" className="h-4 w-4" /></button>
    <button id="project-save" className="flex items-center gap-1 border border-white/10 px-2 py-1 text-xs" type="button" title="Guardar proyecto" disabled={!project.ready} onClick={() => requestProjectAction('save')}><Save aria-hidden="true" className="h-4 w-4" /><b className="max-[700px]:hidden">Guardar</b></button>
    <button id="project-open" className="flex items-center gap-1 border border-white/10 px-2 py-1 text-xs" type="button" title="Abrir proyecto" disabled={!project.ready} onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" className="h-4 w-4" /><b className="max-[700px]:hidden">Abrir</b></button>
    <button id="project-analysis" className="flex items-center gap-1 border border-white/10 px-2 py-1 text-xs" type="button" title="Modelo analítico" disabled={!project.ready} onClick={() => requestProjectAction('analysis')}><Calculator aria-hidden="true" className="h-4 w-4" /><b className="max-[700px]:hidden">Análisis</b></button>
    <button id="project-normative" className="flex items-center gap-1 border border-white/10 px-2 py-1 text-xs" type="button" title="Perfil normativo" aria-label="Perfil normativo" disabled={!project.ready} onClick={() => requestProjectAction('normative')}><FileText aria-hidden="true" className="h-4 w-4" /><b className="max-[700px]:hidden">Normativa</b></button>
    <input ref={fileRef} id="project-file" type="file" accept=".json,.arm,application/json" hidden onChange={onFile} />
  </div>;
}
