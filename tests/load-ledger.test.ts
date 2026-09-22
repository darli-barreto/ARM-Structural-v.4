import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assembleFrameLoads,memberLineLoad} from '../src/core/analysis/Loads';
import {buildLoadLedger,loadLedgerCsv} from '../src/core/analysis/LoadLedger';
import {solveFrame} from '../src/core/analysis/Solver';
import {createExampleProject} from '../src/core/model/ExampleProjects';
import {parseProject} from '../src/core/model/Project';
import {deriveAnalysis} from '../src/core/analysis/Model';
import {analysisReport} from '../src/core/analysis/Report';
import {BimDatabase} from '../src/core/database/BimDatabase';
import type {StructuralDefinition} from '../src/core/model/Geometry';
const factors={dead:1,live:1,nodal:1};
function fixture(){
  const project=createExampleProject('supported'),model=project.analysis!.model;
  model.members[0].weight=3.6;model.members[0].dead=10;model.members[0].live=2;
  return {project,model};
}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('Planilla independiente: D adicional suma PP, D total lo excluye una sola vez',()=>{
  const {model,project}=fixture(),member=model.members[0];
  let result=solveFrame(model,factors,'Adicional'),ledger=buildLoadLedger(model,factors,project.elements,result);
  close(ledger.assembled.totals.selfWeight,21.6);close(ledger.assembled.totals.manualDead,60);close(ledger.assembled.totals.manualLive,12);
  close(ledger.assembled.totals.fy,-93.6);result.nodes.forEach(n=>close(n.ry,46.8));
  member.deadLoadMode='includes-self-weight';member.loadReference='Planilla independiente: 10 kN/m con peso de barra incluido.';
  result=solveFrame(model,factors,'Total');ledger=buildLoadLedger(model,factors,project.elements,result);
  close(ledger.assembled.totals.selfWeight,0);close(ledger.assembled.totals.excludedSelfWeight,21.6);close(ledger.assembled.totals.fy,-72);
  result.nodes.forEach(n=>close(n.ry,36));assert.equal(member.weight,3.6);
  member.dead=13.6;close(assembleFrameLoads(model,factors).totals.fy,-93.6);
  member.dead=10;member.deadLoadMode='additional';close(assembleFrameLoads(model,factors).totals.fy,-93.6);
});

test('Distribucion uniforme y cargas nodales conservan signos, factores y momento global',()=>{
  const {model}=fixture();model.nodes[1].fx=4;model.nodes[1].fy=5;model.nodes[1].moment=-7;
  const f={dead:2,live:.5,nodal:3},loads=assembleFrameLoads(model,f);
  close(memberLineLoad(model.members[0],f),28.2);close(loads.totals.fx,12);close(loads.totals.fy,15-28.2*6);
  close(loads.totals.moment,-21-6*15+28.2*6*3);
  const result=solveFrame(model,f,'Signos');close(result.nodes.reduce((s,n)=>s+n.ry,0),-loads.totals.fy);
});

test('D total sin sustento queda como borrador persistible, pero no se calcula',()=>{
  const {model,project}=fixture(),member=model.members[0];member.deadLoadMode='includes-self-weight';member.loadReference='';
  assert.throws(()=>solveFrame(model,factors,'Incompleto'),/falta referencia/);
  const draft=parseProject(JSON.parse(JSON.stringify(project)));assert.equal(draft.analysis!.model.members[0].deadLoadMode,'includes-self-weight');
  assert.ok(buildLoadLedger(model,factors,project.elements).rows[0].notes.some(n=>n.includes('sin referencia')));
  member.deadLoadMode='unknown' as any;assert.throws(()=>parseProject(project),/Modo de carga/);
  member.deadLoadMode='additional';member.weight=-1;assert.throws(()=>assembleFrameLoads(model,factors));
  member.weight=3.6;member.dead=NaN;assert.throws(()=>assembleFrameLoads(model,factors));
});

