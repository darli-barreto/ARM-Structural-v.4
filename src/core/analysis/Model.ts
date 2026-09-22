import type { BimElementDocument } from '../database/BimDatabaseTypes';
import { ANALYTICAL_GEOMETRY_VERSION, analyticalGraph, type AxisReference } from './AnalyticalGraph';
import { frameDocuments } from './FrameView';
import {validateLoadDeclaration,type DeadLoadMode} from './Loads';
import {compileSurfaceLoads,matchesSurfaceGeometry,type SurfaceLoad} from './SurfaceLoads';
export type Support='free'|'fixed'|'pinned'|'roller';
export interface AnalysisSetup {model:AnalysisModel;factors:{dead:number;live:number;nodal:number};caseName:string;benchmark?:import('./Benchmarks').BenchmarkId;requiresRegeneration?:boolean}
export interface AnalysisNode {id:string;x:number;y:number;support:Support;fx:number;fy:number;moment:number;axisReferences?:AxisReference[]}
export interface AnalysisMember {id:string;sourceId:string;mark:string;start:string;end:string;area:number;inertia:number;height:number;elasticModulusMPa:number;poisson:number;weight:number;dead:number;live:number;releaseStart:boolean;releaseEnd:boolean;sourceRange?:[number,number];deadLoadMode?:DeadLoadMode;loadReference?:string}
export interface AnalysisModel {revision:number;plane:'XY'|'ZY';ordinate:number;tolerance:number;nodes:AnalysisNode[];members:AnalysisMember[];issues:string[];omitted:number;sourceVersions:Record<string,number>;geometryVersion?:string;surfaceLoads?:SurfaceLoad[]}
export interface AnalysisOptions {plane:'XY'|'ZY';ordinate:number;tolerance:number;elasticModulusMPa:number;unitWeight:number}
export interface AnalysisResult {revision:number;caseName:string;nodes:{id:string;ux:number;uy:number;rotation:number;rx:number;ry:number;rm:number}[];members:{id:string;sourceId:string;endForces:number[];stations:number[];axial:number[];shear:number[];moment:number[];deflectionX:number[];deflectionY:number[]}[];residual:number;engine:string;inputSignature?:string}

export function deriveAnalysis(documents:BimElementDocument[],revision:number,options:AnalysisOptions):AnalysisModel {
  if(!['XY','ZY'].includes(options.plane)||!Number.isFinite(options.ordinate))throw new Error('Plano analitico no valido.');
  if(!Number.isFinite(options.elasticModulusMPa)||options.elasticModulusMPa<=0||!Number.isFinite(options.unitWeight)||options.unitWeight<0)throw new Error('Material no valido.');
  const filtered=frameDocuments(documents,options),graph=analyticalGraph(filtered,options.tolerance);
  if(graph.collapsed.length)throw new Error('Tramos colapsados por tolerancia. Reducir la union de nudos; no se omiten barras del calculo.');
  const result:AnalysisModel={revision,plane:options.plane,ordinate:options.ordinate,tolerance:options.tolerance,
    geometryVersion:ANALYTICAL_GEOMETRY_VERSION,nodes:graph.nodes.map(n=>({id:n.id,x:options.plane==='XY'?n.point.x:n.point.z,y:n.point.y,support:'free',fx:0,fy:0,moment:0,axisReferences:n.references})),
    members:[],issues:[...graph.issues,'Ejes centroidales compartidos con la vista. Cruces dentro de tolerancia unidos sin liberaciones automaticas; revisar conexiones. Sin brazos rigidos ni diafragmas.'],omitted:documents.length-filtered.length,sourceVersions:{}};
  const sources=new Map(filtered.map(doc=>[doc.uniqueId,doc]));
  for(const segment of graph.members){
    const doc=sources.get(segment.sourceId)!,d=doc.geometry.definition;
    if(d.type!=='beam'&&d.type!=='column')continue;
    const area=d.width*(d.type==='beam'?d.height:d.depth);
    const height=d.type==='beam'?d.height:options.plane==='XY'?d.width:d.depth;
    result.members.push({...segment,mark:doc.instanceParameters.mark,area,inertia:area*height*height/12,height,elasticModulusMPa:options.elasticModulusMPa,poisson:0.2,weight:area*options.unitWeight,dead:0,live:0,releaseStart:false,releaseEnd:false});
    result.sourceVersions[doc.uniqueId]=doc.metadata.version;
  }
  return result;
}

