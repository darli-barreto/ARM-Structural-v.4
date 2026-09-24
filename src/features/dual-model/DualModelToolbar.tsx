'use client';

import { memo } from 'react';
import { Box, Calculator, Maximize, Network, Settings2 } from 'lucide-react';

function DualModelToolbar() {
  return <div id="model-toolbar" className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] text-slate-800" aria-label="Controles del modelo físico y analítico">
      <div className="flex shrink-0 gap-0.5">
        <button id="model-physical" className="flex h-7 shrink-0 items-center gap-1 rounded border border-emerald-700 bg-emerald-100 px-2 py-0.5" type="button" title="Modelo físico"><Box aria-hidden="true" /> Físico</button>
        <button id="model-analytical" className="flex h-7 shrink-0 items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5" type="button" title="Modelo analítico"><Network aria-hidden="true" /> Analítico</button>
      </div>
      <select id="model-projection" aria-label="Proyección" defaultValue="3d">
        <option value="3d">3D</option>
        <option value="plan">Planta</option>
        <option value="elevation">Frontal</option>
      </select>
      <button id="model-fit" className="flex h-7 shrink-0 items-center rounded border border-slate-300 bg-white px-2" type="button" title="Encuadrar modelo" aria-label="Encuadrar modelo"><Maximize aria-hidden="true" className="h-3.5 w-3.5" /></button>
      <label className="flex shrink-0 items-center gap-1"><input id="model-sync" type="checkbox" /> Comparar</label>
      <select id="model-scope" className="h-7 shrink-0 rounded border border-slate-300 bg-white px-2" aria-label="Alcance analítico" defaultValue="axes">
        <option value="axes">Ejes geométricos</option>
        <option value="calculation">Plano de cálculo 2D</option>
      </select>
      <span id="model-geometry-options">
        <select id="model-frame-plane" className="h-7 shrink-0 rounded border border-slate-300 bg-white px-2" aria-label="Pórtico geométrico" title="Filtro visual, no modifica el modelo de cálculo" defaultValue="all">
          <option value="all">Todos los pórticos</option>
          <option value="XY">Pórtico X-Y</option>
          <option value="ZY">Pórtico Z-Y</option>
        </select>
        <label id="model-frame-coordinate" className="flex shrink-0 items-center gap-1"><span id="model-frame-axis">Z (m)</span><input id="model-frame-ordinate" className="h-7 w-20 rounded border border-slate-300 bg-white px-1" aria-label="Coordenada del pórtico (m)" type="number" step="0.001" defaultValue="0" disabled /></label>
        <label className="flex shrink-0 items-center gap-1" title="Contornos medios de losas, no barras FEM"><input id="model-slab-contours" type="checkbox" /> Contornos de losas</label>
      </span>
      <label className="flex shrink-0 items-center gap-1"><input id="model-isolate" type="checkbox" /> Aislar selección</label>
      <label className="flex shrink-0 items-center gap-1"><input id="model-nodes" type="checkbox" defaultChecked /> Nudos</label>
      <label className="flex shrink-0 items-center gap-1"><input id="model-supports" type="checkbox" defaultChecked /> Apoyos</label>
      <label className="flex shrink-0 items-center gap-1"><input id="model-loads" type="checkbox" defaultChecked /> Cargas</label>
      <select id="model-diagram" className="h-7 shrink-0 rounded border border-slate-300 bg-white px-2" aria-label="Diagrama" defaultValue="none">
        <option value="none">Sin diagrama</option>
        <option value="axial">Axial N (kN)</option>
        <option value="shear">Cortante V (kN)</option>
        <option value="moment">Momento M (kN m)</option>
        <option value="deformation">Deformada</option>
      </select>
      <button id="model-calculate" className="flex h-7 shrink-0 items-center rounded border border-slate-300 bg-white px-2" type="button" title="Configurar y calcular pórtico" aria-label="Configurar y calcular pórtico"><Calculator aria-hidden="true" className="h-3.5 w-3.5" /></button>
      <label className="flex shrink-0 items-center gap-1"><input id="model-transparent" type="checkbox" /> Transparente</label>
      <label className="flex shrink-0 items-center gap-1"><input id="model-steel" type="checkbox" /> Armadura</label>
      <button id="model-rebar" className="flex h-7 shrink-0 items-center rounded border border-slate-300 bg-white px-2" type="button" title="Armadura manual del elemento" aria-label="Armadura manual del elemento"><Settings2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
    </div>;
}

export default memo(DualModelToolbar);