test('Huecos y volumen neto se concilian sin inventar transferencia o densidad de losa',()=>{
  const db=BimDatabase.getInstance();db.clearAll();
  const p=(x:number,z:number)=>({x,y:0,z});
  const add=(d:StructuralDefinition)=>db.registerElement({definition:d,legacyId:crypto.randomUUID(),category:d.type,volume:0,levelName:'Nivel 1',dimensions:''});
  const beam=add({type:'beam',startPoint:p(0,0),endPoint:p(6,0),width:.3,height:.5});
  const slab=add({type:'slab',boundary:[p(0,0),p(6,0),p(6,4),p(0,4)],voids:[[p(1,1),p(2,1),p(2,2),p(1,2)]],thickness:.2,elevationY:0});
  const model=deriveAnalysis(db.getAllElements(),db.revision,{plane:'XY',ordinate:0,tolerance:.001,elasticModulusMPa:25000,unitWeight:24});
  beam.instanceParameters.quantityState='ready';beam.instanceParameters.netVolume=.8;
  const ledger=buildLoadLedger(model,factors,db.getAllElements()),b=ledger.rows.find(r=>r.sourceId===beam.uniqueId)!,s=ledger.rows.find(r=>r.sourceId===slab.uniqueId)!;
  close(s.grossVolume!,4.6);assert.equal(s.status,'transfer-pending');assert.equal(s.unitWeight,null);assert.equal(s.netReferenceWeight,null);
  close(b.grossVolume!,.9);close(b.netVolume!,.8);close(b.grossReferenceWeight!,21.6);close(b.netReferenceWeight!,19.2);
  close(ledger.assembled.totals.selfWeight,21.6);assert.equal(ledger.levels[0].pending,1);
  beam.instanceParameters.quantityState='pending';assert.equal(buildLoadLedger(model,factors,db.getAllElements()).rows[0].netVolume,null);
});

test('Tramos subdivididos se suman por GUID sin repetir el volumen fisico',()=>{
  const project=createExampleProject('office-8'),model=project.analysis!.model,ledger=buildLoadLedger(model,factors,project.elements);
  assert.equal(ledger.rows.length,827);assert.equal(ledger.rows.filter(r=>r.memberIds.length).length,88);assert.equal(ledger.assembled.members.length,136);
  const expectedPP=(.35*.65*24)*(4*6*7)+(.3*.6*24)*(4*4*7)+7*14.1*.7*.7*24+5*13.2*.55*.55*24;
  close(ledger.assembled.totals.selfWeight,expectedPP);
  close(ledger.rows.reduce((s,r)=>s+r.selfWeight,0),expectedPP);
  close(ledger.levels.reduce((s,l)=>s+l.downward,0),-ledger.assembled.totals.fy);
  assert.ok(ledger.rows.some(r=>r.memberIds.length===2));
});

test('No reutiliza reacciones ni emite memoria despues de cambiar cargas, factores o apoyos',()=>{
  const {model,project}=fixture(),result=solveFrame(model,factors,'Original');
  assert.equal(buildLoadLedger(model,factors,project.elements,result).resultState,'current');
  assert.match(analysisReport(model,result,factors,'data:image/png;base64,','supported'),/Balance de cargas/);
  model.members[0].dead++;
  const ledger=buildLoadLedger(model,factors,project.elements,result);assert.equal(ledger.resultState,'stale');assert.equal(ledger.equilibrium,null);
  assert.throws(()=>analysisReport(model,result,factors,'','supported'),/no vigentes/);
  model.members[0].dead--;assert.equal(buildLoadLedger(model,{...factors,dead:2},project.elements,result).equilibrium,null);
  model.nodes[0].support='fixed';assert.equal(buildLoadLedger(model,factors,project.elements,result).equilibrium,null);
});

test('CSV conserva fuentes, referencias y unidades sin ejecutar texto como formula',()=>{
  const {model,project}=fixture();project.elements[0].instanceParameters.mark='=1+1';model.members[0].loadReference='@referencia;"doble"';
  const ledger=buildLoadLedger(model,factors,project.elements),csv=loadLedgerCsv(ledger);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes("'@referencia"));assert.ok(csv.includes('""doble""'));
  assert.match(csv,/Fy aplicado \(kN\)/);assert.match(csv,/Declaracion D/);
  const saved=parseProject(JSON.parse(JSON.stringify(project)));assert.equal(saved.analysis!.model.members[0].loadReference,'@referencia;"doble"');
});
