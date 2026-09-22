import * as THREE from 'three';
import type { BimElementDocument } from '../database/BimDatabaseTypes';
import type { StructuralDefinition } from '../model/Geometry';

export const vector=(p:{x:number;y:number;z:number})=>new THREE.Vector3(p.x,p.y,p.z);
export function memberAxes(d:StructuralDefinition){
  if(d.type!=='beam'&&d.type!=='column')return null;
  let a=vector(d.type==='beam'?d.startPoint:d.basePoint),b=vector(d.type==='beam'?d.endPoint:d.topPoint);
  const direction=b.clone().sub(a).normalize();
  let u:THREE.Vector3,v:THREE.Vector3;
  if(d.type==='beam'){
    u=direction.clone().cross(new THREE.Vector3(0,1,0));if(u.lengthSq()<.0001)u.set(1,0,0);else u.normalize();
    v=u.clone().cross(direction).normalize();a=a.addScaledVector(v,-d.height/2);b=b.addScaledVector(v,-d.height/2);
  }else{
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    u=new THREE.Vector3(1,0,0).applyQuaternion(q);v=new THREE.Vector3(0,0,1).applyQuaternion(q);
  }
  return {a,b,u,v,direction};
}
export const ANALYTICAL_GEOMETRY_VERSION='centroid-intersections-v1';
export interface AxisReference {sourceId:string;parameter:number;adjustment:number}
export interface AnalyticalGraph {
  nodes:{id:string;point:THREE.Vector3;references:AxisReference[]}[];
  members:{id:string;sourceId:string;start:string;end:string;sourceRange:[number,number]}[];
  issues:string[];
  collapsed:string[];
}
/** Split at actual axis intersections; no invented rigid offsets or floor diaphragms. */
export function analyticalGraph(documents:BimElementDocument[],tolerance=.001):AnalyticalGraph {
  if(!Number.isFinite(tolerance)||tolerance<.00001||tolerance>1)throw new Error('Tolerancia entre 0.00001 y 1 m.');
  const axes=[...documents].sort((a,b)=>a.elementId-b.elementId||a.uniqueId.localeCompare(b.uniqueId))
    .map(d=>({id:d.uniqueId,axis:memberAxes(d.geometry.definition)})).filter(e=>e.axis!==null);
  const bounds=axes.map(e=>new THREE.Box3().setFromPoints([e.axis!.a,e.axis!.b]).expandByScalar(tolerance));
  const cuts=axes.map(()=>[0,1]);
  for(let i=0;i<axes.length;i++)for(let j=0;j<i;j++){
    if(!bounds[i].intersectsBox(bounds[j]))continue;
    const a=axes[i].axis!,b=axes[j].axis!,u=a.b.clone().sub(a.a),v=b.b.clone().sub(b.a),w=a.a.clone().sub(b.a);
    const aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),den=aa*cc-bb*bb;
    if(Math.abs(den)>1e-12*aa*cc){
      const s=(bb*ee-cc*dd)/den,t=(aa*ee-bb*dd)/den;
      if(s>=0&&s<=1&&t>=0&&t<=1&&a.a.clone().addScaledVector(u,s).distanceTo(b.a.clone().addScaledVector(v,t))<=tolerance){cuts[i].push(s);cuts[j].push(t);}
    }else{
      for(const p of [b.a,b.b]){const t=p.clone().sub(a.a).dot(u)/aa;if(t>0&&t<1&&a.a.clone().addScaledVector(u,t).distanceTo(p)<=tolerance)cuts[i].push(t);}
      for(const p of [a.a,a.b]){const t=p.clone().sub(b.a).dot(v)/cc;if(t>0&&t<1&&b.a.clone().addScaledVector(v,t).distanceTo(p)<=tolerance)cuts[j].push(t);}
    }
  }
  const result:AnalyticalGraph={nodes:[],members:[],issues:[],collapsed:[]};
  const node=(point:THREE.Vector3,sourceId:string,parameter:number)=>{
    const old=result.nodes.find(n=>n.point.distanceTo(point)<=tolerance);
    if(old){
      if(!old.references.some(r=>r.sourceId===sourceId&&Math.abs(r.parameter-parameter)<1e-12)){
        const adjustment=old.point.distanceTo(point);old.references.push({sourceId,parameter,adjustment});
        if(adjustment>1e-8)result.issues.push(`Nudo ${old.id}: eje ${sourceId} ajustado ${adjustment.toFixed(6)} m por tolerancia.`);
      }
      return old.id;
    }
    const id=`N${result.nodes.length+1}`;result.nodes.push({id,point,references:[{sourceId,parameter,adjustment:0}]});return id;
  };
  axes.forEach((e,i)=>{
    const axis=e.axis!,ts=[...new Set(cuts[i])].sort((a,b)=>a-b).filter((t,k,values)=>k===0||t-values[k-1]>1e-12);
    for(let k=1;k<ts.length;k++){
      const a=axis.a.clone().lerp(axis.b,ts[k-1]),b=axis.a.clone().lerp(axis.b,ts[k]);
      const start=node(a,e.id,ts[k-1]),end=node(b,e.id,ts[k]);
      if(start===end){result.collapsed.push(e.id);continue;}
      result.members.push({id:`B${result.members.length+1}`,sourceId:e.id,start,end,sourceRange:[ts[k-1],ts[k]]});
    }
  });
  if(result.collapsed.length)result.issues.push(`${result.collapsed.length} tramos colapsados por tolerancia; reducirla antes de calcular.`);
  return result;
}
