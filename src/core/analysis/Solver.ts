import { Beam2D, DofID, LinearStaticSolver } from 'ts-fem';
import { AnalysisModel, AnalysisResult, validateAnalysis } from './Model';
import {assembleFrameLoads,frameInputSignature} from './Loads';

export function solveFrame(model:AnalysisModel,factors:{dead:number;live:number;nodal:number},caseName:string):AnalysisResult {
  validateAnalysis(model);if(!Object.values(factors).every(Number.isFinite))throw new Error('Factores no validos.');
  const loads=assembleFrameLoads(model,factors);
  const solver=new LinearStaticSolver(),domain=solver.domain;
  const dofs=[DofID.Dx,DofID.Dz,DofID.Ry];
  model.nodes.forEach(n=>domain.createNode(n.id,[n.x,0,n.y],n.support==='fixed'?dofs:n.support==='pinned'?[DofID.Dx,DofID.Dz]:n.support==='roller'?[DofID.Dz]:[]));
  model.members.forEach(m=>{
    const e=m.elasticModulusMPa*1000;
    domain.createMaterial(m.id,{e,g:e/(2*(1+m.poisson)),alpha:0,d:0});
    domain.createCrossSection(m.id,{a:m.area,iy:m.inertia,iz:m.inertia,dyz:0,h:m.height,k:5/6,j:1});
    domain.createBeam2D(m.id,[m.start,m.end],m.id,m.id,[m.releaseStart,m.releaseEnd]);
  });
  const lc=solver.loadCases[0];
  loads.nodes.forEach(n=>lc.createNodalLoad(n.id,{[DofID.Dx]:n.fx,[DofID.Dz]:n.fy,[DofID.Ry]:n.moment}));
  loads.members.forEach(m=>lc.createBeamElementUniformEdgeLoad(m.id,[0,-m.lineLoad],false));
  try{solver.solve();}catch{throw new Error('El sistema es singular o inestable. Revisar apoyos, liberaciones y conectividad.');}
  const flatten=(v:unknown):number[]=>Array.isArray(v)?v.flat(Infinity).map(Number):flatten((v as {toArray:()=>unknown}).toArray());
  const nodes=model.nodes.map(n=>{
    const obj=domain.getNode(n.id),u=flatten(obj.getUnknowns(lc,dofs)),r=obj.getReactions(lc),v=flatten(r.values);
    const reaction=(dof:DofID)=>{const i=r.dofs.indexOf(dof);return i<0?0:v[i];};
    return {id:n.id,ux:u[0],uy:u[1],rotation:u[2],rx:reaction(DofID.Dx),ry:reaction(DofID.Dz),rm:reaction(DofID.Ry)};
  });
  const members=model.members.map(m=>{
    const el=domain.getElement(m.id) as Beam2D,normal=el.computeNormalForce(lc,20),shear=el.computeShearForce(lc,20),moment=el.computeBendingMoment(lc,20),deflection=el.computeGlobalDefl(lc,20);
    return {id:m.id,sourceId:m.sourceId,endForces:flatten(el.computeEndForces(lc)),stations:normal.x,axial:normal.N,shear:shear.V,moment:moment.M,deflectionX:deflection.u,deflectionY:deflection.w};
  });
  if(nodes.some(n=>Object.values(n).some(v=>typeof v==='number'&&!Number.isFinite(v)))||members.some(m=>[...m.endForces,...m.axial,...m.shear,...m.moment].some(v=>!Number.isFinite(v))))throw new Error('El motor produjo resultados no finitos.');
  const {fx,fy,moment}=loads.totals;
  const totalMoment=moment+nodes.reduce((s,n)=>{const p=model.nodes.find(p=>p.id===n.id)!;return s+n.rm+p.y*n.rx-p.x*n.ry;},0);
  const residual=Math.max(Math.hypot(fx+nodes.reduce((s,n)=>s+n.rx,0),fy+nodes.reduce((s,n)=>s+n.ry,0))/Math.max(1,Math.hypot(fx,fy)),Math.abs(totalMoment)/Math.max(1,Math.abs(moment)));
  if(residual>1e-5)throw new Error('El resultado no satisface el equilibrio global de fuerzas y momentos.');
  return {revision:model.revision,caseName,nodes,members,residual,inputSignature:frameInputSignature(model,factors),engine:'ts-fem 0.2.0 / Timoshenko 2D / lineal elastico'};
}
