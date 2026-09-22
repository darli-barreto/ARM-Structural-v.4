import type {BimElementDocument} from '../database/BimDatabaseTypes';
import {quantities} from '../model/Geometry';
import type {AnalysisModel} from './Model';

export interface SurfaceLoad {
  sourceId:string;sourceVersion:number;geometrySignature:string;
  area:number;thickness:number;unitWeight:number;additionalDead:number;live:number;
  reference:string;method:'declared-uniform';
  allocations:{receiverId:string;fraction:number}[];
  outsideFraction:number;outsideReference:string;
}

export function surfaceSnapshot(doc:BimElementDocument){
  const d=doc.geometry.definition;
  if(d.type!=='slab')throw new Error('La fuente superficial debe ser una losa.');
  return {sourceId:doc.uniqueId,sourceVersion:doc.metadata.version,geometrySignature:JSON.stringify(d),
    area:quantities(d).volume/d.thickness,thickness:d.thickness};
}

export function matchesSurfaceGeometry(model:AnalysisModel,documents:BimElementDocument[]):boolean {
  const docs=new Map(documents.map(d=>[d.uniqueId,d]));
  return (model.surfaceLoads??[]).every(s=>{
    const doc=docs.get(s.sourceId);if(!doc||doc.geometry.definition.type!=='slab')return false;
    const expected=surfaceSnapshot(doc);
    return expected.sourceVersion===s.sourceVersion&&expected.geometrySignature===s.geometrySignature&&
      Math.abs(expected.area-s.area)<1e-9&&expected.thickness===s.thickness&&s.allocations.every(a=>docs.get(a.receiverId)?.geometry.definition.type==='beam');
  });
}

/** Fractions are engineering declarations, not inferred tributary areas or shell reactions. */
export function compileSurfaceLoads(model:AnalysisModel,requireComplete=true){
  const sources=model.surfaceLoads??[];
  if(!Array.isArray(sources)||sources.length>100000)throw new Error('Fuentes superficiales no validas.');
  const ids=new Set<string>(),nodes=new Map(model.nodes.map(n=>[n.id,n]));
  const contributions=new Map<string,{dead:number;live:number}>();
  const rows=sources.map(s=>{
    const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
    if(!s||!text(s.sourceId,500)||!s.sourceId||ids.has(s.sourceId)||s.method!=='declared-uniform'||
      !Number.isFinite(s.sourceVersion)||!text(s.geometrySignature,2000000)||!s.geometrySignature||
      ![s.area,s.thickness].every(v=>Number.isFinite(v)&&v>0)||
      ![s.unitWeight,s.additionalDead,s.live,s.outsideFraction].every(v=>Number.isFinite(v)&&v>=0)||
      !text(s.reference,2000)||!text(s.outsideReference,2000)||!Array.isArray(s.allocations)||s.allocations.length>model.members.length)
      throw new Error('Fuente superficial no valida o duplicada.');
    ids.add(s.sourceId);
    const receivers=new Set<string>();
    let fraction=0;
    const dead=s.area*(s.thickness*s.unitWeight+s.additionalDead),live=s.area*s.live;
    const allocations=s.allocations.map(a=>{
      if(!a||!text(a.receiverId,500)||!a.receiverId||receivers.has(a.receiverId)||!Number.isFinite(a.fraction)||a.fraction<=0||a.fraction>1)
        throw new Error('Receptor duplicado o fraccion superficial no valida.');
      receivers.add(a.receiverId);fraction+=a.fraction;
      const members=model.members.filter(m=>m.sourceId===a.receiverId);
      if(!members.length)throw new Error('La viga receptora no pertenece al portico.');
      const lengths=members.map(m=>{
        const n=nodes.get(m.start),end=nodes.get(m.end);
        if(!n||!end||Math.abs(n.y-end.y)>1e-6||Math.abs(n.x-end.x)<.001)throw new Error('El reparto uniforme admite solo vigas horizontales.');
        if(requireComplete&&(m.dead!==0||m.live!==0||m.deadLoadMode==='includes-self-weight'))throw new Error(`${m.mark}: conciliar las cargas manuales D/L y usar D adicional antes de transferir losas.`);
        return Math.abs(end.x-n.x);
      });
      const length=lengths.reduce((v,l)=>v+l,0),qDead=dead*a.fraction/length,qLive=live*a.fraction/length;
      members.forEach(m=>{const c=contributions.get(m.id)??{dead:0,live:0};c.dead+=qDead;c.live+=qLive;contributions.set(m.id,c);});
      return {...a,memberIds:members.map(m=>m.id),length,dead:dead*a.fraction,live:live*a.fraction,qDead,qLive};
    });
    const accounted=fraction+s.outsideFraction;
    if(accounted>1+1e-9)throw new Error('El reparto superficial supera el 100%.');
    const pendingFraction=Math.max(0,1-accounted);
    if(requireComplete&&(!s.reference.trim()||pendingFraction>1e-9||(s.outsideFraction>0&&!s.outsideReference.trim())))
      throw new Error('Reparto superficial incompleto: sustentar la fuente y distribuir el 100% entre receptores y fuera del portico.');
    const values=[dead,live,...allocations.flatMap(a=>[a.qDead,a.qLive,a.dead,a.live])];
    if(!values.every(Number.isFinite))throw new Error('Cargas superficiales no finitas.');
    return {sourceId:s.sourceId,area:s.area,thickness:s.thickness,unitWeight:s.unitWeight,additionalDead:s.additionalDead,surfaceLive:s.live,
      reference:s.reference,method:s.method,dead,live,assignedDead:dead*fraction,assignedLive:live*fraction,
      outsideDead:dead*s.outsideFraction,outsideLive:live*s.outsideFraction,outsideReference:s.outsideReference,
      pendingDead:dead*pendingFraction,pendingLive:live*pendingFraction,pendingFraction,allocations};
  });
  return {rows,contributions};
}
