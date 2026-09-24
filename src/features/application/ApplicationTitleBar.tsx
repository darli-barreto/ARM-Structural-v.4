'use client';

import { useEffect, useRef, useSyncExternalStore, type ChangeEvent, type ComponentType } from 'react';
import {
  Box,
  CircleHelp,
  FileDown,
  FolderOpen,
  Home,
  Maximize2,
  Minus,
  PanelLeft,
  Printer,
  Redo2,
  RefreshCw,
  Ruler,
  Save,
  ScanLine,
  Search,
  Section,
  Settings2,
  Store,
  Tag,
  Type,
  Undo2,
  UserCircle,
  X,
} from 'lucide-react';
import { requestOpenProjectView } from '@/features/project-browser/ProjectBrowserBridge.ts';
import { requestProjectAction, requestProjectRestore } from '@/features/project/ProjectToolsBridge.ts';
import { projectToolsStore } from '@/features/project/ProjectToolsStore.ts';
import type { ViewTabsSnapshot } from '@/features/workspace/ViewTabsBridge.ts';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const iconButtonClass = 'flex h-7 w-7 shrink-0 items-center justify-center border border-transparent text-slate-200 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent';

function TitleIcon({
  label,
  Icon,
  shortcut,
  disabled = false,
  onClick,
}: {
  label: string;
  Icon: IconType;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return <button type="button" className={iconButtonClass} title={title} aria-label={title} disabled={disabled} onClick={onClick}><Icon aria-hidden={true} className="h-4 w-4" /></button>;
}

export default function ApplicationTitleBar({
  sidebarOpen,
  onToggleSidebar,
  viewTabs,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  viewTabs: ViewTabsSnapshot | null;
}) {
  const project = useSyncExternalStore(projectToolsStore.subscribe, projectToolsStore.getSnapshot, projectToolsStore.getServerSnapshot);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) requestProjectRestore(file);
  };

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's' && project.ready) {
        event.preventDefault();
        requestProjectAction('save');
      } else if (key === 'o' && project.ready) {
        event.preventDefault();
        fileRef.current?.click();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [project.ready]);

  return <div id="application-title-bar" className="flex h-11 shrink-0 items-center border-b border-sky-950 bg-sky-900 px-1 text-white md:grid md:h-9 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
    <div className="flex w-full min-w-0 items-center gap-2 px-1 md:hidden">
      <button type="button" className={iconButtonClass} title="Abrir panel de consulta" aria-label="Abrir panel de consulta" aria-controls="app-sidebar" aria-expanded={sidebarOpen} onClick={onToggleSidebar}><PanelLeft aria-hidden="true" className="h-5 w-5" /></button>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-sky-600 text-xs font-black" aria-label="ARM Structural">A</div>
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">ARM-Structural</div><div className="truncate text-[10px] text-sky-200">{project.status}</div></div>
      <span className="shrink-0 border border-sky-300/40 px-2 py-1 text-[10px] font-semibold text-sky-100">MODO CONSULTA</span>
    </div>

    <div className="hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex" aria-label="Acceso rápido">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-sky-600 text-xs font-black" aria-label="ARM Structural">A</div>
      <TitleIcon label="Inicio" shortcut="Ctrl+D" Icon={Home} disabled />
      <TitleIcon label="Abrir proyecto" shortcut="Ctrl+O" Icon={FolderOpen} disabled={!project.ready} onClick={() => fileRef.current?.click()} />
      <TitleIcon label="Guardar proyecto" shortcut="Ctrl+S" Icon={Save} disabled={!project.ready} onClick={() => requestProjectAction('save')} />
      <TitleIcon label="Sincronizar y modificar configuración" Icon={RefreshCw} disabled />
      <TitleIcon label="Deshacer" shortcut="Ctrl+Z" Icon={Undo2} disabled />
      <TitleIcon label="Rehacer" shortcut="Ctrl+Y" Icon={Redo2} disabled />
      <TitleIcon label="Imprimir" shortcut="Ctrl+P" Icon={Printer} disabled />
      <TitleIcon label="Exportar PDF" Icon={FileDown} disabled />
      <span className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />
      <TitleIcon label="Activar controles y cotas" shortcut="AC" Icon={Settings2} disabled />
      <TitleIcon label="Cota alineada" shortcut="DI" Icon={Ruler} disabled />
      <TitleIcon label="Medir entre dos referencias" Icon={ScanLine} disabled />
      <TitleIcon label="Vista 3D por defecto" Icon={Box} onClick={() => requestOpenProjectView('view-3d')} />
      <TitleIcon label="Texto" shortcut="TX" Icon={Type} disabled />
      <TitleIcon label="Líneas finas" shortcut="TL" Icon={Minus} disabled />
      <TitleIcon label="Sección" Icon={Section} disabled />
      <TitleIcon label="Etiqueta por categoría" shortcut="TG" Icon={Tag} disabled />
      <TitleIcon label="Cerrar vistas inactivas" Icon={X} disabled={!viewTabs} onClick={() => viewTabs?.manager.closeOtherTabs(viewTabs.activeId)} />
    </div>

    <div className="hidden min-w-0 px-3 text-center text-xs font-semibold text-slate-100 md:block" title={project.status}>
      <span className="max-w-[36vw] truncate">ARM-Structural · {project.status}</span>
      <span className="ml-2 text-[10px] font-normal text-sky-200">v0.0.0</span>
    </div>

    <div className="hidden min-w-0 items-center justify-end gap-0.5 overflow-hidden md:flex" aria-label="Aplicación">
      <TitleIcon label="Buscar" Icon={Search} disabled />
      <TitleIcon label="Cuenta" Icon={UserCircle} disabled />
      <TitleIcon label="Marketplace" Icon={Store} disabled />
      <TitleIcon label="Ayuda" shortcut="F1" Icon={CircleHelp} disabled />
      <span className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />
      <TitleIcon label="Minimizar" Icon={Minus} disabled />
      <TitleIcon label="Restaurar" Icon={Maximize2} disabled />
      <TitleIcon label="Cerrar" Icon={X} disabled />
    </div>
    <input ref={fileRef} id="project-file" type="file" accept=".json,.arm,application/json" hidden onChange={onFile} />
  </div>;
}
