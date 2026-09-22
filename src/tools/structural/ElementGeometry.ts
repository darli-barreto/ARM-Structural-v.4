import * as THREE from 'three';
import { StructuralDefinition, quantities } from '../../core/model/Geometry';
import { WasmBridge } from '../../kernel/WasmBridge';
import { ManagedElement } from './types';

export function buildElementGeometry(wasm: WasmBridge, d: StructuralDefinition): THREE.BufferGeometry {
  if (d.type==='beam') return wasm.createArbitraryBeam(d.startPoint,d.endPoint,d.width,d.height).geometry;
  if (d.type==='column') return wasm.createSlantedColumn(d.basePoint,d.topPoint,d.width,d.depth).geometry;
  if (d.type==='footing') return wasm.createFooting(d.center.x,d.center.y,d.center.z,d.width,d.length,d.height).geometry;
  return wasm.createPolygonSlab(d.boundary,d.voids,d.thickness,d.elevationY).geometry;
}

// Older generators produce axis-aligned solids. Capture their parameters once on insertion.
export function captureDefinition(el: ManagedElement): StructuralDefinition {
  if (el.definition) return el.definition;
  if (el.mesh.geometry.userData.definition) return structuredClone(el.mesh.geometry.userData.definition);
  el.mesh.geometry.computeBoundingBox();
  const {min:a,max:b}=el.mesh.geometry.boundingBox!;
  const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  if(el.type==='column') return {type:'column',columnStyle:'vertical',basePoint:{x,y:a.y,z},topPoint:{x,y:b.y,z},width:b.x-a.x,depth:b.z-a.z};
  if(el.type==='footing') return {type:'footing',center:{x,y:a.y,z},width:b.x-a.x,length:b.z-a.z,height:b.y-a.y};
  if(el.type==='beam') {
    const alongX=b.x-a.x>=b.z-a.z;
    return {type:'beam',startPoint:{x:alongX?a.x:x,y:b.y,z:alongX?z:a.z},endPoint:{x:alongX?b.x:x,y:b.y,z:alongX?z:b.z},width:alongX?b.z-a.z:b.x-a.x,height:b.y-a.y};
  }
  return {type:'slab',boundary:[{x:a.x,y:a.y,z:a.z},{x:b.x,y:a.y,z:a.z},{x:b.x,y:a.y,z:b.z},{x:a.x,y:a.y,z:b.z}],voids:[],thickness:b.y-a.y,elevationY:a.y};
}

export function applyGeometry(el: ManagedElement, d: StructuralDefinition, wasm: WasmBridge): void {
  const q=quantities(d);
  const geometry=buildElementGeometry(wasm,d);
  el.mesh.geometry.dispose(); el.line.geometry.dispose();
  el.mesh.geometry=geometry; el.line.geometry=new THREE.EdgesGeometry(geometry,20);
  el.definition=structuredClone(d); el.volume=q.volume; el.dimensions=q.dimensions;
}
