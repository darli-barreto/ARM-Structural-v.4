import { ProjectDocument, parseProject, projectCache } from '../../core/model/Project';
import { BimDatabase } from '../../core/database/BimDatabase';
import { LevelSystem } from '../../core/LevelSystem';
import { GridSystem } from '../../core/GridSystem';
import { StructuralManager } from '../../tools/StructuralManager';
import { WasmBridge } from '../../kernel/WasmBridge';
import { buildElementGeometry } from '../../tools/structural/ElementGeometry';
import { download } from '../../shared/ui/dom';
import type { AnalysisSetup } from '../../core/analysis/Model';
import { defaultNormativeProfile, updateNormativeProfile } from '../../core/normative/Profile';
import { PROJECT_ACTION_EVENT, PROJECT_FILE_EVENT, type ProjectAction } from './ProjectToolsBridge';
import { projectToolsStore } from './ProjectToolsStore';
import { normativePanelStore } from '../normative/NormativePanelStore';

export class ProjectController {
  private id:string=crypto.randomUUID();private restoring=false;
  private timer:ReturnType<typeof setTimeout>|undefined;private lastContent='';private queue=Promise.resolve();
  private unsubscribeDatabase: (() => void) | null = null;
  private saveRequest=0;
  private normative=defaultNormativeProfile();
  private onPersistableEvent=():void=>this.scheduleSave();
  private onVisibilityChange=():void=>{if(document.hidden)void this.save();};
  private onProjectAction=(event:Event):void=>{
    const action=(event as CustomEvent<ProjectAction>).detail;
    if(action==='save'){
      try{download(JSON.stringify(this.snapshot(),null,2),'proyecto.arm.json');void this.save();}
      catch(e){this.status((e as Error).message);}
    }else if(action==='analysis')this.analyze();
    else if(action==='normative')this.openNormativePanel();
  };
  private onProjectFile=(event:Event):void=>{void this.restoreFile((event as CustomEvent<File>).detail);};
  constructor(private structural:StructuralManager,private levels:LevelSystem,private grids:GridSystem,private wasm:WasmBridge,private afterRestore:()=>void,private analyze:()=>void,private getAnalysis:()=>AnalysisSetup|undefined,private restoreAnalysis:(setup?:AnalysisSetup)=>void) {
    projectToolsStore.setReady(false);
    projectToolsStore.setStatus('Proyecto local');
    window.addEventListener(PROJECT_ACTION_EVENT,this.onProjectAction);
    window.addEventListener(PROJECT_FILE_EVENT,this.onProjectFile);
    this.unsubscribeDatabase = BimDatabase.getInstance().subscribe(this.onPersistableEvent);
    document.addEventListener('change',this.onPersistableEvent,true);
    document.addEventListener('click',this.onPersistableEvent,true);
    window.addEventListener('pointerup',this.onPersistableEvent);
    window.addEventListener('keyup',this.onPersistableEvent);
    document.addEventListener('visibilitychange',this.onVisibilityChange);
  }
  public dispose():void{
    if(this.timer)clearTimeout(this.timer);
    this.timer=undefined;
    this.unsubscribeDatabase?.();
    this.unsubscribeDatabase=null;
    window.removeEventListener(PROJECT_ACTION_EVENT,this.onProjectAction);
    window.removeEventListener(PROJECT_FILE_EVENT,this.onProjectFile);
    window.removeEventListener('pointerup',this.onPersistableEvent);
    window.removeEventListener('keyup',this.onPersistableEvent);
    document.removeEventListener('change',this.onPersistableEvent,true);
    document.removeEventListener('click',this.onPersistableEvent,true);
    document.removeEventListener('visibilitychange',this.onVisibilityChange);
    projectToolsStore.setReady(false);
  }
  public async init():Promise<void>{try{const p=await projectCache('read');if(p){this.restore(parseProject(p));this.status('Proyecto recuperado');}}catch(e){this.status('No se pudo recuperar: '+(e as Error).message);}finally{projectToolsStore.setReady(true);}}
  public async loadExample(project:ProjectDocument):Promise<boolean>{
    const parsed=parseProject(project);
    if(BimDatabase.getInstance().getAllElements().length && !confirm('Cargar el ejemplo y reemplazar el proyecto actual? Exporta el proyecto primero si deseas conservarlo.'))return false;
    this.restore(parsed);await this.save();return true;
  }
  private status(message:string):void{projectToolsStore.setStatus(message);}
  private openNormativePanel():void{
    normativePanelStore.open(this.normative,{projectId:this.id,modelRevision:BimDatabase.getInstance().revision},profile=>{
      this.normative=updateNormativeProfile(this.normative,profile);this.scheduleSave();return this.normative;
    },()=>({projectId:this.id,modelRevision:BimDatabase.getInstance().revision}));
  }
  private async restoreFile(file:File):Promise<void>{
    try{
      if(file.size>50_000_000)throw new Error('Archivo mayor a 50 MB.');
      const project=parseProject(JSON.parse(await file.text()));
      if(!confirm(`Abrir proyecto con ${project.elements.length} elementos y reemplazar el modelo actual?`))return;
      this.restore(project);await this.save();
    }catch(e){const message=(e as Error).message;this.status(message);alert(message);}
  }
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
