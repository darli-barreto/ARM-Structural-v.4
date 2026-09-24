import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { BimDatabase } from '../src/core/database/BimDatabase';
import { analyticalGraph, memberAxes } from '../src/core/analysis/AnalyticalGraph';
import { reinforcementLedger, rebarPaths, RebarSpec } from '../src/core/model/Reinforcement';
import { StructuralDefinition } from '../src/core/model/Geometry';
import { scheduleRows } from '../src/core/model/Schedule';
const db=BimDatabase.getInstance(),p=(x:number,y:number,z:number)=>({x,y,z});
const beam:StructuralDefinition={type:'beam',startPoint:p(-2,3,0),endPoint:p(2,3,0),width:.4,height:.6};
const column:StructuralDefinition={type:'column',columnStyle:'vertical',basePoint:p(0,0,0),topPoint:p(0,3,0),width:.5,depth:.5};
const register=(definition:StructuralDefinition,id:string)=>db.registerElement({definition,legacyId:id,category:definition.type,volume:0,levelName:'Nivel 1',dimensions:''});
const spec:RebarSpec={status:'manual-unverified',cover:.04,diameter:16,barsU:2,barsV:2,tieDiameter:8,tieSpacing:.2};
test('Neutral axes respect beam centroid and split intersecting axes with shared nodes and GUIDs',()=>{
  db.clearAll();const a=register(column,'C'),b=register(beam,'B'),graph=analyticalGraph(db.getAllElements());
  assert.equal(memberAxes(beam)!.a.y,2.7);assert.equal(graph.members.length,4);assert.equal(graph.nodes.length,5);
  const junction=graph.nodes.find(n=>Math.abs(n.point.y-2.7)<1e-12&&n.point.x===0)!;
  assert.equal(graph.members.filter(m=>m.start===junction.id||m.end===junction.id).length,4);
  assert.deepEqual(new Set(graph.members.map(m=>m.sourceId)),new Set([a.uniqueId,b.uniqueId]));
});
test('Skew axes do not invent connections',()=>{
  db.clearAll();register(beam,'B');register({...column,basePoint:p(0,0,1),topPoint:p(0,3,1)},'C');
  const graph=analyticalGraph(db.getAllElements());assert.equal(graph.nodes.length,4);assert.equal(graph.members.length,2);
});
test('Derived quantities preserve model revision, reject stale and duplicate batches and invalidate on edit',()=>{
  db.clearAll();const a=register(column,'C'),b=register(beam,'B'),revision=db.revision;
  const row=(id:string)=>({id,gross:1,net:.75,deduction:.25,deductedBy:[]});
  assert.equal(db.applyJoinedQuantities(revision,[row(a.uniqueId),row(a.uniqueId)]),false);
  assert.equal(db.applyJoinedQuantities(revision-1,[row(a.uniqueId),row(b.uniqueId)]),false);
  assert.equal(db.applyJoinedQuantities(revision,[row(a.uniqueId),row(b.uniqueId)]),true);assert.equal(db.revision,revision);
  assert.equal(scheduleRows(db.getAllElements(),'category')[0].state,'Neto');
  db.updateGeometry(a.uniqueId,column);assert.ok(db.getAllElements().every(d=>d.instanceParameters.quantityState==='pending'));
  assert.ok(Number.isNaN(scheduleRows(db.getAllElements(),'level')[0].volume));
});
test('Explicit bar cages follow inclined members and use actual lengths, not a concrete ratio',()=>{
  db.clearAll();const doc=register(beam,'B');db.setReinforcement(doc.uniqueId,spec);
  const paths=rebarPaths(beam,spec);assert.equal(paths.filter(p=>p.diameter===16).length,4);
  const ledger=reinforcementLedger(db.getAllElements());assert.ok(ledger.mass.get(doc.uniqueId)!>0);assert.equal(ledger.errors.length,0);
  const duplicate=register(beam,'B2');db.setReinforcement(duplicate.uniqueId,spec);const result=reinforcementLedger(db.getAllElements());
  assert.equal(result.mass.get(duplicate.uniqueId),0);assert.equal(result.paths.length,paths.length);
  assert.throws(()=>rebarPaths({...beam,width:.05},spec));
  db.updateGeometry(doc.uniqueId,{...beam,width:.05});assert.equal(reinforcementLedger(db.getAllElements()).errors.length,1);
});