/** Imported loads/supports remain intact; only matching geometry can be treated as current. */
export function matchesAnalyticalGeometry(model:AnalysisModel,documents:BimElementDocument[]):boolean {
  if(model.geometryVersion!==ANALYTICAL_GEOMETRY_VERSION)return false;
  try{
    if(!matchesSurfaceGeometry(model,documents))return false;
    const expected=deriveAnalysis(documents,model.revision,{plane:model.plane,ordinate:model.ordinate,tolerance:model.tolerance,elasticModulusMPa:1,unitWeight:0});
    if(expected.nodes.length!==model.nodes.length||expected.members.length!==model.members.length)return false;
    const nodes=new Map(model.nodes.map(n=>[n.id,n])),members=new Map(model.members.map(m=>[m.id,m]));
    if(nodes.size!==model.nodes.length||members.size!==model.members.length)return false;
    return expected.nodes.every(n=>{const old=nodes.get(n.id);return old&&Math.hypot(n.x-old.x,n.y-old.y)<1e-9&&JSON.stringify(n.axisReferences)===JSON.stringify(old.axisReferences);})&&expected.members.every(m=>{
      const old=members.get(m.id);return old&&old.sourceId===m.sourceId&&old.start===m.start&&old.end===m.end&&
        old.area===m.area&&old.inertia===m.inertia&&old.height===m.height&&JSON.stringify(old.sourceRange)===JSON.stringify(m.sourceRange)&&model.sourceVersions[m.sourceId]===expected.sourceVersions[m.sourceId];
    });
  }catch{return false;}
}

export function validateAnalysis(model:AnalysisModel):void {
  compileSurfaceLoads(model);
  if(!model.members.length)throw new Error('No hay barras en el plano seleccionado.');
  if(model.nodes.length>500)throw new Error('El analisis 2D admite hasta 500 nudos por plano.');
  const ids=new Set<string>();const nodes=new Map(model.nodes.map(n=>[n.id,n]));const connected=new Map<string,Set<string>>();
  model.nodes.forEach(n=>{if(ids.has(n.id)||![n.x,n.y,n.fx,n.fy,n.moment].every(Number.isFinite)||!['free','fixed','pinned','roller'].includes(n.support))throw new Error('Nudos no validos.');ids.add(n.id);connected.set(n.id,new Set());});
  const pairs=new Set<string>(),memberIds=new Set<string>();
  model.members.forEach(m=>{
    validateLoadDeclaration(m);
    if(memberIds.has(m.id))throw new Error('IDs de barras duplicados.');memberIds.add(m.id);
    const a=nodes.get(m.start),b=nodes.get(m.end);if(!a||!b||m.start===m.end)throw new Error('Conectividad no valida.');
    const key=[m.start,m.end].sort().join(':');if(pairs.has(key))throw new Error('Existen barras duplicadas.');pairs.add(key);
    if(![m.area,m.inertia,m.height,m.elasticModulusMPa].every(v=>Number.isFinite(v)&&v>0)||![m.weight,m.dead,m.live,m.poisson].every(Number.isFinite)||m.poisson<=-1||m.poisson>=.5)throw new Error('Seccion, material o carga no validos.');
    connected.get(m.start)!.add(m.end);connected.get(m.end)!.add(m.start);
    const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
    if(l2<1e-6)throw new Error('Barra menor que 1 mm.');
    model.nodes.forEach(n=>{if(n.id===a.id||n.id===b.id)return;const t=((n.x-a.x)*dx+(n.y-a.y)*dy)/l2;if(t>1e-6&&t<1-1e-6&&Math.hypot(n.x-a.x-t*dx,n.y-a.y-t*dy)<1e-5)throw new Error(`El nudo ${n.id} cae dentro de ${m.mark}; dividir la barra antes de analizar.`);});
  });
  const visited=new Set<string>();
  model.nodes.forEach(n=>{
    if(visited.has(n.id))return;const queue=[n.id];let restrained=0;
    while(queue.length){const id=queue.pop()!;if(visited.has(id))continue;visited.add(id);const node=nodes.get(id)!;restrained+=node.support==='fixed'?3:node.support==='pinned'?2:node.support==='roller'?1:0;connected.get(id)!.forEach(id=>queue.push(id));}
    if(restrained<3)throw new Error(`Componente de ${n.id} sin restricciones suficientes. Revisar conexiones y apoyos.`);
  });
}
