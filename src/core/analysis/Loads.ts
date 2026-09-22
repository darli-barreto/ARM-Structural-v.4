import type {AnalysisMember, AnalysisModel} from './Model';
import {compileSurfaceLoads} from './SurfaceLoads';

export interface LoadFactors {dead:number;live:number;nodal:number}
export const LOAD_ASSEMBLY_VERSION='frame-gravity-ledger-v2';
export type DeadLoadMode='additional'|'includes-self-weight';

export function validateLoadDeclaration(member:AnalysisMember,requireEvidence=true):void {
  if(member.deadLoadMode!==undefined&&!['additional','includes-self-weight'].includes(member.deadLoadMode))throw new Error('Modo de carga permanente no valido.');
  if(member.loadReference!==undefined&&(typeof member.loadReference!=='string'||member.loadReference.length>2000))throw new Error('Referencia de carga no valida (maximo 2000 caracteres).');
  if(![member.weight,member.dead,member.live].every(Number.isFinite)||member.weight<0)throw new Error('Peso propio o cargas no validos.');
  if(member.deadLoadMode==='includes-self-weight'){
    if(member.dead<0)throw new Error(`${member.id}: D total debe ser no negativo.`);
    if(requireEvidence&&!member.loadReference?.trim())throw new Error(`${member.id}: D total incluye peso propio; falta referencia de sustento.`);
  }
}

export function activeSelfWeight(member:AnalysisMember):number {
  return member.deadLoadMode==='includes-self-weight'?0:member.weight;
}

export function memberLineLoad(member:AnalysisMember,factors:LoadFactors):number {
  return (activeSelfWeight(member)+member.dead)*factors.dead+member.live*factors.live;
}

export function frameInputSignature(model:AnalysisModel,factors:LoadFactors):string {
  return JSON.stringify({version:LOAD_ASSEMBLY_VERSION,revision:model.revision,plane:model.plane,ordinate:model.ordinate,
    nodes:model.nodes,members:model.members,surfaceLoads:model.surfaceLoads??[],factors});
}

/** The solver, diagrams and ledger share this global-Y load convention. */
export function assembleFrameLoads(model:AnalysisModel,factors:LoadFactors,requireEvidence=true){
  if(![factors.dead,factors.live,factors.nodal].every(Number.isFinite))throw new Error('Factores no validos.');
  const surfaces=compileSurfaceLoads(model,requireEvidence);
  const nodeMap=new Map(model.nodes.map(n=>[n.id,n]));
  if(nodeMap.size!==model.nodes.length)throw new Error('Nudos duplicados en el balance.');
  const totals={selfWeight:0,excludedSelfWeight:0,manualDead:0,manualLive:0,surfaceDead:0,surfaceLive:0,fx:0,fy:0,moment:0};
  const nodes=model.nodes.map(n=>{
    if(![n.x,n.y,n.fx,n.fy,n.moment].every(Number.isFinite))throw new Error('Carga nodal no valida.');
    const fx=n.fx*factors.nodal,fy=n.fy*factors.nodal,moment=n.moment*factors.nodal;
    totals.fx+=fx;totals.fy+=fy;totals.moment+=moment+n.y*fx-n.x*fy;
    return {id:n.id,fx,fy,moment};
  });
  const ids=new Set<string>();
  const members=model.members.map(m=>{
    if(ids.has(m.id))throw new Error('Tramos duplicados en el balance.');ids.add(m.id);
    validateLoadDeclaration(m,requireEvidence);
    const a=nodeMap.get(m.start),b=nodeMap.get(m.end);
    if(!a||!b)throw new Error('Extremo de carga sin nudo.');
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(!Number.isFinite(length)||length<.001)throw new Error('Longitud de carga no valida.');
    const selfWeight=activeSelfWeight(m)*length,excludedSelfWeight=(m.weight-activeSelfWeight(m))*length;
    const surface=surfaces.contributions.get(m.id)??{dead:0,live:0};
    const surfaceDead=surface.dead*length,surfaceLive=surface.live*length;
    const manualDead=m.dead*length,manualLive=m.live*length,lineLoad=memberLineLoad(m,factors)+surface.dead*factors.dead+surface.live*factors.live,downward=lineLoad*length;
    totals.selfWeight+=selfWeight;totals.excludedSelfWeight+=excludedSelfWeight;
    totals.manualDead+=manualDead;totals.manualLive+=manualLive;
    totals.surfaceDead+=surfaceDead;totals.surfaceLive+=surfaceLive;
    totals.fy-=downward;totals.moment+=downward*(a.x+b.x)/2;
    return {id:m.id,sourceId:m.sourceId,length,selfWeight,excludedSelfWeight,manualDead,manualLive,surfaceDead,surfaceLive,lineLoad,downward,
      deadLoadMode:m.deadLoadMode??'additional',reference:m.loadReference??'',sourceRange:m.sourceRange};
  });
  if(!Object.values(totals).every(Number.isFinite)||members.some(m=>![m.length,m.lineLoad,m.downward].every(Number.isFinite)))throw new Error('El balance de cargas produjo valores no finitos.');
  return {version:LOAD_ASSEMBLY_VERSION,nodes,members,totals,surfaces:surfaces.rows};
}
