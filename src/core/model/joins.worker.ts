import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { resolvePhysicalJoins } from './PhysicalJoins';
const ready=Module({locateFile:()=>wasmUrl}).then(api=>{api.setup();return api;});
self.onmessage=async e=>{try{self.postMessage({revision:e.data.revision,rows:resolvePhysicalJoins(await ready,e.data.elements)});}catch(error){self.postMessage({revision:e.data.revision,error:(error as Error).message});}};
