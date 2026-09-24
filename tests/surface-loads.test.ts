import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {BimDatabase} from '../src/core/database/BimDatabase';
import {deriveAnalysis,matchesAnalyticalGeometry} from '../src/core/analysis/Model';
import {surfaceSnapshot,compileSurfaceLoads} from '../src/core/analysis/SurfaceLoads';
import {assembleFrameLoads,frameInputSignature} from '../src/core/analysis/Loads';
import {buildLoadLedger,loadLedgerCsv} from '../src/core/analysis/LoadLedger';
import {analysisReport} from '../src/core/analysis/Report';
import {solveFrame} from '../src/core/analysis/Solver';
import {createExampleProject} from '../src/core/model/ExampleProjects';
import {parseProject} from '../src/core/model/Project';
import type {StructuralDefinition} from '../src/core/model/Geometry';
const factors={dead:1,live:1,nodal:1};
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(){
  const db=BimDatabase.getInstance();db.clearAll();
  const p=(x:number,z:number)=>({x,y:.25,z});
  const add=(d:StructuralDefinition)=>db.registerElement({definition:d,legacyId:crypto.randomUUID(),category:d.type,volume:0,levelName:'Nivel 1',dimensions:''});
  const beam=add({type:'beam',startPoint:p(0,0),endPoint:p(6,0),width:.3,height:.5});
  const slab=add({type:'slab',boundary:[p(0,0),p(6,0),p(6,4),p(0,4)],voids:[[p(1,1),p(2,1),p(2,2),p(1,2)]],thickness:.2,elevationY:.25});
  const docs=db.getAllElements(),model=deriveAnalysis(docs,db.revision,{plane:'XY',ordinate:0,tolerance:.001,elasticModulusMPa:25000,unitWeight:0});
  model.nodes[0].support='pinned';model.nodes[1].support='roller';
  model.surfaceLoads=[{...surfaceSnapshot(slab),method:'declared-uniform',unitWeight:24,additionalDead:1.2,live:2,
    reference:'Ensayo independiente, reparto uniforme declarado 50%; no validacion normativa.',allocations:[{receiverId:beam.uniqueId,fraction:.5}],outsideFraction:.5,outsideReference:'Otro portico de ensayo no incluido.'}];
  return {db,docs,model,beam,slab,source:model.surfaceLoads[0]};
}

test('Fuente con hueco: D=138, L=46 kN; mitad aplicada y mitad declarada fuera',()=>{
  const {model,source,docs}=fixture(),loads=assembleFrameLoads(model,factors),s=loads.surfaces[0];
  close(source.area,23);close(s.dead,138);close(s.live,46);close(s.assignedDead,69);close(s.assignedLive,23);
  close(s.dead,s.assignedDead+s.outsideDead+s.pendingDead);close(s.live,s.assignedLive+s.outsideLive+s.pendingLive);
  close(loads.totals.fy,-92);close(loads.totals.surfaceDead,69);close(loads.totals.manualDead,0);
  const result=solveFrame(model,factors,'Superficie');result.nodes.forEach(n=>close(n.ry,46));
  const ledger=buildLoadLedger(model,factors,docs,result);
  close(ledger.rows.reduce((v,r)=>v+r.downward,0),92);assert.equal(ledger.rows.find(r=>r.sourceId===source.sourceId)!.status,'transfer-linked');
  close(ledger.levels.reduce((v,r)=>v+r.surfaceDead,0),69);
  assert.match(loadLedgerCsv(ledger),/D superficial asignada/);
  assert.match(analysisReport(model,result,factors,'',undefined,ledger),/Fuentes superficiales declaradas/);
});

test('Subdividir una viga no multiplica su transferencia y conserva reacciones y momento global',()=>{
  const {model}=fixture(),original=assembleFrameLoads(model,factors),m=model.members[0];
  model.nodes.push({id:'N3',x:2,y:0,support:'free',fx:0,fy:0,moment:0});
  model.members=[{...m,end:'N3',sourceRange:[0,1/3]},{...m,id:'B2',start:'N3',sourceRange:[1/3,1]}];
  const loads=assembleFrameLoads(model,factors);close(loads.totals.fy,original.totals.fy);close(loads.totals.moment,original.totals.moment);
  close(loads.members[0].surfaceDead,23);close(loads.members[1].surfaceDead,46);
  const result=solveFrame(model,factors,'Dividida');close(result.nodes.find(n=>n.id==='N1')!.ry,46);close(result.nodes.find(n=>n.id==='N2')!.ry,46);
});

