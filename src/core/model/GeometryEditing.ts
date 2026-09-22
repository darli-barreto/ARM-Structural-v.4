import { StructuralDefinition, Vector3D } from './Geometry';

export class AxisConstraint {
  public axis: 'x'|'y'|'z'|null = null;
  reset(): void { this.axis=null; }
  constrain(delta:Vector3D,active:boolean,axes:('x'|'y'|'z')[]=['x','z']):Vector3D {
    if(!active){this.reset();return {...delta};}
    if(!this.axis && Math.max(...axes.map(a=>Math.abs(delta[a])))>0.001)
      this.axis=axes.reduce((a,b)=>Math.abs(delta[a])>Math.abs(delta[b])?a:b);
    return {x:this.axis==='x'?delta.x:0,y:this.axis==='y'?delta.y:0,z:this.axis==='z'?delta.z:0};
  }
}

export function translateDefinition(source:StructuralDefinition,delta:Vector3D):StructuralDefinition {
  const d=structuredClone(source);
  const move=(p:Vector3D)=>{p.x+=delta.x;p.y+=delta.y;p.z+=delta.z;};
  if(d.type==='slab'){d.elevationY+=delta.y;[d.boundary,...(d.voids||[])].flat().forEach(move);}
  else if(d.type==='beam'){move(d.startPoint);move(d.endPoint);}
  else if(d.type==='column'){move(d.basePoint);move(d.topPoint);}
  else move(d.center);
  return d;
}

export function edgeNormal(ring:Vector3D[],index:number):Vector3D {
  const a=ring[index],b=ring[(index+1)%ring.length],length=Math.hypot(b.x-a.x,b.z-a.z);
  if(length<0.001)throw new Error('Borde demasiado corto.');
  return {x:-(b.z-a.z)/length,y:0,z:(b.x-a.x)/length};
}

// Offset a supporting line and intersect its neighbours, preserving their directions.
// Consecutive collinear segments move together, including inserted midpoint vertices.
export function slideEdge(ring:Vector3D[],index:number,delta:Vector3D):Vector3D[] {
  const n=ring.length,normal=edgeNormal(ring,index),a=ring[index];
  const offset=delta.x*normal.x+delta.z*normal.z;
  const shift={x:normal.x*offset,z:normal.z*offset};
  const collinear=(p:Vector3D)=>Math.abs((p.x-a.x)*normal.x+(p.z-a.z)*normal.z)<1e-8;
  let start=index,end=(index+1)%n;
  for(let k=0;k<n-2&&collinear(ring[(start+n-1)%n]);k++)start=(start+n-1)%n;
  for(let k=0;k<n-2&&collinear(ring[(end+1)%n]);k++)end=(end+1)%n;
  const out=structuredClone(ring);
  const intersect=(i:number,other:number)=>{
    const p=ring[i],q=ring[other],dx=q.x-p.x,dz=q.z-p.z;
    const denominator=dx*normal.x+dz*normal.z;
    if(Math.abs(denominator)<1e-10)throw new Error('No se puede desplazar este borde.');
    const t=offset/denominator;
    return {x:p.x+t*dx,y:p.y,z:p.z+t*dz};
  };
  out[start]=intersect(start,(start+n-1)%n);out[end]=intersect(end,(end+1)%n);
  for(let i=(start+1)%n;i!==end;i=(i+1)%n)out[i]={x:ring[i].x+shift.x,y:ring[i].y,z:ring[i].z+shift.z};
  return out;
}
