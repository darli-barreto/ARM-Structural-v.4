import { BimDatabase } from '../core/database/BimDatabase';
import { BimCategory } from '../core/database/BimDatabaseTypes';
import { Grouping, ScheduleRow, scheduleRows, scheduleCsv, scheduleColumns, scheduleTotals } from '../core/model/Schedule';
import { escapeHtml as h, icon, download, modalKeyboard } from './shared';
import './workspace.css';

export class ScheduleModal {
  private container=document.createElement('div');
  private category:BimCategory|'ALL'='ALL';
  private level='ALL'; private sector='ALL'; private search=''; private group:Grouping='instance';
  private sort:keyof ScheduleRow='mark'; private direction=1; private page=0; private pageSize=50;
  private selected=new Set<string>(); private rows:ScheduleRow[]=[]; private previousFocus:HTMLElement|null=null;
  constructor(private onSelectElement:(id:number|string)=>void, private onDeleteElement?:(id:number|string)=>void) {
    this.container.className='workspace-overlay';this.container.id='bim-schedule-modal';this.container.hidden=true;
    this.container.setAttribute('role','dialog');this.container.setAttribute('aria-modal','true');this.container.setAttribute('aria-label','Cuantificacion');
    document.body.append(this.container);modalKeyboard(this.container,()=>this.close());
    this.render();
    let pending=false;
    BimDatabase.getInstance().subscribe(()=>{
      if(pending)return;pending=true;
      queueMicrotask(()=>{pending=false;if(!this.container.hidden){this.filters();this.table();}});
    });
  }
  public open(category:BimCategory|'ALL'='ALL'):void {
    this.previousFocus=document.activeElement as HTMLElement;this.category=category;this.page=0;this.selected.clear();
    this.container.hidden=false;this.input<HTMLSelectElement>('sched-category').value=category;
    this.filters();this.table();this.input<HTMLInputElement>('sched-search').focus();
  }
  public close():void {this.container.hidden=true;this.previousFocus?.focus();}
  private input<T extends HTMLElement>(id:string):T{return this.container.querySelector<T>('#'+id)!;}
  private render():void {
    this.container.innerHTML=`<section class="workspace-dialog schedule-dialog">
      <header class="workspace-heading"><div><span class="workspace-eyebrow">ARM / CANTIDADES</span><h2>Cuantificacion de estructura</h2></div><div class="workspace-actions">
      <button id="sched-export">${icon('Download')} Exportar CSV</button><button class="icon-button" id="sched-close" title="Cerrar" aria-label="Cerrar">${icon('X')}</button></div></header>
      <div class="schedule-filters">
      <label>Categoria<select id="sched-category"><option value="ALL">Todas las categorias</option><option value="OST_StructuralColumns">Columnas</option><option value="OST_StructuralFraming">Vigas</option><option value="OST_StructuralFoundation">Zapatas</option><option value="OST_Floors">Losas</option></select></label>
      <label>Nivel<select id="sched-level"></select></label><label>Sector<select id="sched-sector"></select></label>
      <label>Agrupar por<select id="sched-group"><option value="instance">Ejemplar</option><option value="type">Tipo y resistencia</option><option value="level">Nivel</option><option value="category">Categoria</option></select></label>
      <label class="schedule-search">Buscar<input id="sched-search" type="search" placeholder="Marca, tipo, nivel o ID" /></label>
      <button id="sched-reset" class="icon-button" title="Restablecer filtros" aria-label="Restablecer filtros">${icon('RotateCcw')}</button></div>
      <div id="sched-summary" class="schedule-summary"></div>
      <div class="schedule-bulk"><span id="sched-selection">0 seleccionados</span><label>Sector<input id="sched-bulk-sector" value="Sector A" maxlength="80" /></label><button id="sched-bulk-apply">Aplicar</button><span id="sched-message" role="status"></span></div>
      <div class="schedule-scroll"><table class="schedule-table"><thead id="sched-head"></thead><tbody id="sched-body"></tbody><tfoot id="sched-foot"></tfoot></table></div>
      <footer class="workspace-footer"><span id="sched-range"></span><div class="workspace-actions"><label>Filas<select id="sched-page-size"><option>25</option><option selected>50</option><option>100</option></select></label><button id="sched-prev" class="icon-button" title="Anterior" aria-label="Pagina anterior">${icon('ChevronLeft')}</button><button id="sched-next" class="icon-button" title="Siguiente" aria-label="Pagina siguiente">${icon('ChevronRight')}</button></div></footer>
      </section>`;
    this.input('sched-close').onclick=()=>this.close();
    const select=(id:string,fn:(v:string)=>void)=>this.input<HTMLSelectElement>(id).onchange=e=>{fn((e.target as HTMLSelectElement).value);this.page=0;this.selected.clear();this.table();};
    select('sched-category',v=>this.category=v as BimCategory|'ALL');select('sched-level',v=>this.level=v);select('sched-sector',v=>this.sector=v);select('sched-group',v=>this.group=v as Grouping);
    select('sched-page-size',v=>this.pageSize=Number(v));
    this.input<HTMLInputElement>('sched-search').oninput=e=>{this.search=(e.target as HTMLInputElement).value;this.page=0;this.selected.clear();this.table();};
    this.input('sched-reset').onclick=()=>{this.category='ALL';this.level=this.sector='ALL';this.search='';this.page=0;this.selected.clear();this.input<HTMLSelectElement>('sched-category').value='ALL';this.input<HTMLInputElement>('sched-search').value='';this.filters();this.table();};
    this.input('sched-prev').onclick=()=>{this.page--;this.table();};this.input('sched-next').onclick=()=>{this.page++;this.table();};
    this.input('sched-export').onclick=()=>download(scheduleCsv(this.rows),'cuantificacion.csv','text/csv;charset=utf-8');
    this.input('sched-bulk-apply').onclick=()=>{
      const sector=this.input<HTMLInputElement>('sched-bulk-sector').value.trim();if(!sector)return;
      this.selected.forEach(id=>BimDatabase.getInstance().updateInstanceParameters(id,{sector}));
      this.input('sched-message').textContent=`${this.selected.size} elementos actualizados`;this.selected.clear();this.filters();this.table();
    };
  }
  private filters():void {
    const all=BimDatabase.getInstance().getAllElements();
    for(const [id,values,current] of [['sched-level',all.map(d=>d.levelName),this.level],['sched-sector',all.map(d=>d.instanceParameters.sector),this.sector]] as const){
      const options=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
      if(current!=='ALL'&&!options.includes(current))options.push(current);
      const el=this.input<HTMLSelectElement>(id);el.innerHTML='<option value="ALL">Todos</option>'+options.map(v=>`<option value="${h(v)}">${h(v)}</option>`).join('');el.value=current;
    }
  }
  private table():void {
    const db=BimDatabase.getInstance();const {records,summary}=db.querySchedule({category:this.category,levelName:this.level,sector:this.sector,search:this.search});
    const valid=new Set(records.map(r=>r.uniqueId));this.selected.forEach(id=>{if(!valid.has(id))this.selected.delete(id);});
    this.rows=scheduleRows(records,this.group).sort((a,b)=>{
      const x=a[this.sort],y=b[this.sort];return this.direction*(typeof x==='number'&&typeof y==='number'?(Number.isFinite(x)?x:0)-(Number.isFinite(y)?y:0):String(x).localeCompare(String(y),'es',{numeric:true}));
    });
    this.page=Math.max(0,Math.min(this.page,Math.ceil(this.rows.length/this.pageSize)-1));
    const start=this.page*this.pageSize,visible=this.rows.slice(start,start+this.pageSize);
    const num=(n:number,d=2)=>Number.isFinite(n)?n.toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d}):'-';
    const totals=scheduleTotals(this.rows);
    this.input('sched-summary').innerHTML=[['Elementos',num(summary.totalCount,0),''],['Concreto neto',num(totals.volume!,3),'m³'],['Solapes descontados',num(totals.deduction!,3),'m³'],['Encofrado estimado',num(summary.totalSurfaceArea),'m²'],['Costo neto estimado',num(totals.cost!),'USD']].map(([label,value,unit])=>`<div><span>${label}</span><strong>${value} <small>${unit}</small></strong></div>`).join('');
    this.input('sched-head').innerHTML=`<tr><th><input id="sched-select-page" type="checkbox" aria-label="Seleccionar pagina" /></th>${scheduleColumns.map(c=>`<th aria-sort="${this.sort===c.key?(this.direction===1?'ascending':'descending'):'none'}"><button data-sort="${c.key}">${c.label}${this.sort===c.key?(this.direction===1?' ↑':' ↓'):''}</button></th>`).join('')}<th>Modelo</th></tr>`;
    this.input('sched-body').innerHTML=visible.length?visible.map((r,index)=>{
      const single=this.group==='instance',id=h(r.ids[0]);
      return `<tr data-index="${start+index}" class="${r.ids.every(id=>this.selected.has(id))?'is-selected':''}"><td><input type="checkbox" data-select="${start+index}" aria-label="Seleccionar ${h(r.mark||r.type)}" ${r.ids.every(id=>this.selected.has(id))?'checked':''}/></td>${scheduleColumns.map(c=>{
        const v=r[c.key];let content=h(v);
        if(single&&(c.key==='mark'||c.key==='sector'||c.key==='fc'))content=`<input class="schedule-cell-input" aria-label="${h(c.label)} ${h(r.mark)}" data-edit="${c.key}" data-id="${id}" type="${c.key==='fc'?'number':'text'}" ${c.key==='fc'?'min="1" step="1"':'maxlength="80"'} value="${h(v)}"/>`;
        else if(c.numeric)content=Number.isFinite(v as number)?num(v as number,['volume','gross','deduction'].includes(c.key)?3:['count','fc'].includes(c.key)?0:2):c.key==='fc'?'Varios':'-';
        return `<td class="${c.numeric?'numeric':''}" title="${h(c.key==='type'?r.dimensions:v)}">${content}</td>`;
      }).join('')}<td><div class="workspace-actions">${single?`<button class="icon-button" data-focus="${id}" title="Ver en modelo" aria-label="Ver ${h(r.mark)} en modelo">${icon('Crosshair')}</button><button class="icon-button danger" data-delete="${id}" title="Eliminar" aria-label="Eliminar ${h(r.mark)}">${icon('Trash2')}</button>`:`<span>${r.ids.length} elem.</span>`}</div></td></tr>`;
    }).join(''):'<tr><td colspan="12" class="schedule-empty">No hay elementos que coincidan con los filtros.</td></tr>';
    this.input('sched-foot').innerHTML=`<tr><td></td>${scheduleColumns.map(c=>`<td class="${c.numeric?'numeric':''}">${c.key==='mark'?'TOTAL FILTRADO':totals[c.key]!==undefined?num(totals[c.key]!,c.key==='count'?0:['volume','gross','deduction'].includes(c.key)?3:2):''}</td>`).join('')}<td></td></tr>`;
    this.input('sched-range').textContent=`${this.rows.length?start+1:0}–${Math.min(start+this.pageSize,this.rows.length)} de ${this.rows.length} filas`;
    this.input<HTMLButtonElement>('sched-prev').disabled=this.page===0;this.input<HTMLButtonElement>('sched-next').disabled=start+this.pageSize>=this.rows.length;
    this.input('sched-selection').textContent=`${this.selected.size} seleccionados`;this.input<HTMLButtonElement>('sched-bulk-apply').disabled=!this.selected.size;
    const check=this.input<HTMLInputElement>('sched-select-page');check.checked=visible.length>0&&visible.every(r=>r.ids.every(id=>this.selected.has(id)));check.indeterminate=!check.checked&&visible.some(r=>r.ids.some(id=>this.selected.has(id)));
    check.onchange=()=>{visible.forEach(r=>r.ids.forEach(id=>check.checked?this.selected.add(id):this.selected.delete(id)));this.table();};
    this.container.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.sort as keyof ScheduleRow;this.direction=this.sort===key?-this.direction:1;this.sort=key;this.table();});
    this.container.querySelectorAll<HTMLInputElement>('[data-select]').forEach(b=>b.onchange=()=>{this.rows[Number(b.dataset.select)].ids.forEach(id=>b.checked?this.selected.add(id):this.selected.delete(id));this.table();});
    this.container.querySelectorAll<HTMLInputElement>('[data-edit]').forEach(input=>input.onchange=()=>{
      const key=input.dataset.edit!,v=input.value.trim();if(!v||(key==='fc'&&(!Number.isFinite(Number(v))||Number(v)<=0))){input.setCustomValidity('Valor no valido');input.reportValidity();return;}
      input.setCustomValidity('');db.updateInstanceParameters(input.dataset.id!,{[key==='fc'?'concreteStrength':key]:key==='fc'?Number(v):v});
    });
    this.container.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach(b=>b.onclick=()=>{this.close();this.onSelectElement(b.dataset.focus!);});
    this.container.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Eliminar este elemento del modelo?'))this.onDeleteElement?.(b.dataset.delete!);});
  }
}
