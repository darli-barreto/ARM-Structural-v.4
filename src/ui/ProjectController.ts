import { ProjectDocument, parseProject, projectCache } from '../core/model/Project';
import { BimDatabase } from '../core/database/BimDatabase';
import { LevelSystem } from '../core/LevelSystem';
import { GridSystem } from '../core/GridSystem';
import { StructuralManager } from '../tools/StructuralManager';
import { WasmBridge } from '../kernel/WasmBridge';
import { buildElementGeometry } from '../tools/structural/ElementGeometry';
import { download, icon } from './shared';
import type { AnalysisSetup } from '../core/analysis/Model';
import { defaultNormativeProfile, updateNormativeProfile } from '../core/normative/Profile';
import { NormativePanel } from './NormativePanel';

export class ProjectController {
  private id:string=crypto.randomUUID();private toolbar=document.createElement('div');private restoring=false;
  private timer:ReturnType<typeof setTimeout>|undefined;private lastContent='';private queue=Promise.resolve();
  private saveRequest=0;
  private normative=defaultNormativeProfile();
  constructor(private structural:StructuralManager,private levels:LevelSystem,private grids:GridSystem,private wasm:WasmBridge,private afterRestore:()=>void,private analyze:()=>void,private getAnalysis:()=>AnalysisSetup|undefined,private restoreAnalysis:(setup?:AnalysisSetup)=>void) {
    this.toolbar.className='project-tools';this.toolbar.innerHTML=`<span id="project-save-status" role="status">Proyecto local</span><button id="project-save" title="Guardar proyecto">${icon('Save')}<b class="tool-label">Guardar</b></button><button id="project-open" title="Abrir proyecto">${icon('Upload')}<b class="tool-label">Abrir</b></button><button id="project-analysis" title="Modelo analitico">${icon('Calculator')}<b class="tool-label">Analisis</b></button><input id="project-file" type="file" accept=".json,.arm" hidden />`;
    document.querySelector('.ribbon-tabs-bar')!.append(this.toolbar);
    const normativePanel=new NormativePanel(()=>this.normative,profile=>{
      this.normative=updateNormativeProfile(this.normative,profile);this.scheduleSave();
    },()=>({projectId:this.id,modelRevision:BimDatabase.getInstance().revision}));
    const normativeButton=document.createElement('button');normativeButton.id='project-normative';normativeButton.title='Perfil normativo';normativeButton.setAttribute('aria-label','Perfil normativo');normativeButton.innerHTML=`${icon('FileText')}<b class="tool-label">Normativa</b>`;
    normativeButton.onclick=()=>normativePanel.open();this.toolbar.append(normativeButton);
    const sidebarToggle=document.createElement('button');sidebarToggle.id='project-sidebar';sidebarToggle.title='Propiedades y navegador';sidebarToggle.setAttribute('aria-label',sidebarToggle.title);sidebarToggle.setAttribute('aria-controls','app-sidebar');sidebarToggle.setAttribute('aria-expanded','false');sidebarToggle.innerHTML=icon('PanelLeft');this.toolbar.prepend(sidebarToggle);
    const closeSidebar=()=>{document.getElementById('app-sidebar')!.classList.remove('mobile-open');sidebarToggle.setAttribute('aria-expanded','false');};
    sidebarToggle.onclick=()=>{const open=document.getElementById('app-sidebar')!.classList.toggle('mobile-open');sidebarToggle.setAttribute('aria-expanded',String(open));};
    document.getElementById('app-workspace')!.addEventListener('pointerdown',closeSidebar);
    window.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
    this.toolbar.querySelector<HTMLButtonElement>('#project-save')!.onclick=()=>{try{download(JSON.stringify(this.snapshot(),null,2),'proyecto.arm.json');this.save();}catch(e){this.status((e as Error).message);}};
    const input=this.toolbar.querySelector<HTMLInputElement>('#project-file')!;
    this.toolbar.querySelector<HTMLButtonElement>('#project-open')!.onclick=()=>input.click();
    input.onchange=async()=>{const file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>50_000_000)throw new Error('Archivo mayor a 50 MB.');const p=parseProject(JSON.parse(await file.text()));if(!confirm(`Abrir proyecto con ${p.elements.length} elementos y reemplazar el modelo actual?`))return;this.restore(p);await this.save();}catch(e){this.status((e as Error).message);alert((e as Error).message);}};
    this.toolbar.querySelector<HTMLButtonElement>('#project-analysis')!.onclick=()=>this.analyze();
    BimDatabase.getInstance().subscribe(()=>this.scheduleSave());
    document.addEventListener('change',()=>this.scheduleSave(),true);
    document.addEventListener('click',()=>this.scheduleSave(),true);
    window.addEventListener('pointerup',()=>this.scheduleSave());window.addEventListener('keyup',()=>this.scheduleSave());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.save();});
  }
  public async init():Promise<void>{try{const p=await projectCache('read');if(p){this.restore(parseProject(p));this.status('Proyecto recuperado');}}catch(e){this.status('No se pudo recuperar: '+(e as Error).message);}}
  public async loadExample(project:ProjectDocument):Promise<boolean>{
    const parsed=parseProject(project);
    if(BimDatabase.getInstance().getAllElements().length && !confirm('Cargar el ejemplo y reemplazar el proyecto actual? Exporta el proyecto primero si deseas conservarlo.'))return false;
    this.restore(parsed);await this.save();return true;
  }
  private status(message:string):void{this.toolbar.querySelector('#project-save-status')!.textContent=message;}
  private scheduleSave():void{if(this.restoring)return;this.saveRequest++;this.status('Cambios pendientes');clearTimeout(this.timer);this.timer=setTimeout(()=>void this.save(),800);}
  private snapshot():ProjectDocument{
    const db=BimDatabase.getInstance();const levels=this.levels.getLevels();
    db.reconcileLevels(levels);
    const elements=structuredClone(db.getAllElements());
    elements.forEach(d=>{const level=levels.find(l=>l.id===d.levelId)||levels.find(l=>l.name===d.levelName);if(level){d.levelId=level.id;d.levelName=level.name;d.instanceParameters.baseLevel=level.name;}});
    return parseProject({format:'arm-project',schemaVersion:1,projectId:this.id,savedAt:new Date().toISOString(),units:{length:'m',force:'kN',stress:'MPa',concreteStrength:'kgf/cm2'},code:'RNE-PE',elements,levels:structuredClone(levels),grids:structuredClone(this.grids.elements),analysis:this.getAnalysis(),normative:this.normative});
  }
  private async save():Promise<void>{
    if(this.restoring)return;
    try{const p=this.snapshot(),request=this.saveRequest,content=JSON.stringify({...p,savedAt:''});if(content===this.lastContent){this.status('Guardado local');return;}
      this.queue=this.queue.catch(()=>{}).then(async()=>{await projectCache('write',p);this.lastContent=content;if(request===this.saveRequest)this.status('Guardado local');});await this.queue;
    }catch(e){this.status('Sin guardar: '+(e as Error).message);}
  }
  private restore(p:ProjectDocument):void {
    // Build every mesh before replacing the active project, so invalid geometry leaves it intact.
    const prepared=p.elements.map(d=>({doc:d,geometry:buildElementGeometry(this.wasm,d.geometry.definition!)}));
    this.restoring=true;this.saveRequest++;clearTimeout(this.timer);
    try{
      this.structural.clear();this.id=p.projectId;this.normative=structuredClone(p.normative??defaultNormativeProfile());
      this.levels.state.elements=structuredClone(p.levels);this.levels.state.syncWithGlobalConfig();this.levels.rebuildMeshes();
      this.grids.elements=structuredClone(p.grids);this.grids.restoreAxes();this.grids.rebuildSystem();
      const db=BimDatabase.getInstance();db.restoreElements(p.elements);
      prepared.forEach(({doc,geometry})=>{
        const d=db.getByGuid(doc.uniqueId)!;const base=this.structural.factory.create(geometry,d.geometry.definition!.type,this.structural.currentStyle);
        const el={...base,id:`${d.geometry.definition!.type}-${d.elementId}`,elementId:d.elementId,uniqueId:d.uniqueId,bimDoc:d,type:d.geometry.definition!.type,volume:d.instanceParameters.volume,levelName:d.levelName,dimensions:d.geometry.dimensionsString,definition:structuredClone(d.geometry.definition!)};
        base.mesh.userData={id:el.id,elementId:el.elementId,uniqueId:el.uniqueId,type:el.type,bimDoc:d};this.structural.restoreElement(el);
      });
      this.afterRestore();this.structural.updateMetrics();this.lastContent='';this.restoreAnalysis(p.analysis);
    }finally{this.restoring=false;}
  }
}