test('Repartos parciales se conservan como borrador pero no se calculan; sustento requerido',()=>{
  const {model,source}=fixture();source.outsideFraction=0;
  close(compileSurfaceLoads(model,false).rows[0].pendingDead,69);assert.throws(()=>solveFrame(model,factors,'Incompleto'),/incompleto/);
  source.outsideFraction=.5;source.outsideReference='';assert.throws(()=>compileSurfaceLoads(model),/incompleto/);
  source.outsideReference='Portico restante';source.reference='';assert.throws(()=>compileSurfaceLoads(model),/incompleto/);
});

test('Rechaza duplicados, sobreasignacion, receptores ausentes, barras inclinadas y numeros invalidos',()=>{
  const mutations=[
    (m:any)=>m.surfaceLoads.push(structuredClone(m.surfaceLoads[0])),
    (m:any)=>m.surfaceLoads[0].allocations.push({...m.surfaceLoads[0].allocations[0]}),
    (m:any)=>m.surfaceLoads[0].outsideFraction=.6,
    (m:any)=>m.surfaceLoads[0].allocations[0].receiverId='missing',
    (m:any)=>m.nodes[1].y=1,
    (m:any)=>m.surfaceLoads[0].unitWeight=NaN,
    (m:any)=>m.surfaceLoads[0].additionalDead=-1,
    (m:any)=>m.surfaceLoads[0].live=Infinity,
    (m:any)=>m.surfaceLoads[0].area=0,
    (m:any)=>m.surfaceLoads[0].allocations[0].fraction=-.5,
    (m:any)=>m.surfaceLoads[0].allocations=null,
  ];
  mutations.forEach(mutate=>{const {model}=fixture();mutate(model);assert.throws(()=>compileSurfaceLoads(model,false));});
});

test('No mezcla transferencia con D/L manuales ni con D total de la viga',()=>{
  const {model}=fixture(),m=model.members[0];m.dead=1;assert.throws(()=>solveFrame(model,factors,'Duplicada'),/conciliar/);
  m.dead=0;m.live=1;assert.throws(()=>solveFrame(model,factors,'Duplicada'),/conciliar/);
  m.live=0;m.deadLoadMode='includes-self-weight';m.loadReference='Total';assert.throws(()=>solveFrame(model,factors,'Duplicada'),/conciliar/);
  m.deadLoadMode='additional';m.weight=3.6;close(assembleFrameLoads(model,factors).totals.fy,-113.6);
});

test('Factores se aplican una vez; cambio de fuente invalida resultados y memoria',()=>{
  const {model,source,docs}=fixture(),f={dead:2,live:.5,nodal:1};
  close(assembleFrameLoads(model,f).totals.fy,-149.5);
  const result=solveFrame(model,f,'Factores'),signature=frameInputSignature(model,f);
  source.live=3;assert.notEqual(frameInputSignature(model,f),signature);
  assert.equal(buildLoadLedger(model,f,docs,result).equilibrium,null);assert.throws(()=>analysisReport(model,result,f,''),/no vigentes/);
});

test('Persistencia valida borradores; cambios de losa, area o tipo receptor invalidan geometria',()=>{
  const {model,source,docs,slab,beam}=fixture(),project=createExampleProject('supported');
  project.elements=docs;project.analysis={model,factors,caseName:'Superficial'};
  source.reference='';source.outsideFraction=0;
  const restored=parseProject(JSON.parse(JSON.stringify(project)));assert.deepEqual(restored.analysis!.model.surfaceLoads,model.surfaceLoads);
  assert.equal(matchesAnalyticalGeometry(restored.analysis!.model,docs),true);
  source.area++;assert.equal(matchesAnalyticalGeometry(model,docs),false);source.area--;
  slab.metadata.version++;assert.equal(matchesAnalyticalGeometry(model,docs),false);slab.metadata.version--;
  if(slab.geometry.definition.type==='slab')slab.geometry.definition.thickness=.3;
  assert.equal(matchesAnalyticalGeometry(model,docs),false);
  assert.equal(matchesAnalyticalGeometry(model,docs.filter(d=>d!==beam)),false);
  model.surfaceLoads=[source,source];assert.throws(()=>parseProject(project),/duplicada/);
});

test('Varias fuentes suman aportes sin mutar las cargas manuales',()=>{
  const {model,source}=fixture();model.surfaceLoads!.push({...structuredClone(source),sourceId:'second-slab'});
  const a=assembleFrameLoads(model,factors),b=assembleFrameLoads(model,factors);close(a.totals.fy,-184);close(a.totals.fy,b.totals.fy);
  assert.equal(model.members[0].dead,0);assert.equal(model.members[0].live,0);
});
