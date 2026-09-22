import { solveFrame } from './Solver';
self.onmessage=(event)=>{
  try{const {model,factors,caseName}=event.data;self.postMessage({result:solveFrame(model,factors,caseName)});}
  catch(error){self.postMessage({error:(error as Error).message});}
};
