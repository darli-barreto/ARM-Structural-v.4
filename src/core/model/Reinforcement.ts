import * as THREE from 'three';
import { memberAxes } from '../analysis/AnalyticalGraph';
import { StructuralDefinition } from './Geometry';
import type { BimElementDocument } from '../database/BimDatabaseTypes';

export interface RebarSpec {status:'manual-unverified';cover:number;diameter:number;barsU:number;barsV:number;tieDiameter:number;tieSpacing:number}
export interface RebarPath {points:THREE.Vector3[];diameter:number;sourceId:string}
export function validateRebarSpec(s:RebarSpec):void{
  if(!s||s.status!=='manual-unverified'||![s.cover,s.diameter,s.barsU,s.barsV,s.tieDiameter,s.tieSpacing].every(Number.isFinite)||s.cover<=0||s.diameter<6||s.diameter>50||s.tieDiameter<4||s.tieDiameter>20||s.tieSpacing<.04||s.tieSpacing>2||![s.barsU,s.barsV].every(n=>Number.isInteger(n)&&n>=2&&n<=20))throw new Error('Armadura manual no valida.');
}
export function rebarPaths(d:StructuralDefinition,s:RebarSpec,sourceId=''):RebarPath[]{
  validateRebarSpec(s);
  const axis=memberAxes(d);if(!axis||d.type!=='beam'&&d.type!=='column')throw new Error('Jaulas manuales disponibles solo en vigas y columnas.');
  const depth=d.type==='beam'?d.height:d.depth,length=axis.a.distanceTo(axis.b),margin=s.cover+(s.tieDiameter+s.diameter/2)/1000;
  const u=d.width/2-margin,v=depth/2-margin;
  if(u<=0||v<=0||length<=2*s.cover)throw new Error('La armadura no cabe en la seccion con ese recubrimiento.');
  const out:RebarPath[]=[],point=(x:number,y:number,t:number)=>axis.a.clone().addScaledVector(axis.u,x).addScaledVector(axis.v,y).addScaledVector(axis.direction,t);
  const longitudinal=(x:number,y:number)=>out.push({sourceId,diameter:s.diameter,points:[point(x,y,s.cover),point(x,y,length-s.cover)]});
  for(let i=0;i<s.barsU;i++){const x=-u+2*u*i/(s.barsU-1);longitudinal(x,-v);longitudinal(x,v);}
  for(let i=1;i<s.barsV-1;i++){const y=-v+2*v*i/(s.barsV-1);longitudinal(-u,y);longitudinal(u,y);}
  const tu=d.width/2-s.cover-s.tieDiameter/2000,tv=depth/2-s.cover-s.tieDiameter/2000,first=s.cover+s.tieDiameter/2000,last=length-first,steps=Math.ceil((last-first)/s.tieSpacing);
  if(steps>5000)throw new Error('La jaula supera 5000 estribos.');
  for(let i=0;i<=steps;i++){
    const t=first+(last-first)*i/Math.max(1,steps);
    out.push({sourceId,diameter:s.tieDiameter,points:[point(-tu,-tv,t),point(tu,-tv,t),point(tu,tv,t),point(-tu,tv,t),point(-tu,-tv,t)]});
  }
  return out;
}
/** Only identical whole bar paths are duplicates. Intersecting bars are distinct physical bars. */
export function reinforcementLedger(documents:BimElementDocument[]){
  const seen=new Set<string>(),mass=new Map<string,number>(),paths:RebarPath[]=[],errors:string[]=[];
  [...documents].sort((a,b)=>a.elementId-b.elementId).forEach(d=>{
    if(!d.reinforcement)return;
    try{
      const bars=rebarPaths(d.geometry.definition,d.reinforcement,d.uniqueId);let kg=0;
      bars.forEach(bar=>{
        const pts=bar.points.map(p=>p.toArray().map(v=>v.toFixed(6)).join(','));
        const key=bar.diameter+':'+[pts.join(';'),[...pts].reverse().join(';')].sort()[0];if(seen.has(key))return;seen.add(key);
        kg+=bar.points.slice(1).reduce((n,p,i)=>n+p.distanceTo(bar.points[i]),0)*Math.PI*(bar.diameter/1000)**2/4*7850;paths.push(bar);
      });mass.set(d.uniqueId,kg);
    }catch(e){errors.push(`${d.instanceParameters.mark}: ${(e as Error).message}`);}
  });
  return {mass,paths,errors};
}
