'use client';

import { useEffect, type KeyboardEvent } from 'react';
import { BookOpen, SlidersHorizontal } from 'lucide-react';
import { requestSidebarTab, type SidebarTabId } from '@/features/sidebar/SidebarNavigationBridge.ts';

const tabs: { id: SidebarTabId; label: string; Icon: typeof BookOpen }[] = [
  { id: 'properties', label: 'Propiedades', Icon: SlidersHorizontal },
  { id: 'browser', label: 'Navegador', Icon: BookOpen },
];

function syncPanels(active: SidebarTabId) {
  tabs.forEach(({ id }) => {
    const panel = document.getElementById(`sidebar-${id}`);
    if (!panel) return;
    const selected = id === active;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `sidebar-tab-${id}`);
    panel.hidden = !selected;
    panel.classList.toggle('hidden', !selected);
    panel.classList.toggle('block', selected);
  });
}

export default function SidebarNavigation({ active }: { active: SidebarTabId }) {
  useEffect(() => syncPanels(active), [active]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = active === 'properties' ? 'browser' : 'properties';
    requestSidebarTab(next);
    document.getElementById(`sidebar-tab-${next}`)?.focus();
  }

  return (
    <div role="tablist" aria-label="Panel lateral" className="flex w-full border-b border-white/10 bg-slate-950">
      {tabs.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <button
            id={`sidebar-tab-${id}`}
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`sidebar-${id}`}
            tabIndex={selected ? 0 : -1}
            data-sidebar-tab={id}
            className={`sidebar-nav-btn flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold transition-colors ${selected ? 'border-sky-400 bg-slate-800 text-sky-400' : 'border-transparent bg-transparent text-slate-400 hover:text-slate-200'}`}
            onClick={() => requestSidebarTab(id)}
            onKeyDown={onKeyDown}
          ><Icon aria-hidden="true" className="h-3.5 w-3.5" /><span>{label}</span></button>
        );
      })}
    </div>
  );
}
