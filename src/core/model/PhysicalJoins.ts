import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { WasmBridge } from '../../kernel/WasmBridge';
import { buildElementGeometry } from '../../tools/structural/ElementGeometry';
import { StructuralDefinition, quantities } from './Geometry';

export interface JoinInput {id:string;elementId:number;definition:StructuralDefinition}
export interface JoinResult {id:string;gross:number;net:number;deduction:number;deductedBy:string[];positions:Float32Array;indices:Uint32Array}
const priority={footing:0,column:1,beam:2,slab:3};
export function resolvePhysicalJoins(api:ManifoldToplevel,inputs:JoinInput[]):JoinResult[] {
  const wasm=new WasmBridge(),solids:{input:JoinInput;solid:Manifold;box:ReturnType<Manifold['boundingBox']>;gross:number}[]=[];
  try{
    for(const input of [...inputs].sort((a,b)=>priority[a.definition.type]-priority[b.definition.type]||a.elementId-b.elementId||a.id.localeCompare(b.id))){
      const geometry=buildElementGeometry(wasm,input.definition),p=geometry.getAttribute('position');
      const vertices=new Float32Array(p.array),indices=geometry.index?new Uint32Array(geometry.index.array):Uint32Array.from({length:p.count},(_,i)=>i);
      // Legacy mirrored bases reverse triangle winding; orient the closed shell outwards.
      let signed=0;for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;signed+=vertices[a]*(vertices[b+1]*vertices[c+2]-vertices[b+2]*vertices[c+1])+vertices[a+1]*(vertices[b+2]*vertices[c]-vertices[b]*vertices[c+2])+vertices[a+2]*(vertices[b]*vertices[c+1]-vertices[b+1]*vertices[c]);}
      if(signed<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      geometry.dispose();const mesh=new api.Mesh({numProp:3,vertProperties:vertices,triVerts:indices});mesh.merge();
      const solid=new api.Manifold(mesh);solids.push({input,solid,box:solid.boundingBox(),gross:quantities(input.definition).volume});
      if(solid.status()!=='NoError')throw new Error(`Solido no valido: ${input.id} (${solid.status()}).`);
      if(Math.abs(solid.volume()-solids[solids.length-1].gross)>Math.max(1e-5,solids[solids.length-1].gross*1e-5))throw new Error(`Volumen de malla inconsistente: ${input.id}.`);
    }
    return solids.map((entry,index)=>{
      let net=entry.solid;const deductedBy:string[]=[];
      try{
        for(let j=0;j<index;j++){
          const other=solids[j];
          if(!entry.box.min.every((v,k)=>Math.min(entry.box.max[k],other.box.max[k])-Math.max(v,other.box.min[k])>1e-7))continue;
          const before=net.volume(),next=net.subtract(other.solid);
          if(net!==entry.solid)net.delete();net=next;
          if(net.status()!=='NoError')throw new Error(`Fallo de union: ${entry.input.id}.`);
          if(before-net.volume()>1e-8)deductedBy.push(other.input.id);
        }
        const deduction=Math.max(0,entry.solid.volume()-net.volume()),volume=Math.max(0,entry.gross-deduction),mesh=net.getMesh();
        return {id:entry.input.id,gross:entry.gross,net:volume,deduction:entry.gross-volume,deductedBy,positions:new Float32Array(mesh.vertProperties),indices:new Uint32Array(mesh.triVerts)};
      }finally{if(net!==entry.solid)net.delete();}
    });
  }finally{solids.forEach(e=>e.solid.delete());}
}
