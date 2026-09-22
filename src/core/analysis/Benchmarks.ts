import type { AnalysisModel, AnalysisResult, AnalysisSetup } from './Model';

export type BenchmarkId='cantilever'|'supported';
export const benchmarkSource='https://oit.tudelft.nl/Finite-Elements-in-CEG/main/structural_linear/Exercises/pyjive_timoshenko.html';
export function benchmarkModel(id:BenchmarkId):AnalysisModel {
  const cantilever=id==='cantilever',length=cantilever?3:6,width=cantilever?.2:.3,height=cantilever?.3:.5;
  const area=width*height;
  return {revision:0,plane:'XY',ordinate:0,tolerance:.001,issues:[cantilever?'Voladizo L=3 m; P=10 kN hacia abajo en el extremo libre; E=30000 MPa; seccion 0.20 x 0.30 m.':'Viga biapoyada L=6 m; q=10 kN/m hacia abajo; E=25000 MPa; seccion 0.30 x 0.50 m.','Sin peso propio. Ensayo lineal de referencia, no comprobacion RNE.'],omitted:0,sourceVersions:{},
    nodes:[{id:'N1',x:0,y:0,support:cantilever?'fixed':'pinned',fx:0,fy:0,moment:0},{id:'N2',x:length,y:0,support:cantilever?'free':'roller',fx:0,fy:cantilever?-10:0,moment:0}],
    members:[{id:'B1',sourceId:'reference',mark:'V-1',start:'N1',end:'N2',area,inertia:area*height*height/12,height,elasticModulusMPa:cantilever?30000:25000,poisson:.2,weight:0,dead:cantilever?0:10,live:0,releaseStart:false,releaseEnd:false}]};
}
export function benchmarkMatches(id:BenchmarkId,model:AnalysisModel,factors:AnalysisSetup['factors']):boolean {
  if(model.surfaceLoads?.length)return false;
  const signature=(m:AnalysisModel)=>JSON.stringify({plane:m.plane,ordinate:m.ordinate,
    nodes:m.nodes.map(n=>[n.id,n.x,n.y,n.support,n.fx,n.fy,n.moment]),
    members:m.members.map(b=>[b.id,b.start,b.end,b.area,b.inertia,b.height,b.elasticModulusMPa,b.poisson,b.weight,b.dead,b.live,b.releaseStart,b.releaseEnd,b.deadLoadMode??'additional'])});
  return factors.dead===1&&factors.live===1&&factors.nodal===1&&signature(model)===signature(benchmarkModel(id));
}
export interface BenchmarkCheck {label:string;unit:string;formula:string;expected:number;actual?:number;error?:number;pass?:boolean}
export function benchmarkChecks(id:BenchmarkId,result?:AnalysisResult):BenchmarkCheck[] {
  const model=benchmarkModel(id),m=model.members[0],L=model.nodes[1].x,E=m.elasticModulusMPa*1000,G=E/(2*(1+m.poisson));
  const n=result?.nodes.find(n=>n.id==='N1'),end=result?.nodes.find(n=>n.id==='N2'),bar=result?.members.find(m=>m.id==='B1');
  const rows:BenchmarkCheck[]=id==='cantilever' ? [
    {label:'Reaccion vertical',unit:'kN',formula:'Ry = P',expected:10,actual:n?.ry},
    {label:'Momento en empotramiento (abs.)',unit:'kN m',formula:'|M| = P L',expected:30,actual:n?Math.abs(n.rm):undefined},
    {label:'Desplazamiento extremo Uy',unit:'mm',formula:'Uy = -[P L^3/(3 E I) + P L/((5/6) G A)]',expected:-(10*L**3/(3*E*m.inertia)+10*L/((5/6)*G*m.area))*1000,actual:end?end.uy*1000:undefined},
  ] : [
    {label:'Reaccion izquierda',unit:'kN',formula:'Ry = q L/2',expected:30,actual:n?.ry},
    {label:'Reaccion derecha',unit:'kN',formula:'Ry = q L/2',expected:30,actual:end?.ry},
    {label:'Momento maximo (abs.)',unit:'kN m',formula:'|M|max = q L^2/8',expected:45,actual:bar?Math.max(...bar.moment.map(Math.abs)):undefined},
  ];
  return rows.map(r=>{if(r.actual===undefined)return r;const error=Math.abs(r.actual-r.expected);return {...r,error,pass:Number.isFinite(error)&&error<=1e-8+1e-6*Math.abs(r.expected)};});
}
