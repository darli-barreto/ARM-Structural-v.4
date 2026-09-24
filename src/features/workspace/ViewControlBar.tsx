'use client';

import { useState, type ComponentType } from 'react';
import { Crop, EyeOff, Lightbulb, Scan, SlidersHorizontal, Sun, View } from 'lucide-react';
import { requestRibbonAction } from '@/features/ribbon/RibbonActionsBridge.ts';
import type { VisualStyle } from '@/config/theme.config';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const selectClass = 'h-6 border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 outline-none focus:border-sky-600';
const buttonClass = 'flex h-6 w-7 items-center justify-center border border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-950 disabled:cursor-default disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent';

function ViewButton({ label, Icon }: { label: string; Icon: IconType }) {
  return <button type="button" className={buttonClass} title={`${label} (próximamente)`} aria-label={label} disabled><Icon aria-hidden={true} className="h-3.5 w-3.5" /></button>;
}

export default function ViewControlBar() {
  const [scale, setScale] = useState('100');
  const [detail, setDetail] = useState('medium');

  return <div id="view-control-bar" className="absolute inset-x-0 bottom-0 z-30 flex h-8 items-center gap-1 overflow-x-hidden border-t border-slate-300 bg-slate-100 px-2 md:h-7 md:overflow-x-auto" aria-label="Controles de vista">
    <div className="hidden items-center gap-1 md:flex">
      <label className="sr-only" htmlFor="view-scale-select">Escala</label>
      <select id="view-scale-select" className={selectClass} value={scale} onChange={event => setScale(event.currentTarget.value)} title="Escala de vista">
        <option value="20">1:20</option><option value="50">1:50</option><option value="75">1:75</option><option value="100">1:100</option><option value="200">1:200</option>
      </select>
      <span className="h-4 w-px shrink-0 bg-slate-300" />
      <label className="sr-only" htmlFor="detail-level-select">Nivel de detalle</label>
      <select id="detail-level-select" className={selectClass} value={detail} onChange={event => setDetail(event.currentTarget.value)} title="Nivel de detalle">
        <option value="coarse">Bajo</option><option value="medium">Medio</option><option value="fine">Fino</option>
      </select>
    </div>
    <span className="shrink-0 text-[10px] font-semibold text-slate-600 md:hidden">VISOR</span>
    <label className="sr-only" htmlFor="visual-style-select">Estilo visual</label>
    <select id="visual-style-select" className={`${selectClass} max-w-[160px]`} defaultValue="hidden_line" title="Estilo visual" onChange={event => requestRibbonAction({ type: 'visual-style', style: event.currentTarget.value as VisualStyle })}>
      <option value="hidden_line">Línea oculta</option><option value="wireframe">Alámbrico</option><option value="consistent_colors">Colores coherentes</option><option value="shaded">Sombreado</option>
    </select>
    <div className="hidden items-center gap-1 md:flex">
      <span className="h-4 w-px shrink-0 bg-slate-300" />
      <ViewButton label="Trayectoria solar" Icon={Sun} />
      <ViewButton label="Sombras" Icon={Lightbulb} />
      <ViewButton label="No recortar vista" Icon={Crop} />
      <ViewButton label="Mostrar región de recorte" Icon={Scan} />
      <ViewButton label="Ocultar o aislar temporalmente" Icon={EyeOff} />
      <ViewButton label="Revelar elementos ocultos" Icon={View} />
      <ViewButton label="Propiedades temporales de vista" Icon={SlidersHorizontal} />
    </div>
  </div>;
}
