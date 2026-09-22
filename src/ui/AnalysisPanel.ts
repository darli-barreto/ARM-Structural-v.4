import { BimDatabase } from '../core/database/BimDatabase';
import { AnalysisModel, AnalysisResult, AnalysisSetup, deriveAnalysis, validateAnalysis, matchesAnalyticalGeometry, Support } from '../core/analysis/Model';
import { escapeHtml as h, download, icon, modalKeyboard } from './shared';
import { analysisReport } from '../core/analysis/Report';
import './workspace.css';
import type { BenchmarkId } from '../core/analysis/Benchmarks';
import { benchmarkComparison } from '../core/analysis/BenchmarkReport';
import {buildLoadLedger,loadLedgerCsv} from '../core/analysis/LoadLedger';
import {loadBalanceView,type LoadFilter} from './LoadBalanceView';
import type {DeadLoadMode} from '../core/analysis/Loads';
import './load-balance.css';
import {surfaceLoadEditor} from './SurfaceLoadEditor';

export class AnalysisPanel {
  public stateVersion=0;
  public getVisualization(){return {model:this.model,result:this.needsGeneration||this.model?.revision!==BimDatabase.getInstance().revision?null:this.result,factors:this.factors,stale:this.needsGeneration||!!this.model&&this.model.revision!==BimDatabase.getInstance().revision};}
  private overlay=document.createElement('div');private model:AnalysisModel|null=null;private result:AnalysisResult|null=null;
  private worker:Worker|null=null;private pending=false;private previous:HTMLElement|null=null;
  private needsGeneration=false;
  private benchmark:BenchmarkId|undefined;
  private loadFilter:LoadFilter='applied';
  private factors={dead:1,live:1,nodal:1};private caseName='Servicio D + L';
  constructor(private select:(id:string)=>void) {
    this.overlay.className='workspace-overlay';this.overlay.id='analysis-panel';this.overlay.hidden=true;
    this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');this.overlay.setAttribute('aria-label','Analisis estructural');
    document.body.append(this.overlay);modalKeyboard(this.overlay,()=>this.close());
    BimDatabase.getInstance().subscribe(action=>{if(action==='quantities'){if(!this.overlay.hidden&&this.overlay.querySelector('[data-tab="loads"].primary'))this.table('loads');return;}this.stateVersion++;if(this.model){this.result=null;this.worker?.terminate();this.worker=null;this.pending=false;if(!this.overlay.hidden){this.status('El modelo BIM cambio. Regenerar el plano analitico.');this.buttons();this.table('results');this.paint();}}});
  }
  public open():void {this.previous=document.activeElement as HTMLElement;this.overlay.hidden=false;this.render();this.get('analysis-close').focus();}
  public getSetup():AnalysisSetup|undefined {
    if(!this.model)return undefined;
    return structuredClone({model:this.model,factors:this.factors,caseName:this.caseName,benchmark:this.benchmark,
      requiresRegeneration:this.needsGeneration||this.model.revision!==BimDatabase.getInstance().revision});
  }
  public restoreSetup(setup?:AnalysisSetup):void {
    this.stateVersion++;
    this.worker?.terminate();this.worker=null;this.pending=false;this.result=null;
    this.benchmark=setup?.benchmark;
    if(!setup){this.model=null;this.needsGeneration=false;this.factors={dead:1,live:1,nodal:1};this.caseName='Servicio D + L';return;}
    const copy=structuredClone(setup);this.model=copy.model;
    this.needsGeneration=!!copy.requiresRegeneration||!matchesAnalyticalGeometry(this.model,BimDatabase.getInstance().getAllElements());
    this.model.revision=BimDatabase.getInstance().revision;
    this.factors=copy.factors;this.caseName=copy.caseName;
  }
  private close():void{this.overlay.hidden=true;this.previous?.focus();}
  private get<T extends HTMLElement>(id:string):T{return this.overlay.querySelector<T>('#'+id)!;}
  private status(message:string):void{const el=this.overlay.querySelector('#analysis-status');if(el)el.textContent=message;}
  private changed():void{this.stateVersion++;this.result=null;this.worker?.terminate();this.worker=null;this.pending=false;this.buttons();this.paint();if(this.overlay.querySelector('[data-tab="results"].primary'))this.table('results');if(this.overlay.querySelector('[data-tab="loads"].primary'))this.table('loads');this.status('Entradas modificadas. Calcular para actualizar resultados.');}
  private render():void {
    this.overlay.innerHTML=`<section class="workspace-dialog analysis-dialog"><header class="workspace-heading"><div><span class="workspace-eyebrow">ARM / INGENIERIA / RNE PERU</span><h2>Analisis de porticos 2D</h2></div><div class="workspace-actions"><button id="analysis-export">${icon('Download')} Modelo</button><button id="analysis-report">${icon('FileText')} Memoria</button><button id="analysis-close" class="icon-button" title="Cerrar" aria-label="Cerrar">${icon('X')}</button></div></header>
    <div class="schedule-filters"><label>Plano<select id="analysis-plane"><option value="XY">X-Y (Z constante)</option><option value="ZY">Z-Y (X constante)</option></select></label><label>Coordenada (m)<input id="analysis-ordinate" type="number" step="0.1" value="0" /></label><label>Union de nudos (m)<input id="analysis-tolerance" type="number" min="0.00001" max="1" step="0.001" value="0.001" /></label><label>E (MPa)<input id="analysis-modulus" type="number" min="1" value="25000" /></label><label>Peso unitario (kN/m³)<input id="analysis-weight" type="number" min="0" step="0.1" value="24" /></label><button id="analysis-generate">Generar plano</button><button id="analysis-bases">Empotrar bases</button></div>
    <div class="analysis-scope">Lineal elastico, barras Timoshenko. Cargas manuales y reparto superficial declarado. Placas, cimentaciones, sismo E.030 y verificaciones E.060: no evaluados.</div>
    <div class="analysis-body"><div class="analysis-visual"><canvas id="analysis-canvas" width="720" height="420" aria-label="Modelo analitico y deformada"></canvas><div id="analysis-info"></div></div><div class="analysis-data"><div class="analysis-tabs"><button data-tab="nodes" class="primary">Nudos y cargas</button><button data-tab="members">Barras</button><button data-tab="surfaces">Superficies</button><button data-tab="loads">Balance de cargas</button><button data-tab="results">Resultados</button></div><div id="analysis-table" class="analysis-table-wrap"></div></div></div>
    <footer class="workspace-footer"><div class="workspace-actions"><label>Caso<input id="analysis-case" value="${h(this.caseName)}" maxlength="80" /></label><label>Factor D<input id="analysis-factor-d" type="number" step="0.1" value="${this.factors.dead}" /></label><label>Factor L<input id="analysis-factor-l" type="number" step="0.1" value="${this.factors.live}" /></label><label>Factor nodal<input id="analysis-factor-n" type="number" step="0.1" value="${this.factors.nodal}" /></label><button id="analysis-solve" class="primary">${icon('Calculator')} Calcular</button></div><span id="analysis-status" role="status"></span></footer></section>`;
    this.get('analysis-close').onclick=()=>this.close();
    this.get('analysis-generate').onclick=()=>{
      try{
        if(this.model&&!confirm('Regenerar el plano reinicia apoyos, cargas, fuentes superficiales y liberaciones. Continuar?'))return;
        const db=BimDatabase.getInstance();this.model=deriveAnalysis(db.getAllElements(),db.revision,{plane:this.get<HTMLSelectElement>('analysis-plane').value as 'XY'|'ZY',ordinate:this.get<HTMLInputElement>('analysis-ordinate').valueAsNumber,tolerance:this.get<HTMLInputElement>('analysis-tolerance').valueAsNumber,elasticModulusMPa:this.get<HTMLInputElement>('analysis-modulus').valueAsNumber,unitWeight:this.get<HTMLInputElement>('analysis-weight').valueAsNumber});
        this.benchmark=undefined;this.needsGeneration=false;this.changed();this.table('nodes');this.paint();this.status(`${this.model.nodes.length} nudos / ${this.model.members.length} tramos / ${this.model.omitted} elementos fuera del alcance`);
      }catch(e){this.status((e as Error).message);}
    };
    this.get('analysis-bases').onclick=()=>{if(!this.model?.nodes.length)return;const y=Math.min(...this.model.nodes.map(n=>n.y));this.model.nodes.forEach(n=>{if(Math.abs(n.y-y)<.001)n.support='fixed';});this.changed();this.table('nodes');};
    this.get('analysis-export').onclick=()=>{if(this.model)download(JSON.stringify({units:{length:'m',force:'kN',stress:'MPa'},model:this.model,factors:this.factors,result:this.result},null,2),'modelo-analitico.json');};
    this.get('analysis-report').onclick=()=>{if(this.model&&this.result)download(analysisReport(this.model,this.result,this.factors,this.get<HTMLCanvasElement>('analysis-canvas').toDataURL(),this.benchmark,buildLoadLedger(this.model,this.factors,BimDatabase.getInstance().getAllElements(),this.result)),'memoria-portico.html','text/html;charset=utf-8');};
    this.get('analysis-solve').onclick=()=>this.solve();
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>this.table(b.dataset.tab!));
    this.get<HTMLInputElement>('analysis-case').onchange=e=>{this.caseName=(e.target as HTMLInputElement).value;this.changed();};
    for(const [suffix,key] of [['d','dead'],['l','live'],['n','nodal']] as const)this.get<HTMLInputElement>('analysis-factor-'+suffix).onchange=e=>{this.factors[key]=(e.target as HTMLInputElement).valueAsNumber;this.changed();};
    this.table(this.benchmark?'results':'nodes');this.buttons();this.paint();
    if(this.model){this.get<HTMLSelectElement>('analysis-plane').value=this.model.plane;this.get<HTMLInputElement>('analysis-ordinate').value=String(this.model.ordinate);this.get<HTMLInputElement>('analysis-tolerance').value=String(this.model.tolerance);const m=this.model.members[0];if(m){this.get<HTMLInputElement>('analysis-modulus').value=String(m.elasticModulusMPa);this.get<HTMLInputElement>('analysis-weight').value=String(m.weight/m.area);}}
    for(const id of ['analysis-plane','analysis-ordinate','analysis-tolerance','analysis-modulus','analysis-weight'])this.get(id).onchange=()=>{this.needsGeneration=true;this.changed();this.status('Parametros del plano modificados. Generar plano para aplicarlos.');};
    if(this.needsGeneration)this.status('Plano conservado, pero no vigente. Regenerar y revisar apoyos/cargas antes de calcular.');
  }
  private buttons():void {
    if(!this.overlay.querySelector('#analysis-solve'))return;
    const stale=this.needsGeneration||this.model?.revision!==BimDatabase.getInstance().revision;
    this.get<HTMLButtonElement>('analysis-solve').disabled=!this.model||stale||this.pending;
    this.get<HTMLButtonElement>('analysis-report').disabled=!this.result||stale;
    this.get<HTMLButtonElement>('analysis-export').disabled=!this.model||stale;
    this.get<HTMLButtonElement>('analysis-bases').disabled=!this.model||stale;
  }
  private table(tab:string):void {
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.classList.toggle('primary',b.dataset.tab===tab));
    this.overlay.querySelector('.analysis-body')!.classList.toggle('is-load-balance',tab==='loads'||tab==='surfaces');
    this.overlay.querySelector('.analysis-dialog')!.classList.toggle('showing-load-balance',tab==='loads'||tab==='surfaces');
    const out=this.get('analysis-table');
    if(!this.model){out.innerHTML='<div class="schedule-empty">Sin plano analitico</div>';return;}
    if(tab==='surfaces'){
      if(this.needsGeneration||this.model.revision!==BimDatabase.getInstance().revision){out.innerHTML='<div class="schedule-empty">Regenerar el plano antes de editar fuentes superficiales.</div>';return;}
      surfaceLoadEditor(out,this.model,BimDatabase.getInstance().getAllElements(),()=>{this.benchmark=undefined;this.changed();},s=>this.status(s));return;
    }
    if(tab==='loads'){
      if(this.needsGeneration||this.model.revision!==BimDatabase.getInstance().revision){out.innerHTML='<div class="schedule-empty">Plano no vigente. Regenerar antes de emitir el balance.</div>';return;}
      try{
        const ledger=buildLoadLedger(this.model,this.factors,BimDatabase.getInstance().getAllElements(),this.result??undefined);
        out.innerHTML=loadBalanceView(ledger,this.loadFilter);
        out.querySelector<HTMLSelectElement>('#load-balance-filter')!.onchange=e=>{this.loadFilter=(e.target as HTMLSelectElement).value as LoadFilter;this.table('loads');};
        out.querySelector<HTMLButtonElement>('#load-balance-csv')!.onclick=()=>download(loadLedgerCsv(ledger),'balance-cargas.csv','text/csv;charset=utf-8');
        out.querySelector<HTMLButtonElement>('#load-balance-json')!.onclick=()=>download(JSON.stringify({...ledger,caseName:this.caseName,generatedAt:new Date().toISOString()},null,2),'balance-cargas.json');
        out.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach(el=>el.onclick=()=>{this.close();this.select(el.dataset.focus!);});
      }catch(error){out.innerHTML=`<div class="schedule-empty">${h((error as Error).message)}</div>`;}
      return;
    }
    const input=(value:number,index:number,key:string,type:'node'|'member')=>`<input aria-label="${key} ${index+1}" type="number" step="0.1" value="${value}" data-index="${index}" data-key="${key}" data-kind="${type}"/>`;
    if(tab==='nodes')out.innerHTML=`<table class="schedule-table"><thead><tr><th>Nudo</th><th>H (m)</th><th>Y (m)</th><th>Apoyo</th><th>Fh (kN)</th><th>Fy (kN)</th><th>M (kN m)</th></tr></thead><tbody>${this.model.nodes.map((n,i)=>`<tr><td>${h(n.id)}</td><td>${n.x.toFixed(3)}</td><td>${n.y.toFixed(3)}</td><td><select data-support="${i}" aria-label="Apoyo ${h(n.id)}">${(['free','fixed','pinned','roller'] as const).map((s,j)=>`<option value="${s}" ${s===n.support?'selected':''}>${['Libre','Empotrado','Articulado','Rodillo vertical'][j]}</option>`).join('')}</select></td><td>${input(n.fx,i,'fx','node')}</td><td>${input(n.fy,i,'fy','node')}</td><td>${input(n.moment,i,'moment','node')}</td></tr>`).join('')}</tbody></table>`;
    else if(tab==='members')out.innerHTML=`<table class="schedule-table"><thead><tr><th>Elemento</th><th>Tramo / origen</th><th>Nudos</th><th>A (m²)</th><th>I (m⁴)</th><th>D adicional (kN/m)</th><th>L (kN/m)</th><th>Art. inicio</th><th>Art. fin</th></tr></thead><tbody>${this.model.members.map((m,i)=>`<tr><td><button data-focus="${h(m.sourceId)}">${h(m.mark)}</button></td><td>${h(m.id)} / ${m.sourceRange?m.sourceRange.map(t=>(t*100).toFixed(2)+'%').join(' - '):'Legado'}</td><td>${h(m.start)} / ${h(m.end)}</td><td>${m.area.toFixed(4)}</td><td>${m.inertia.toExponential(3)}</td><td>${input(m.dead,i,'dead','member')}</td><td>${input(m.live,i,'live','member')}</td><td><input type="checkbox" data-release="${i}" data-end="releaseStart" ${m.releaseStart?'checked':''} aria-label="Liberacion inicio ${h(m.mark)}" /></td><td><input type="checkbox" data-release="${i}" data-end="releaseEnd" ${m.releaseEnd?'checked':''} aria-label="Liberacion fin ${h(m.mark)}" /></td></tr>`).join('')}</tbody></table>`;
    else if(!this.result)out.innerHTML='<div class="schedule-empty">Sin resultados vigentes</div>';
    else out.innerHTML=`<table class="schedule-table"><thead><tr><th>Nudo</th><th>Uh (mm)</th><th>Uy (mm)</th><th>Giro (rad)</th><th>Rh (kN)</th><th>Ry (kN)</th><th>Rm (kN m)</th></tr></thead><tbody>${this.result.nodes.map(n=>`<tr><td>${n.id}</td><td>${(n.ux*1000).toFixed(4)}</td><td>${(n.uy*1000).toFixed(4)}</td><td>${n.rotation.toExponential(3)}</td><td>${n.rx.toFixed(3)}</td><td>${n.ry.toFixed(3)}</td><td>${n.rm.toFixed(3)}</td></tr>`).join('')}</tbody></table><table class="schedule-table"><thead><tr><th>Barra</th><th>|N|max (kN)</th><th>|V|max (kN)</th><th>|M|max (kN m)</th></tr></thead><tbody>${this.result.members.map(m=>`<tr><td>${h(this.model!.members.find(b=>b.id===m.id)!.mark)}</td><td>${Math.max(...m.axial.map(Math.abs)).toFixed(3)}</td><td>${Math.max(...m.shear.map(Math.abs)).toFixed(3)}</td><td>${Math.max(...m.moment.map(Math.abs)).toFixed(3)}</td></tr>`).join('')}</tbody></table>`;
    if(tab==='results'&&this.benchmark)out.insertAdjacentHTML('afterbegin',this.needsGeneration||this.model.revision!==BimDatabase.getInstance().revision?'<p class="benchmark-note">Modelo modificado. Referencia sin resultados vigentes.</p>':benchmarkComparison(this.benchmark,this.model,this.factors,this.result||undefined));
    if(tab==='members'){
      out.querySelector('thead tr')!.insertAdjacentHTML('beforeend','<th>Declaracion de D</th><th>Referencia D / L</th>');
      out.querySelectorAll('tbody tr').forEach((row,i)=>{
        const m=this.model!.members[i];row.insertAdjacentHTML('beforeend',`<td><select data-dead-mode="${i}" aria-label="Declaracion D ${h(m.id)}"><option value="additional" ${m.deadLoadMode!=='includes-self-weight'?'selected':''}>D adicional</option><option value="includes-self-weight" ${m.deadLoadMode==='includes-self-weight'?'selected':''}>D total, incluye PP</option></select></td><td><input data-load-reference="${i}" aria-label="Referencia cargas ${h(m.id)}" maxlength="2000" value="${h(m.loadReference??'')}" /></td>`);
      });
      out.querySelectorAll<HTMLSelectElement>('[data-dead-mode]').forEach(el=>el.onchange=()=>{this.model!.members[Number(el.dataset.deadMode)].deadLoadMode=el.value as DeadLoadMode;this.changed();});
      out.querySelectorAll<HTMLInputElement>('[data-load-reference]').forEach(el=>el.onchange=()=>{this.model!.members[Number(el.dataset.loadReference)].loadReference=el.value;this.changed();});
      out.querySelectorAll('thead th')[5].textContent='D manual (kN/m)';
    }
    out.querySelectorAll<HTMLInputElement>('[data-kind]').forEach(inp=>inp.onchange=()=>{const i=Number(inp.dataset.index),key=inp.dataset.key!;const target=inp.dataset.kind==='node'?this.model!.nodes[i]:this.model!.members[i];(target as unknown as Record<string,number>)[key]=inp.valueAsNumber;this.changed();});
    out.querySelectorAll<HTMLSelectElement>('[data-support]').forEach(el=>el.onchange=()=>{this.model!.nodes[Number(el.dataset.support)].support=el.value as Support;this.changed();});
    out.querySelectorAll<HTMLInputElement>('[data-release]').forEach(el=>el.onchange=()=>{this.model!.members[Number(el.dataset.release)][el.dataset.end as 'releaseStart'|'releaseEnd']=el.checked;this.changed();});
    out.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach(el=>el.onclick=()=>{this.close();this.select(el.dataset.focus!);});
  }
  private solve():void {
    if(!this.model||this.needsGeneration||this.pending||this.model.revision!==BimDatabase.getInstance().revision)return;
    try{validateAnalysis(this.model);if(!Object.values(this.factors).every(Number.isFinite))throw new Error('Factores no validos.');}
    catch(e){this.status((e as Error).message);return;}
    this.pending=true;this.buttons();this.status('Calculando...');
    const revision=this.model.revision;const worker=new Worker(new URL('../core/analysis/analysis.worker.ts',import.meta.url),{type:'module'});this.worker=worker;
    const finish=()=>{worker.terminate();this.worker=null;this.pending=false;this.buttons();};
    worker.onmessage=e=>{finish();if(revision!==BimDatabase.getInstance().revision)return;if(e.data.error){this.status(e.data.error);return;}this.result=e.data.result;this.stateVersion++;this.table('results');this.paint();this.buttons();this.status(`Equilibrio relativo: ${this.result!.residual.toExponential(2)} / revision ${revision}`);};
    worker.onerror=()=>{finish();this.status('No se pudo ejecutar el motor de analisis.');};worker.postMessage({model:this.model,factors:this.factors,caseName:this.caseName});
  }
  private paint():void {
    const canvas=this.overlay.querySelector<HTMLCanvasElement>('#analysis-canvas');if(!canvas)return;const c=canvas.getContext('2d')!;c.clearRect(0,0,720,420);if(!this.model?.nodes.length)return;
    const nodes=this.model.nodes,xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),scale=Math.min(600/Math.max(xmax-xmin,1),310/Math.max(ymax-ymin,1));
    const p=(x:number,y:number):[number,number]=>[60+(x-xmin)*scale,365-(y-ymin)*scale];
    this.model.members.forEach(m=>{const a=nodes.find(n=>n.id===m.start)!,b=nodes.find(n=>n.id===m.end)!;c.beginPath();c.moveTo(...p(a.x,a.y));c.lineTo(...p(b.x,b.y));c.lineWidth=2;c.strokeStyle='#56747a';c.stroke();});
    nodes.forEach(n=>{const [x,y]=p(n.x,n.y);c.fillStyle=n.support==='free'?'#fff':'#167253';c.strokeStyle='#167253';c.fillRect(x-4,y-4,8,8);c.strokeRect(x-4,y-4,8,8);c.fillStyle='#304850';c.font='11px Arial';c.fillText(n.id,x+7,y-7);});
    if(this.result){
      const max=Math.max(...this.result.members.flatMap(m=>[...m.deflectionX,...m.deflectionY].map(Math.abs)),1e-10);const factor=35/(max*scale);
      this.result.members.forEach(r=>{const m=this.model!.members.find(m=>m.id===r.id)!,a=nodes.find(n=>n.id===m.start)!,b=nodes.find(n=>n.id===m.end)!;c.beginPath();r.deflectionX.forEach((u,i)=>{const t=i/(r.deflectionX.length-1),pos=p(a.x+(b.x-a.x)*t+u*factor,a.y+(b.y-a.y)*t+r.deflectionY[i]*factor);i?c.lineTo(...pos):c.moveTo(...pos);});c.strokeStyle='#c14578';c.lineWidth=2;c.stroke();});
      c.fillStyle='#a33862';c.fillText(`Deformada x ${factor.toFixed(0)}`,20,24);
    }
    this.get('analysis-info').textContent=this.model.issues.slice(0,6).join(' ');
  }
}
