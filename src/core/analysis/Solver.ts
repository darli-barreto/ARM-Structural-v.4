import { Beam2D, DofID, LinearStaticSolver } from 'ts-fem';
import { AnalysisModel, AnalysisResult, validateAnalysis } from './Model';
import {assembleFrameLoads,frameInputSignature} from './Loads';
import { sampleTimoshenkoShape } from './TimoshenkoShape';

export type SolvePhase = 'validation' | 'loadAssembly' | 'domainSetup' | 'loadApplication'
  | 'equationNumbering' | 'matrixAssembly' | 'linearSolve' | 'nodeRecovery'
  | 'memberRecovery' | 'finalChecks';

class ProfiledLinearStaticSolver extends LinearStaticSolver {
  constructor(private readonly onPhase: (phase: SolvePhase) => void) { super(); }

  override generateCodeNumbers() {
    super.generateCodeNumbers();
    this.onPhase('equationNumbering');
  }

  override assemble() {
    super.assemble();
    this.onPhase('matrixAssembly');
  }
}

export function solveFrame(model:AnalysisModel,factors:{dead:number;live:number;nodal:number},caseName:string,onPhase?: (phase:SolvePhase)=>void):AnalysisResult {
  validateAnalysis(model);if(!Object.values(factors).every(Number.isFinite))throw new Error('Factores no validos.');
  onPhase?.('validation');
  const loads=assembleFrameLoads(model,factors);
  onPhase?.('loadAssembly');
  const solver=onPhase?new ProfiledLinearStaticSolver(onPhase):new LinearStaticSolver(),domain=solver.domain;
  const dofs=[DofID.Dx,DofID.Dz,DofID.Ry];
  model.nodes.forEach(n=>domain.createNode(n.id,[n.x,0,n.y],n.support==='fixed'?dofs:n.support==='pinned'?[DofID.Dx,DofID.Dz]:n.support==='roller'?[DofID.Dz]:[]));
  model.members.forEach(m=>{
    const e=m.elasticModulusMPa*1000;
    domain.createMaterial(m.id,{e,g:e/(2*(1+m.poisson)),alpha:0,d:0});
    domain.createCrossSection(m.id,{a:m.area,iy:m.inertia,iz:m.inertia,dyz:0,h:m.height,k:5/6,j:1});
    domain.createBeam2D(m.id,[m.start,m.end],m.id,m.id,[m.releaseStart,m.releaseEnd]);
  });
  onPhase?.('domainSetup');
  const lc=solver.loadCases[0];
  loads.nodes.forEach(n=>lc.createNodalLoad(n.id,{[DofID.Dx]:n.fx,[DofID.Dz]:n.fy,[DofID.Ry]:n.moment}));
  loads.members.forEach(m=>lc.createBeamElementUniformEdgeLoad(m.id,[0,-m.lineLoad],false));
  onPhase?.('loadApplication');
  try{solver.solve();}catch{throw new Error('El sistema es singular o inestable. Revisar apoyos, liberaciones y conectividad.');}
  onPhase?.('linearSolve');
  const flatten=(v:unknown):number[]=>Array.isArray(v)?v.flat(Infinity).map(Number):flatten((v as {toArray:()=>unknown}).toArray());
  const nodes=model.nodes.map(n=>{
    const obj=domain.getNode(n.id),u=flatten(obj.getUnknowns(lc,dofs)),r=obj.getReactions(lc),v=flatten(r.values);
    const reaction=(dof:DofID)=>{const i=r.dofs.indexOf(dof);return i<0?0:v[i];};
    return {id:n.id,ux:u[0],uy:u[1],rotation:u[2],rx:reaction(DofID.Dx),ry:reaction(DofID.Dz),rm:reaction(DofID.Ry)};
  });
  onPhase?.('nodeRecovery');
  const nodeById=new Map(model.nodes.map(node=>[node.id,node]));
  const lineLoadById=new Map(loads.members.map(load=>[load.id,load.lineLoad]));
  const members=model.members.map(m=>{
    const el=domain.getElement(m.id) as Beam2D;
    const normal=el.computeNormalForce(lc,20),shear=el.computeShearForce(lc,20),moment=el.computeBendingMoment(lc,20);
    const start=nodeById.get(m.start)!,end=nodeById.get(m.end)!;
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),c=dx/length,s=dy/length;
    const localEnd=flatten(el.computeEndDisplacement(lc));
    if(localEnd.length!==6)throw new Error(`Desplazamientos de extremo incompatibles para ${m.id}.`);
    const elasticModulusPa=m.elasticModulusMPa*1e6;
    const globalLoadNPerM=-(lineLoadById.get(m.id)??0)*1_000;
    // ts-fem's local Ry is clockwise in this plane; the beam field uses counter-clockwise rotation.
    const shape=sampleTimoshenkoShape({
      lengthM:length,
      axialRigidityN:elasticModulusPa*m.area,
      bendingRigidityNm2:elasticModulusPa*m.inertia,
      shearRigidityN:(5/6)*elasticModulusPa*m.area/(2*(1+m.poisson)),
      endDisplacements:[localEnd[0],localEnd[1],-localEnd[2],localEnd[3],localEnd[4],-localEnd[5]],
      axialLoadNPerM:s*globalLoadNPerM,
      transverseLoadNPerM:c*globalLoadNPerM,
    },normal.x);
    return {
      id:m.id,sourceId:m.sourceId,endForces:flatten(el.computeEndForces(lc)),stations:normal.x,
      axial:normal.N,shear:shear.V,moment:moment.M,
      deflectionX:shape.axialM.map((u,index)=>c*u-s*shape.transverseM[index]),
      deflectionY:shape.axialM.map((u,index)=>s*u+c*shape.transverseM[index]),
    };
  });
  onPhase?.('memberRecovery');
  if(nodes.some(n=>Object.values(n).some(v=>typeof v==='number'&&!Number.isFinite(v)))||members.some(m=>[...m.endForces,...m.axial,...m.shear,...m.moment,...m.deflectionX,...m.deflectionY].some(v=>!Number.isFinite(v))))throw new Error('El motor produjo resultados no finitos.');
  const {fx,fy,moment}=loads.totals;
  const totalMoment=moment+nodes.reduce((s,n)=>{const p=model.nodes.find(p=>p.id===n.id)!;return s+n.rm+p.y*n.rx-p.x*n.ry;},0);
  const residual=Math.max(Math.hypot(fx+nodes.reduce((s,n)=>s+n.rx,0),fy+nodes.reduce((s,n)=>s+n.ry,0))/Math.max(1,Math.hypot(fx,fy)),Math.abs(totalMoment)/Math.max(1,Math.abs(moment)));
  if(residual>1e-5)throw new Error('El resultado no satisface el equilibrio global de fuerzas y momentos.');
  const inputSignature=frameInputSignature(model,factors);
  onPhase?.('finalChecks');
  return {revision:model.revision,caseName,nodes,members,residual,inputSignature,engine:'ts-fem 0.2.0 / Timoshenko 2D / lineal elastico'};
}
