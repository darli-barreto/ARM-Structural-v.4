'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crosshair, Download, RotateCcw, Trash2, X } from 'lucide-react';
import { BimDatabase } from '@/core/database/BimDatabase';
import type { BimCategory } from '@/core/database/BimDatabaseTypes';
import { scheduleColumns, scheduleCsv, scheduleRows, scheduleTotals, type Grouping, type ScheduleRow } from '@/core/model/Schedule';
import { OPEN_PROJECT_SCHEDULE_EVENT } from '@/features/project-browser/ProjectBrowserBridge.ts';
import { requestScheduleAction } from '@/features/quantification/ScheduleBridge.ts';
import { download } from '@/shared/ui/dom.ts';

const categoryOptions: { value: BimCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas las categorías' },
  { value: 'OST_StructuralColumns', label: 'Columnas' },
  { value: 'OST_StructuralFraming', label: 'Vigas' },
  { value: 'OST_StructuralFoundation', label: 'Zapatas' },
  { value: 'OST_Floors', label: 'Losas' },
];

const fieldClass = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700';

function number(value: number, digits = 2): string {
  return Number.isFinite(value)
    ? value.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '-';
}

function sorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

export default function ScheduleModal() {
  const db = BimDatabase.getInstance();
  const [openCategory, setOpenCategory] = useState<BimCategory | 'ALL' | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [revision, setRevision] = useState(db.revision);
  const [category, setCategory] = useState<BimCategory | 'ALL'>('ALL');
  const [level, setLevel] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<Grouping>('instance');
  const [sort, setSort] = useState<keyof ScheduleRow>('mark');
  const [direction, setDirection] = useState(1);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkSector, setBulkSector] = useState('Sector A');
  const [message, setMessage] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pageCheckbox = useRef<HTMLInputElement>(null);

  useEffect(() => db.subscribe(() => {
    setRevision(db.revision);
    setChangeCount(count => count + 1);
  }), [db]);

  useEffect(() => {
    const open = (event: Event) => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const requested = (event as CustomEvent<BimCategory | 'ALL'>).detail;
      setCategory(requested);
      setLevel('ALL');
      setSector('ALL');
      setSearch('');
      setPage(0);
      setSelected(new Set());
      setMessage('');
      setOpenCategory(requested);
    };
    window.addEventListener(OPEN_PROJECT_SCHEDULE_EVENT, open);
    return () => window.removeEventListener(OPEN_PROJECT_SCHEDULE_EVENT, open);
  }, []);

  useEffect(() => {
    if (openCategory !== null) searchRef.current?.focus();
    else {
      previousFocus.current?.focus();
      previousFocus.current = null;
    }
  }, [openCategory]);

  const allElements = useMemo(() => db.getAllElements(), [db, changeCount]);
  const levels = useMemo(() => sorted([...allElements.map(element => element.levelName), ...(level === 'ALL' ? [] : [level])]), [allElements, level]);
  const sectors = useMemo(() => sorted([...allElements.map(element => element.instanceParameters.sector), ...(sector === 'ALL' ? [] : [sector])]), [allElements, sector]);
  const { records, summary } = useMemo(() => db.querySchedule({
    category,
    levelName: level,
    sector,
    search,
  }), [db, changeCount, category, level, sector, search]);
  const rows = useMemo(() => scheduleRows(records, group).sort((a, b) => {
    const left = a[sort];
    const right = b[sort];
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0)
      : String(left).localeCompare(String(right), 'es', { numeric: true });
    return direction * comparison;
  }), [records, group, sort, direction]);
  const totals = useMemo(() => scheduleTotals(rows), [rows]);
  const pageCount = Math.ceil(rows.length / pageSize);
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const start = currentPage * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  const validIds = useMemo(() => new Set(records.map(record => record.uniqueId)), [records]);
  const selectedVisible = visibleRows.flatMap(row => row.ids).filter(id => selected.has(id)).length;
  const visibleIds = visibleRows.flatMap(row => row.ids).length;
  const allVisibleSelected = visibleIds > 0 && selectedVisible === visibleIds;

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  useEffect(() => {
    setSelected(current => {
      const next = new Set([...current].filter(id => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [validIds]);

  useEffect(() => {
    if (pageCheckbox.current) pageCheckbox.current.indeterminate = selectedVisible > 0 && !allVisibleSelected;
  }, [selectedVisible, allVisibleSelected]);

  const resetPage = () => {
    setPage(0);
    setSelected(new Set());
    setMessage('');
  };

  const close = () => setOpenCategory(null);

  const trapKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
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
  };

  const editValue = (row: ScheduleRow, key: 'mark' | 'sector' | 'fc', input: HTMLInputElement) => {
    const value = input.value.trim();
    if (!value || (key === 'fc' && (!Number.isFinite(Number(value)) || Number(value) <= 0))) {
      input.setCustomValidity('Valor no válido');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    db.updateInstanceParameters(row.ids[0], {
      [key === 'fc' ? 'concreteStrength' : key]: key === 'fc' ? Number(value) : value,
    });
  };

  const applyBulkSector = () => {
    const value = bulkSector.trim();
    if (!value || !selected.size) return;
    const count = selected.size;
    selected.forEach(id => db.updateInstanceParameters(id, { sector: value }));
    setSelected(new Set());
    setMessage(`${count} elementos actualizados`);
  };

  const selectPage = (checked: boolean) => {
    setSelected(current => {
      const next = new Set(current);
      visibleRows.forEach(row => row.ids.forEach(id => checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  if (openCategory === null) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-2 md:p-5"
      onKeyDown={trapKeyboard}
      onPointerDown={event => event.stopPropagation()}
      onPointerMove={event => event.stopPropagation()}
      onPointerUp={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}
      onDoubleClick={event => event.stopPropagation()}
      role="presentation"
    >
      <section className="schedule-dialog flex max-h-[94dvh] w-full max-w-[1480px] flex-col overflow-hidden border border-slate-300 bg-white text-slate-800" role="dialog" aria-modal="true" aria-label="Cuantificación de estructura">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div><span className="text-[10px] font-bold text-slate-500">ARM / CANTIDADES</span><h2 className="text-lg font-semibold">Cuantificación de estructura</h2></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" id="sched-export" className="flex items-center gap-1.5 border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" onClick={() => download(scheduleCsv(rows), 'cuantificacion.csv', 'text/csv;charset=utf-8')}><Download aria-hidden="true" className="h-4 w-4" /> Exportar CSV</button>
            <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 hover:bg-slate-100" id="sched-close" title="Cerrar" aria-label="Cerrar" onClick={close}><X aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 p-3">
          <label>Categoría
            <select id="sched-category" className={fieldClass} value={category} onChange={event => { setCategory(event.currentTarget.value as BimCategory | 'ALL'); resetPage(); }}>
              {categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Nivel
            <select id="sched-level" className={fieldClass} value={level} onChange={event => { setLevel(event.currentTarget.value); resetPage(); }}>
              <option value="ALL">Todos</option>{levels.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Sector
            <select id="sched-sector" className={fieldClass} value={sector} onChange={event => { setSector(event.currentTarget.value); resetPage(); }}>
              <option value="ALL">Todos</option>{sectors.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Agrupar por
            <select id="sched-group" className={fieldClass} value={group} onChange={event => { setGroup(event.currentTarget.value as Grouping); resetPage(); }}>
              <option value="instance">Ejemplar</option><option value="type">Tipo y resistencia</option><option value="level">Nivel</option><option value="category">Categoría</option>
            </select>
          </label>
          <label className="min-w-40 flex-1">Buscar
            <input ref={searchRef} id="sched-search" className={fieldClass} type="search" placeholder="Marca, tipo, nivel o ID" value={search} onChange={event => { setSearch(event.currentTarget.value); resetPage(); }} />
          </label>
          <button type="button" id="sched-reset" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 hover:bg-slate-100" title="Restablecer filtros" aria-label="Restablecer filtros" onClick={() => { setCategory('ALL'); setLevel('ALL'); setSector('ALL'); setSearch(''); resetPage(); }}><RotateCcw aria-hidden="true" className="h-4 w-4" /></button>
        </div>

        <div id="sched-summary" className="grid shrink-0 grid-cols-2 gap-4 border-b border-slate-200 p-3 sm:grid-cols-4 lg:grid-cols-5">
          <div><span>Elementos</span><strong>{number(summary.totalCount, 0)}</strong></div>
          <div><span>Concreto neto</span><strong>{number(totals.volume ?? Number.NaN, 3)} <small>m³</small></strong></div>
          <div><span>Solapes descontados</span><strong>{number(totals.deduction ?? Number.NaN, 3)} <small>m³</small></strong></div>
          <div><span>Encofrado estimado</span><strong>{number(summary.totalSurfaceArea)} <small>m²</small></strong></div>
          <div><span>Costo neto estimado</span><strong>{number(totals.cost ?? Number.NaN)} <small>USD</small></strong></div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 p-2 text-xs">
          <span id="sched-selection" aria-live="polite">{selected.size} seleccionados</span>
          <label>Sector<input id="sched-bulk-sector" className={fieldClass} value={bulkSector} maxLength={80} onChange={event => setBulkSector(event.currentTarget.value)} /></label>
          <button type="button" id="sched-bulk-apply" className="border border-slate-300 px-2 py-1 disabled:opacity-40" disabled={!selected.size} onClick={applyBulkSector}>Aplicar</button>
          <span id="sched-message" role="status" aria-live="polite">{message}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-xs [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-2">
            <thead id="sched-head"><tr>
              <th><input ref={pageCheckbox} id="sched-select-page" type="checkbox" aria-label="Seleccionar página" checked={allVisibleSelected} onChange={event => selectPage(event.currentTarget.checked)} /></th>
              {scheduleColumns.map(column => <th key={column.key} aria-sort={sort === column.key ? direction === 1 ? 'ascending' : 'descending' : 'none'}><button type="button" className="border-0 bg-transparent px-0 py-1 font-semibold" data-sort={column.key} onClick={() => { setDirection(sort === column.key ? -direction : 1); setSort(column.key); }}>{column.label}{sort === column.key ? direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>)}
              <th>Modelo</th>
            </tr></thead>
            <tbody id="sched-body">
              {visibleRows.length ? visibleRows.map((row, index) => {
                const instance = group === 'instance';
                const selectedRow = row.ids.every(id => selected.has(id));
                return (
                    <tr key={`${row.ids[0]}-${group}`} data-index={start + index} className={selectedRow ? 'bg-emerald-50' : undefined}>
                    <td><input type="checkbox" data-select={start + index} aria-label={`Seleccionar ${row.mark || row.type}`} checked={selectedRow} onChange={event => { const checked = event.currentTarget.checked; setSelected(current => { const next = new Set(current); row.ids.forEach(id => checked ? next.add(id) : next.delete(id)); return next; }); }} /></td>
                    {scheduleColumns.map(column => {
                      const value = row[column.key];
                      const editable = instance && (column.key === 'mark' || column.key === 'sector' || column.key === 'fc');
                      const display = typeof value === 'number'
                        ? Number.isFinite(value) ? number(value, ['volume', 'gross', 'deduction'].includes(column.key) ? 3 : ['count', 'fc'].includes(column.key) ? 0 : 2) : column.key === 'fc' ? 'Varios' : '-'
                        : value;
                      return <td key={column.key} className={column.numeric ? 'text-right tabular-nums' : undefined} title={column.key === 'type' ? row.dimensions : String(value)}>
                        {editable ? <input
                          key={`${row.ids[0]}-${column.key}-${revision}`}
                          className="w-22 border border-transparent bg-transparent p-1 text-xs focus:border-slate-400 focus:bg-white"
                          aria-label={`${column.label} ${row.mark}`}
                          data-edit={column.key}
                          data-id={row.ids[0]}
                          type={column.key === 'fc' ? 'number' : 'text'}
                          min={column.key === 'fc' ? 1 : undefined}
                          step={column.key === 'fc' ? 1 : undefined}
                          maxLength={column.key === 'fc' ? undefined : 80}
                          defaultValue={String(value)}
                          onBlur={event => editValue(row, column.key as 'mark' | 'sector' | 'fc', event.currentTarget)}
                        /> : display}
                      </td>;
                    })}
                    <td><div className="flex items-center gap-1">{instance ? <>
                      <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 hover:bg-slate-100" data-focus={row.ids[0]} title="Ver en modelo" aria-label={`Ver ${row.mark} en modelo`} onClick={() => { close(); requestScheduleAction({ type: 'select', id: row.ids[0] }); }}><Crosshair aria-hidden="true" className="h-4 w-4" /></button>
                      <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-rose-300 text-rose-700 hover:bg-rose-50" data-delete={row.ids[0]} title="Eliminar" aria-label={`Eliminar ${row.mark}`} onClick={() => { if (window.confirm('¿Eliminar este elemento del modelo?')) requestScheduleAction({ type: 'delete', id: row.ids[0] }); }}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                    </> : <span>{row.ids.length} elem.</span>}</div></td>
                  </tr>
                );
              }) : <tr><td colSpan={scheduleColumns.length + 2} className="p-8 text-center">No hay elementos que coincidan con los filtros.</td></tr>}
            </tbody>
            <tfoot id="sched-foot"><tr><td></td>{scheduleColumns.map(column => {
              const value = totals[column.key];
              return <td key={column.key} className={column.numeric ? 'text-right tabular-nums' : undefined}>{column.key === 'mark' ? 'TOTAL FILTRADO' : value !== undefined ? number(value, column.key === 'count' ? 0 : ['volume', 'gross', 'deduction'].includes(column.key) ? 3 : 2) : ''}</td>;
            })}<td></td></tr></tfoot>
          </table>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2">
          <span id="sched-range">{rows.length ? start + 1 : 0}–{Math.min(start + pageSize, rows.length)} de {rows.length} filas</span>
          <div className="flex flex-wrap items-center gap-2">
            <label>Filas<select id="sched-page-size" className={fieldClass} value={pageSize} onChange={event => { setPageSize(Number(event.currentTarget.value)); resetPage(); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button type="button" id="sched-prev" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 disabled:opacity-40" title="Anterior" aria-label="Página anterior" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" id="sched-next" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 disabled:opacity-40" title="Siguiente" aria-label="Página siguiente" disabled={start + pageSize >= rows.length} onClick={() => setPage(value => value + 1)}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </footer>
      </section>
    </div>
  );
}
