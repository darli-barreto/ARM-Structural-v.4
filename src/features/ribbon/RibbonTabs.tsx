'use client';

import type { KeyboardEvent } from 'react';

const tabs = [
  { id: 'architecture', label: 'Arquitectura' },
  { id: 'structure', label: 'Estructura' },
  { id: 'systems', label: 'Sistemas' },
  { id: 'concrete', label: 'Concreto' },
  { id: 'steel', label: 'Steel' },
  { id: 'topography', label: 'Topografía' },
  { id: 'collaboration', label: 'Colaboración' },
  { id: 'design', label: 'Diseño Est.' },
  { id: 'analysis', label: 'Análisis Est.' },
  { id: 'reports', label: 'Informes' },
  { id: 'insert', label: 'Insertar' },
  { id: 'annotate', label: 'Anotar' },
  { id: 'view', label: 'Vista' },
  { id: 'manage', label: 'Gestionar' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export type RibbonTabId = TabId;

export default function RibbonTabs({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const current = tabs.findIndex(tab => tab.id === active);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(current + delta + tabs.length) % tabs.length];
    onSelect(next.id);
    document.getElementById(`ribbon-tab-${next.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label="Herramientas del proyecto" className="flex gap-0.5">
      {tabs.map(tab => {
        const selected = active === tab.id;
        return (
          <button
            id={`ribbon-tab-${tab.id}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`ribbon-tab-btn shrink-0 cursor-pointer border-b-2 px-3 py-1.5 text-xs font-medium ${selected ? 'border-sky-700 bg-white text-sky-900' : 'border-transparent text-slate-700 hover:bg-slate-200 hover:text-slate-950'}`}
            data-tab={tab.id}
            onClick={() => onSelect(tab.id)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
