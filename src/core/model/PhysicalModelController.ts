import * as THREE from 'three';
import { BimDatabase } from '../database/BimDatabase';
import { ElementRegistry } from '../../tools/structural/ElementRegistry';
import type { JoinResult } from './PhysicalJoins';
import { reinforcementLedger } from './Reinforcement';

/** Boolean meshes are disposable derivatives, never the editable source geometry. */
export class PhysicalModelController {
  public status='Sin elementos';
  public state:'pending'|'ready'|'error'='ready';
  private worker:Worker|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private registry:ElementRegistry,private refresh:()=>void){
    BimDatabase.getInstance().subscribe(action=>{if(action!=='quantities')this.schedule();});
    this.schedule();
  }
  private schedule(){
    clearTimeout(this.timer);this.worker?.terminate();this.worker=null;
    this.state='pending';this.status='Uniones: calculando...';
    this.timer=setTimeout(()=>this.compute(),250);
  }
  private compute(){
    const db=BimDatabase.getInstance(),revision=db.revision;
    const elements=db.getAllElements().filter(d=>d.geometry.definition).map(d=>({id:d.uniqueId,elementId:d.elementId,definition:d.geometry.definition!}));
    if(!elements.length){this.state='ready';this.status='Sin elementos';return;}
    const worker=new Worker(new URL('./joins.worker.ts',import.meta.url),{type:'module'});this.worker=worker;
    const fail=(message:string)=>{worker.terminate();this.worker=null;if(db.revision!==revision)return;db.markJoinError(revision);this.state='error';this.status='Uniones: error. Metrado bruto';console.error(message);};
    worker.onerror=e=>fail(e.message);
    worker.onmessage=e=>{
      if(db.revision!==revision){worker.terminate();return;}
      if(e.data.error){fail(e.data.error);return;}
      const rows=e.data.rows as JoinResult[];
      const steel=reinforcementLedger(db.getAllElements());
      if(!db.applyJoinedQuantities(revision,rows,steel.mass)){fail('Resultados de uniones inconsistentes.');return;}
      rows.forEach(row=>{
        const element=this.registry.findById(row.id);if(!element)return;
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(row.positions,3));geometry.setIndex(new THREE.BufferAttribute(row.indices,1));geometry.computeVertexNormals();
        element.mesh.geometry.dispose();element.mesh.geometry=geometry;
        element.line.geometry.dispose();element.line.geometry=new THREE.EdgesGeometry(geometry,25);
      });
      worker.terminate();this.worker=null;this.state='ready';
      this.status=`Uniones listas | Neto ${rows.reduce((s,r)=>s+r.net,0).toFixed(3)} m3 | Descuento ${rows.reduce((s,r)=>s+r.deduction,0).toFixed(3)} m3`;
      this.refresh();
    };
    worker.postMessage({revision,elements});
  }
}
