'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Clipboard, Database, Download, X } from 'lucide-react';
import { BimDatabase } from '@/core/database/BimDatabase';
import { OPEN_MONGO_INSPECTOR_EVENT } from '@/features/data-inspector/MongoInspectorBridge.ts';
import { download } from '@/shared/ui/dom.ts';

type CollectionName = 'elements' | 'grids' | 'levels' | 'types';
type DumpCollections = Record<CollectionName, unknown[]>;

const collections: { id: CollectionName; label: string }[] = [
  { id: 'elements', label: 'db.elements' },
  { id: 'grids', label: 'db.grids' },
  { id: 'levels', label: 'db.levels' },
  { id: 'types', label: 'db.types' },
];

function readCollections(raw: string): DumpCollections {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !('collections' in parsed)) throw new Error('El volcado no contiene colecciones.');
  const source = (parsed as { collections: unknown }).collections;
  if (!source || typeof source !== 'object') throw new Error('El volcado de colecciones no es válido.');
  const value = source as Record<string, unknown>;
  return Object.fromEntries(collections.map(({ id }) => [id, Array.isArray(value[id]) ? value[id] : []])) as DumpCollections;
}

export default function MongoInspectorModal() {
  const db = BimDatabase.getInstance();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CollectionName>('elements');
  const [revision, setRevision] = useState(db.revision);
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => db.subscribe(() => setRevision(db.revision)), [db]);

  useEffect(() => {
    const show = () => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActive('elements');
      setStatus('');
      setOpen(true);
    };
    window.addEventListener(OPEN_MONGO_INSPECTOR_EVENT, show);
    return () => window.removeEventListener(OPEN_MONGO_INSPECTOR_EVENT, show);
  }, []);

  useEffect(() => {
    if (open) document.getElementById('mongo-close')?.focus();
    else if (previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const rawDump = useMemo(() => db.exportMongoDump(), [db, revision]);
  const parsed = useMemo(() => {
    try { return { data: readCollections(rawDump), error: '' }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : 'No se pudo leer el volcado.' }; }
  }, [rawDump]);
  const collectionData = parsed.data?.[active] ?? [];
  const command = `mongoimport --uri="mongodb://localhost:27017/bim_structural_db" --collection=${active} --file=bim_mongodb_export.json --jsonArray`;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopying(true);
      setStatus('Comando copiado');
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => { setCopying(false); setStatus(''); }, 1800);
    } catch {
      setStatus('El navegador no permitió copiar el comando');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled)',
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

  if (!open) return null;

  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-2 md:p-5" role="presentation" onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onKeyDown={handleKeyDown} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false); }}>
    <section id="bim-mongo-inspector-modal" className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mongo-heading">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded border border-emerald-700 bg-emerald-950 text-emerald-300"><Database aria-hidden="true" className="h-4 w-4" /></span><div><h2 id="mongo-heading" className="text-sm font-semibold text-white">Inspector de datos BIM</h2><p className="text-[11px] text-slate-400">Colecciones BSON y esquema OpenBIM</p></div></div>
        <div className="flex items-center gap-2">
          <button id="btn-mongo-copy-cli" type="button" className="flex items-center gap-1.5 rounded border border-slate-600 px-2.5 py-1.5 text-xs hover:bg-white/5" onClick={copyCommand}>{copying ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />}{copying ? 'Copiado' : 'Copiar mongoimport'}</button>
          <button id="btn-mongo-download-dump" type="button" className="flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-900/60 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-emerald-800" onClick={() => download(rawDump, 'bim_mongodb_export.json')}><Download aria-hidden="true" className="h-3.5 w-3.5" /> Descargar JSON</button>
          <button id="mongo-close" type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-700 hover:bg-slate-800" title="Cerrar" aria-label="Cerrar" onClick={() => setOpen(false)}><X aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-950 px-4 py-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Colecciones BIM">
          {collections.map(({ id, label }) => <button key={id} type="button" id={`mongo-tab-${id}`} role="tab" aria-selected={active === id} aria-controls="mongo-json-viewer" className={`rounded border px-2.5 py-1 text-xs ${active === id ? 'border-emerald-600 bg-emerald-700 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`} onClick={() => setActive(id)}>{label} <span id={`count-${id}`} className="font-mono">({parsed.data?.[id].length ?? 0})</span></button>)}
        </div>
        <span className="font-mono text-[11px] text-slate-400">Database: <strong className="text-emerald-300">bim_structural_db</strong></span>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-hidden border-b border-slate-700 px-4 py-2 font-mono text-xs text-slate-400"><span className="text-emerald-400">$</span><code id="mongo-cli-command" className="overflow-x-auto whitespace-nowrap text-slate-200">{command}</code></div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-4">
        {parsed.error ? <p role="alert" className="text-sm text-rose-300">{parsed.error}</p> : <pre id="mongo-json-viewer" role="tabpanel" aria-labelledby={`mongo-tab-${active}`} className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-200">{JSON.stringify(collectionData, null, 2)}</pre>}
      </div>
      <footer className="flex min-h-9 items-center justify-between border-t border-slate-700 bg-slate-950 px-4 py-2 text-xs text-slate-400"><span role="status" aria-live="polite">{status}</span><span>{collectionData.length} documentos</span></footer>
    </section>
  </div>;
}
