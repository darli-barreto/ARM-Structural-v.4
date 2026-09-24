'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Building2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  LayoutGrid,
  MoreHorizontal,
  Rows2,
  Square,
  X,
} from 'lucide-react';
import type { BimView } from '@/core/views/BimView';
import type { SplitLayout, ViewManager } from '@/core/views/ViewManager';

const layouts: { id: string; mode: SplitLayout; label: string; title: string; Icon: typeof Square }[] = [
  { id: 'layout-single', mode: 'single', label: 'Única', title: 'Pestaña única', Icon: Square },
  { id: 'layout-split-v', mode: 'split-v', label: 'Split V', title: 'Dividir verticalmente', Icon: Columns2 },
  { id: 'layout-split-h', mode: 'split-h', label: 'Split H', title: 'Dividir horizontalmente', Icon: Rows2 },
  { id: 'layout-grid-4', mode: 'grid-4', label: 'Mosaico', title: 'Mosaico de cuatro vistas', Icon: LayoutGrid },
];

function ViewIcon({ view }: { view: BimView }) {
  if (view.type === '3d') return <Box aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
  if (view.type === 'plan') return <Square aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
  return <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
}

interface ViewTabsProps {
  manager: ViewManager;
  openViews: BimView[];
  activeId: string;
  allViews: BimView[];
  layoutMode: SplitLayout;
}

export default function ViewTabs({ manager, openViews, activeId, allViews, layoutMode }: ViewTabsProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [layout, setLayout] = useState(layoutMode);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setLayout(layoutMode), [layoutMode]);

  useEffect(() => {
    if (!overflowOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !overflowButtonRef.current?.contains(target)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [overflowOpen]);

  useEffect(() => {
    document.getElementById(`view-tab-${activeId}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, openViews]);

  const closedViews = allViews.filter(view => !openViews.some(openView => openView.id === view.id));

  function activateWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + openViews.length) % openViews.length;
    const next = openViews[nextIndex];
    manager.openView(next.id);
    document.getElementById(`view-tab-${next.id}`)?.focus();
  }

  function chooseLayout(mode: SplitLayout) {
    setLayout(mode);
    manager.setLayout(mode);
  }

  return (
    <div className="flex h-full w-full min-w-0 items-center gap-1">
      <button
        id="tabs-scroll-left"
        type="button"
        title="Desplazar pestañas a la izquierda"
        aria-label="Desplazar pestañas a la izquierda"
        className="hidden h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:flex"
        onClick={() => listRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
      ><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>

      <div
        id="view-tabs-list"
        ref={listRef}
        role="tablist"
        aria-label="Vistas abiertas"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-0.5 scrollbar-none"
        onWheel={event => {
          if (event.deltaY !== 0) {
            event.preventDefault();
            event.currentTarget.scrollLeft += event.deltaY;
          }
        }}
      >
        {openViews.map((view, index) => {
          const active = view.id === activeId;
          return (
            <div key={view.id} role="presentation" className={`group flex h-6 shrink-0 items-center gap-1.5 rounded border px-2 ${active ? 'border-sky-400/80 border-t-2 bg-slate-800 font-semibold text-sky-400 shadow-sm' : 'border-white/5 bg-slate-900/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}>
              <button
                id={`view-tab-${view.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`viewport-${view.id}`}
                tabIndex={active ? 0 : -1}
                className="flex min-w-0 max-w-[186px] items-center gap-1.5 truncate text-left text-[11px]"
                title={view.title}
                onClick={() => manager.openView(view.id)}
                onKeyDown={event => activateWithKeyboard(event, index)}
              >
                <ViewIcon view={view} />
                <span className="truncate">{view.title}</span>
              </button>
              <button
                type="button"
                className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 opacity-60 transition-opacity hover:bg-white/20 hover:text-white group-hover:opacity-100"
                title={`Cerrar ${view.title}`}
                aria-label={`Cerrar pestaña ${view.title}`}
                onClick={() => manager.closeTab(view.id)}
              ><X aria-hidden="true" className="h-3 w-3" /></button>
            </div>
          );
        })}
      </div>

      <button
        id="tabs-scroll-right"
        type="button"
        title="Desplazar pestañas a la derecha"
        aria-label="Desplazar pestañas a la derecha"
        className="mr-1 hidden h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:flex"
        onClick={() => listRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
      ><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>

      <div className="relative mr-2 shrink-0">
        <button
          id="tabs-overflow-btn"
          ref={overflowButtonRef}
          type="button"
          title="Vistas abiertas y disponibles"
          aria-label={`Mostrar vistas, ${openViews.length} abiertas`}
          aria-haspopup="menu"
          aria-expanded={overflowOpen}
          aria-controls="tabs-overflow-menu"
          className="flex h-6 items-center gap-1.5 rounded border border-transparent px-2 text-xs font-semibold text-slate-400 transition-colors hover:border-white/10 hover:bg-white/10 hover:text-sky-300"
          onClick={() => setOverflowOpen(open => !open)}
        ><MoreHorizontal aria-hidden="true" className="h-4 w-4" /><span id="tabs-count-badge" className="rounded-full bg-slate-800 px-1.5 font-mono text-[10px] font-bold text-sky-400">{openViews.length}</span></button>
        <div
          id="tabs-overflow-menu"
          ref={menuRef}
          role="menu"
          aria-label="Vistas del proyecto"
          className={`${overflowOpen ? '' : 'hidden'} absolute right-0 top-full z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-white/15 bg-slate-900 py-1 text-xs shadow-2xl`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
            <span>Pestañas abiertas ({openViews.length})</span>
            <button id="overflow-close-others" type="button" role="menuitem" title="Cerrar todas menos la activa" className="normal-case text-sky-400 hover:text-sky-300" onClick={() => { manager.closeOtherTabs(activeId); setOverflowOpen(false); }}>Cerrar otras</button>
          </div>
          {openViews.map(view => (
            <div key={view.id} className={`flex items-center gap-1 px-2 py-1 ${view.id === activeId ? 'bg-sky-500/20 font-semibold text-sky-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
              <button type="button" role="menuitem" className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left" onClick={() => { manager.openView(view.id); setOverflowOpen(false); }}>
                <ViewIcon view={view} /><span className="truncate">{view.title}</span>
              </button>
              <button type="button" className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/20 hover:text-white" title={`Cerrar ${view.title}`} aria-label={`Cerrar pestaña ${view.title}`} onClick={() => manager.closeTab(view.id)}><X aria-hidden="true" className="h-3 w-3" /></button>
            </div>
          ))}
          {closedViews.length > 0 && <div className="mt-1 border-t border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">Otras vistas ({closedViews.length})</div>}
          {closedViews.map(view => (
            <button key={view.id} type="button" role="menuitem" className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200" title="Abrir en workspace" onClick={() => { manager.openView(view.id); setOverflowOpen(false); }}>
              <ViewIcon view={view} /><span className="truncate">{view.title}</span><span className="ml-auto text-[10px] text-sky-400 opacity-60">Abrir</span>
            </button>
          ))}
        </div>
      </div>

      <div className="view-layout-controls hidden shrink-0 items-center gap-1 border-l border-white/10 pl-2 md:flex">
        {layouts.map(({ id, mode, label, title, Icon }) => (
          <button
            id={id}
            key={mode}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={layout === mode}
            className={`layout-btn flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors ${layout === mode ? 'border-sky-400 bg-sky-600 font-medium text-white' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
            onClick={() => chooseLayout(mode)}
          ><Icon aria-hidden="true" className="h-3 w-3" /><span>{label}</span></button>
        ))}
      </div>
    </div>
  );
}
