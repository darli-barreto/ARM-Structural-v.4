'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Crosshair, Search, X } from 'lucide-react';
import { BimDatabase } from '@/core/database/BimDatabase';
import type { BimElementDocument, BimGridDocument, BimLevelDocument } from '@/core/database/BimDatabaseTypes';
import { OPEN_SELECT_BY_ID_EVENT, publishSelectByIdResult } from '@/features/select-by-id/SelectByIdBridge.ts';
import type { SelectByIdResult } from '@/features/select-by-id/SelectByIdTypes.ts';

const initialMessage = 'Ingresa un Element ID (ej: 100001), un GUID (ej: 3b9d0e65...), una Marca (ej: C-1), un Eje de Grilla (ej: 1 o A) o un Nivel (ej: Nivel 1).';
const fieldClass = 'w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600';

function Info({ label, value, emphasis = false, mono = false }: { label: string; value: string; emphasis?: boolean; mono?: boolean }) {
  return <div className={`flex min-w-0 justify-between gap-4 ${mono ? 'font-mono' : ''}`}><span className="shrink-0 text-slate-400">{label}</span><span className={`min-w-0 truncate text-right ${emphasis ? 'font-semibold text-emerald-300' : 'text-slate-200'}`} title={value}>{value}</span></div>;
}

function ResultDetails({ result }: { result: SelectByIdResult }) {
  if (result.type === 'element') {
    const element = result.doc as BimElementDocument;
    return <div className="flex flex-col gap-2 text-xs">
      <Info label={element.categoryName} value={`${element.instanceParameters.mark} · ID ${element.elementId}`} emphasis />
      <Info label="Tipo" value={element.familyType} />
      <Info label="Nivel" value={element.levelName} />
      <Info label="Volumen" value={`${element.instanceParameters.volume.toFixed(3)} m³`} emphasis />
      <Info label="GUID" value={element.uniqueId} mono />
    </div>;
  }
  if (result.type === 'grid') {
    const grid = result.doc as BimGridDocument;
    return <div className="flex flex-col gap-2 text-xs">
      <Info label="Rejilla" value={`${grid.name} · ID ${grid.elementId}`} emphasis />
      <Info label="Familia" value={grid.family} />
      <Info label="Longitud" value={`${grid.length.toFixed(2)} m`} emphasis />
      <Info label="GUID" value={grid.uniqueId} mono />
    </div>;
  }
  const level = result.doc as BimLevelDocument;
  return <div className="flex flex-col gap-2 text-xs">
    <Info label="Nivel" value={`${level.name} · ID ${level.elementId}`} emphasis />
    <Info label="Familia" value={level.family} />
    <Info label="Elevación" value={`${level.elevation.toFixed(2)} m`} emphasis />
    <Info label="GUID" value={level.uniqueId} mono />
  </div>;
}

export default function SelectByIdModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SelectByIdResult>();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setResult(undefined);
      setOpen(true);
    };
    window.addEventListener(OPEN_SELECT_BY_ID_EVENT, show);
    return () => window.removeEventListener(OPEN_SELECT_BY_ID_EVENT, show);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  useEffect(() => {
    const value = query.trim();
    setResult(value ? BimDatabase.getInstance().searchAnyById(value) : undefined);
  }, [query]);

  if (!open) return null;

  const close = () => setOpen(false);
  const confirm = () => {
    if (!result) return;
    close();
    publishSelectByIdResult(result);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Enter' && result) {
      event.preventDefault();
      confirm();
    }
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled)',
      )).filter(control => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-2 md:p-5" role="presentation" onPointerDown={event => event.stopPropagation()} onKeyDown={handleKeyDown} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <section id="bim-select-by-id-modal" className="w-full max-w-lg overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="select-id-heading">
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded border border-emerald-700 bg-emerald-950 text-emerald-300"><Search aria-hidden="true" className="h-4 w-4" /></span><div><h2 id="select-id-heading" className="text-sm font-semibold text-white">Seleccionar por ID</h2><p className="text-[11px] text-slate-400">Localiza elementos, rejillas y niveles</p></div></div>
        <button id="btn-select-id-close" type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-700 hover:bg-slate-800" title="Cerrar" aria-label="Cerrar" onClick={close}><X aria-hidden="true" className="h-4 w-4" /></button>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <label htmlFor="select-id-input" className="text-xs font-medium text-slate-300">Identificador o código</label>
        <input ref={inputRef} id="select-id-input" className={fieldClass} value={query} onChange={event => setQuery(event.currentTarget.value)} type="search" autoComplete="off" placeholder="ID, GUID, marca, eje o nivel" />
        <div id="select-id-result" className="min-h-28 rounded border border-slate-700 bg-slate-950 p-3" aria-live="polite">
          {!query.trim() ? <p className="py-5 text-center text-xs text-slate-400">{initialMessage}</p> : result ? <ResultDetails result={result} /> : <p className="py-5 text-center text-xs text-rose-300">No se encontró ningún elemento, rejilla o nivel con el identificador “{query.trim()}”.</p>}
        </div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-700 bg-slate-950 px-4 py-3">
        <button id="btn-select-cancel" type="button" className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5" onClick={close}>Cancelar</button>
        <button id="btn-select-confirm" type="button" disabled={!result} className="flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500" onClick={confirm}><Crosshair aria-hidden="true" className="h-3.5 w-3.5" /> Seleccionar en vista</button>
      </footer>
    </section>
  </div>;
}
