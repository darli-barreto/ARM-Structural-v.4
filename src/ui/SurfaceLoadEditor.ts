import type {AnalysisModel} from '../core/analysis/Model';
import type {BimElementDocument} from '../core/database/BimDatabaseTypes';
import {compileSurfaceLoads,surfaceSnapshot,type SurfaceLoad} from '../core/analysis/SurfaceLoads';
import {escapeHtml as h,icon} from './shared';

export function surfaceLoadEditor(out:HTMLElement,model:AnalysisModel,docs:BimElementDocument[],changed:()=>void,status:(s:string)=>void,selectedId?:string){
  const slabs=docs.filter(d=>d.geometry.definition.type==='slab');
  const selected=slabs.find(d=>d.uniqueId===selectedId)??slabs[0];
  const sources=model.surfaceLoads??[],saved=sources.find(s=>s.sourceId===selected?.uniqueId);
  const receivers=docs.filter(d=>d.geometry.definition.type==='beam'&&model.members.some(m=>m.sourceId===d.uniqueId)&&
    model.members.filter(m=>m.sourceId===d.uniqueId).every(m=>Math.abs(model.nodes.find(n=>n.id===m.start)!.y-model.nodes.find(n=>n.id===m.end)!.y)<1e-6));
  const compiled=compileSurfaceLoads(model,false);
  const number=(key:string,label:string,value?:number)=>`<label>${label}<input id="surface-${key}" type="number" min="0" step="any" required value="${value??''}"></label>`;
  out.innerHTML=`<div class="surface-editor"><div class="load-balance-warning">Reparto uniforme declarado; no es analisis de placa ni reparto automatico. Peso de losa bruto con huecos, sin conciliacion de solapes. Receptores: D/L manual = 0 y D adicional. La conservacion de fuerza no verifica momentos ni compatibilidad espacial del reparto.</div>
    <div class="surface-saved"><table class="schedule-table"><thead><tr><th>Fuente</th><th>D / L total (kN)</th><th>Al portico (kN)</th><th>Fuera (kN)</th><th>Pendiente (kN)</th><th>Acciones</th></tr></thead><tbody>${compiled.rows.map(s=>`<tr data-surface-source="${h(s.sourceId)}"><td>${h(docs.find(d=>d.uniqueId===s.sourceId)?.instanceParameters.mark??s.sourceId)}</td><td>${s.dead.toFixed(3)} / ${s.live.toFixed(3)}</td><td>${s.assignedDead.toFixed(3)} / ${s.assignedLive.toFixed(3)}</td><td>${s.outsideDead.toFixed(3)} / ${s.outsideLive.toFixed(3)}</td><td>${s.pendingDead.toFixed(3)} / ${s.pendingLive.toFixed(3)} (${(s.pendingFraction*100).toFixed(2)}%)</td><td><button data-surface-edit="${h(s.sourceId)}" class="icon-button" title="Editar fuente" aria-label="Editar fuente">${icon('Pencil')}</button><button data-surface-delete="${h(s.sourceId)}" class="icon-button" title="Eliminar fuente" aria-label="Eliminar fuente">${icon('Trash2')}</button></td></tr>`).join('')}</tbody></table></div>
    ${selected?`<form id="surface-form"><div class="surface-properties"><label>Losa<select id="surface-source">${slabs.map(d=>`<option value="${h(d.uniqueId)}" ${d===selected?'selected':''}>${h(d.instanceParameters.mark)} / ${h(d.levelName)}</option>`).join('')}</select></label><div class="surface-dimensions">Area con huecos: ${surfaceSnapshot(selected).area.toFixed(3)} m2<br>Espesor: ${surfaceSnapshot(selected).thickness.toFixed(3)} m</div>
    ${number('weight','Peso unitario (kN/m3)',saved?.unitWeight)}${number('dead','D sobrepuesta (kN/m2)',saved?.additionalDead)}${number('live','L (kN/m2)',saved?.live)}
    <label class="surface-reference">Sustento de cargas y reparto<input id="surface-reference" maxlength="2000" value="${h(saved?.reference??'')}"></label>
    ${number('outside','Fuera del portico (%)',(saved?.outsideFraction??0)*100)}<label class="surface-reference">Sustento fuera del portico<input id="surface-outside-reference" maxlength="2000" value="${h(saved?.outsideReference??'')}"></label></div>
    <div class="surface-receivers"><table class="schedule-table"><thead><tr><th>Viga receptora / nivel</th><th>Porcentaje de la fuente (%)</th><th>D / L manual (kN/m)</th></tr></thead><tbody>${receivers.map(d=>{const ms=model.members.filter(m=>m.sourceId===d.uniqueId);return `<tr><td>${h(d.instanceParameters.mark)} / ${h(d.levelName)}</td><td><input type="number" aria-label="Porcentaje ${h(d.instanceParameters.mark)}" data-surface-receiver="${h(d.uniqueId)}" min="0" max="100" step="any" required value="${(saved?.allocations.find(a=>a.receiverId===d.uniqueId)?.fraction??0)*100}"></td><td>${ms.some(m=>m.dead!==0||m.live!==0||m.deadLoadMode==='includes-self-weight')?'Requiere conciliacion en Barras':'Sin cargas manuales'}</td></tr>`;}).join('')}</tbody></table></div>
    <div class="surface-save"><button type="submit" id="surface-save" class="primary">${icon('Save')} Guardar fuente</button><span id="surface-feedback" role="status"></span></div></form>`:'<div class="schedule-empty">Sin losas en el modelo BIM</div>'}</div>`;
  const render=(id?:string)=>surfaceLoadEditor(out,model,docs,changed,status,id);
  out.querySelectorAll<HTMLButtonElement>('[data-surface-edit]').forEach(b=>b.onclick=()=>render(b.dataset.surfaceEdit));
  out.querySelectorAll<HTMLButtonElement>('[data-surface-delete]').forEach(b=>b.onclick=()=>{
    if(!confirm('Eliminar esta fuente y sus cargas transferidas?'))return;
    model.surfaceLoads=sources.filter(s=>s.sourceId!==b.dataset.surfaceDelete);changed();render(selected?.uniqueId);
  });
  const select=out.querySelector<HTMLSelectElement>('#surface-source');if(select)select.onchange=()=>render(select.value);
  const form=out.querySelector<HTMLFormElement>('#surface-form');if(!form||!selected)return;
  form.onsubmit=e=>{
    e.preventDefault();
    try{
      const value=(id:string)=>out.querySelector<HTMLInputElement>('#surface-'+id)!;
      const allocations=[...out.querySelectorAll<HTMLInputElement>('[data-surface-receiver]')].map(el=>({receiverId:el.dataset.surfaceReceiver!,fraction:el.valueAsNumber/100}));
      if(allocations.some(a=>!Number.isFinite(a.fraction)||a.fraction<0))throw new Error('Porcentajes no validos.');
      const source:SurfaceLoad={...surfaceSnapshot(selected),unitWeight:value('weight').valueAsNumber,additionalDead:value('dead').valueAsNumber,live:value('live').valueAsNumber,
        reference:value('reference').value,method:'declared-uniform',allocations:allocations.filter(a=>a.fraction>0),outsideFraction:value('outside').valueAsNumber/100,outsideReference:value('outside-reference').value};
      const next=[...sources.filter(s=>s.sourceId!==selected.uniqueId),source];
      compileSurfaceLoads({...model,surfaceLoads:next},false);
      model.surfaceLoads=next;changed();render(selected.uniqueId);
      let message='Fuente guardada. Reparto completo; calcular para actualizar resultados.';
      try{compileSurfaceLoads(model);}catch(error){message='Borrador guardado. '+(error as Error).message;}
      out.querySelector('#surface-feedback')!.textContent=message;status(message);
    }catch(error){out.querySelector('#surface-feedback')!.textContent=(error as Error).message;status((error as Error).message);}
  };
}
