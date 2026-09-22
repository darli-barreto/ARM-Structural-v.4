import type { BimElementDocument } from '../database/BimDatabaseTypes';
import type { GridElement } from '../../config/structural.config';
import type { Level } from '../level/types/LevelTypes';
import { validateDefinition } from './Geometry';
import { validateRebarSpec } from './Reinforcement';
import type { AnalysisSetup } from '../analysis/Model';
import { defaultNormativeProfile, parseNormativeProfile, type NormativeProfile } from '../normative/Profile';
import {validateLoadDeclaration} from '../analysis/Loads';
import {compileSurfaceLoads} from '../analysis/SurfaceLoads';
export interface ProjectDocument {
  format:'arm-project'; schemaVersion:1; projectId:string; savedAt:string;
  units:{length:'m';force:'kN';stress:'MPa';concreteStrength?:'kgf/cm2'};
  code:'RNE-PE'; elements:BimElementDocument[];levels:Level[];grids:GridElement[];
  analysis?:AnalysisSetup;
  normative?:NormativeProfile;
}
export function parseProject(value:unknown):ProjectDocument {
  const p=value as ProjectDocument;
  if(!p||p.format!=='arm-project'||p.schemaVersion!==1)throw new Error('Formato o version de proyecto no compatible.');
  if(p.units?.length!=='m'||p.units.force!=='kN'||p.units.stress!=='MPa')throw new Error('Unidades de proyecto no compatibles.');
  if(!Array.isArray(p.elements)||!Array.isArray(p.levels)||!Array.isArray(p.grids))throw new Error('Proyecto incompleto.');
  if(p.elements.length>100000)throw new Error('El proyecto supera el limite de 100000 elementos.');
  const ids=new Set<string>(),numbers=new Set<number>();
  const name=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=500;
  const coords=(v:{x:number;z:number})=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z);
  const levelIds=new Set<string>();
  p.levels.forEach(l=>{if(!name(l.id)||levelIds.has(l.id)||!name(l.name)||!Number.isFinite(l.elevation)||!coords(l.start)||!coords(l.end))throw new Error('Nivel no valido.');levelIds.add(l.id);});
  const gridIds=new Set<string>();
  p.grids.forEach(g=>{if(!name(g.id)||gridIds.has(g.id)||!name(g.name)||!coords(g.start)||!coords(g.end)||!['line','arc'].includes(g.geomType))throw new Error('Rejilla no valida.');if(g.geomType==='arc'&&(!coords(g.center!)||!Number.isFinite(g.radius)||g.radius!<=0||!Number.isFinite(g.startAngle)||!Number.isFinite(g.endAngle)))throw new Error('Arco no valido.');gridIds.add(g.id);});
  const categories={beam:'OST_StructuralFraming',column:'OST_StructuralColumns',slab:'OST_Floors',footing:'OST_StructuralFoundation'};
  p.elements.forEach(d=>{
    if(!name(d.uniqueId)||ids.has(d.uniqueId)||!Number.isSafeInteger(d.elementId)||d.elementId<=0||numbers.has(d.elementId))throw new Error('IDs de elemento no validos o duplicados.');
    if(!d.geometry?.definition)throw new Error('Falta la geometria parametrica.');validateDefinition(d.geometry.definition);
    if(d.reinforcement)validateRebarSpec(d.reinforcement);
    if(d.category!==categories[d.geometry.definition.type])throw new Error('Categoria incompatible con la geometria.');
    if(!name(d.levelName)||!name(d.typeId)||!name(d.familyType)||!name(d.categoryName)||!name(d.instanceParameters?.mark)||!name(d.instanceParameters?.sector)||!Number.isFinite(d.typeParameters?.unitCost)||d.typeParameters.unitCost<0||!Number.isFinite(d.instanceParameters.concreteStrength)||d.instanceParameters.concreteStrength<=0||!Number.isFinite(d.metadata?.version))throw new Error('Propiedades de elemento no validas.');
    ids.add(d.uniqueId);numbers.add(d.elementId);
  });
  if(p.analysis){
    if(p.analysis.requiresRegeneration!==undefined&&typeof p.analysis.requiresRegeneration!=='boolean')throw new Error('Estado de regeneracion no valido.');
    if(p.analysis.benchmark!==undefined&&!['cantilever','supported'].includes(p.analysis.benchmark))throw new Error('Referencia analitica no compatible.');
    const {model,factors,caseName}=p.analysis;
    if(!model||!Array.isArray(model.nodes)||!Array.isArray(model.members)||model.nodes.length>500||!factors||![factors.dead,factors.live,factors.nodal].every(Number.isFinite)||typeof caseName!=='string')throw new Error('Configuracion analitica no valida.');
    const nodeIds=new Set(model.nodes.map(n=>n.id));
    if(nodeIds.size!==model.nodes.length)throw new Error('Nudos analiticos duplicados.');
    model.nodes.forEach(n=>{if(!name(n.id)||![n.x,n.y,n.fx,n.fy,n.moment].every(Number.isFinite)||!['free','fixed','pinned','roller'].includes(n.support))throw new Error('Nudo analitico no valido.');});
    model.members.forEach(m=>{if(!name(m.sourceId)||(!ids.has(m.sourceId)&&!p.analysis!.requiresRegeneration)||!nodeIds.has(m.start)||!nodeIds.has(m.end)||![m.area,m.inertia,m.height,m.elasticModulusMPa,m.poisson,m.weight,m.dead,m.live].every(Number.isFinite))throw new Error('Barra analitica no valida.');});
    if(!Array.isArray(model.issues)||model.issues.some(v=>typeof v!=='string')||!['XY','ZY'].includes(model.plane)||!Number.isFinite(model.ordinate)||!Number.isFinite(model.tolerance))throw new Error('Plano analitico no valido.');
    if(model.geometryVersion!==undefined&&typeof model.geometryVersion!=='string')throw new Error('Version geometrica no valida.');
    model.members.forEach(m=>{
      validateLoadDeclaration(m,false);
      if(m.sourceRange!==undefined&&(!Array.isArray(m.sourceRange)||m.sourceRange.length!==2||!m.sourceRange.every(Number.isFinite)||m.sourceRange[0]<0||m.sourceRange[1]>1||m.sourceRange[0]>=m.sourceRange[1]))throw new Error('Rango de tramo no valido.');
    });
    model.nodes.forEach(n=>{
      if(n.axisReferences!==undefined&&(!Array.isArray(n.axisReferences)||n.axisReferences.some(r=>!r||typeof r.sourceId!=='string'||!Number.isFinite(r.parameter)||r.parameter<0||r.parameter>1||!Number.isFinite(r.adjustment)||r.adjustment<0)))throw new Error('Referencia de eje no valida.');
    });
    compileSurfaceLoads(model,false);
  }
  const normative=p.normative===undefined?defaultNormativeProfile():parseNormativeProfile(p.normative);
  return {...structuredClone(p),normative};
}

export async function projectCache(action:'read'|'write',project?:ProjectDocument):Promise<ProjectDocument|undefined> {
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('arm-projects',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('projects',action==='read'?'readonly':'readwrite');const store=tx.objectStore('projects');
    const request=action==='read'?store.get('active'):store.put(project,'active');let result:ProjectDocument|undefined;
    request.onsuccess=()=>{result=action==='read'?request.result:project;};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
