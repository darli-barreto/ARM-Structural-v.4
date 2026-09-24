import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { solveFrame } from '../src/core/analysis/Solver';
import { AnalysisModel } from '../src/core/analysis/Model';
const model=():AnalysisModel=>({revision:1,plane:'XY',ordinate:0,tolerance:.001,issues:[],omitted:0,sourceVersions:{beam:1},nodes:[{id:'A',x:0,y:0,support:'fixed',fx:0,fy:0,moment:0},{id:'B',x:3,y:0,support:'free',fx:0,fy:-10,moment:0}],members:[{id:'b',sourceId:'beam',mark:'V-1',start:'A',end:'B',area:.06,inertia:.00045,height:.3,elasticModulusMPa:30000,poisson:.2,weight:0,dead:0,live:0,releaseStart:false,releaseEnd:false}]});
test('Voladizo: desplazamiento Timoshenko y reaccion coinciden con solucion cerrada',()=>{
  const r=solveFrame(model(),{dead:1,live:1,nodal:1},'Referencia');
  const expected=-10*27/(3*30e6*.00045)-10*3/((5/6)*(30e6/2.4)*.06);
  assert.ok(Math.abs(r.nodes[1].uy-expected)<1e-9,`${r.nodes[1].uy} != ${expected}`);
  assert.ok(Math.abs(r.nodes[0].ry-10)<1e-8);assert.ok(Math.abs(Math.abs(r.nodes[0].rm)-30)<1e-8);assert.ok(r.residual<1e-8);
});
test('Viga simplemente apoyada: qL/2 y qL2/8',()=>{
  const m=model();m.nodes[0].support='pinned';m.nodes[1].support='roller';m.nodes[1].fy=0;m.members[0].dead=5;
  const r=solveFrame(m,{dead:1,live:0,nodal:0},'Uniforme');assert.ok(Math.abs(r.nodes[0].ry-7.5)<1e-8);assert.ok(Math.abs(r.nodes[1].ry-7.5)<1e-8);assert.ok(Math.abs(Math.max(...r.members[0].moment.map(Math.abs))-5*9/8)<1e-8);
});
test('Rechaza modelo sin apoyos y cargas no finitas',()=>{
  const m=model();m.nodes[0].support='free';assert.throws(()=>solveFrame(m,{dead:1,live:1,nodal:1},'Inestable'));
  const n=model();n.nodes[1].fy=NaN;assert.throws(()=>solveFrame(n,{dead:1,live:1,nodal:1},'Invalido'));
});
test('Columna vertical: transformacion de ejes y equilibrio de momentos',()=>{
  const m=model();m.nodes[1].x=0;m.nodes[1].y=3;m.nodes[1].fy=0;m.nodes[1].fx=10;
  const r=solveFrame(m,{dead:1,live:0,nodal:1},'Horizontal');
  assert.ok(r.nodes[1].ux>0);assert.ok(Math.abs(r.nodes[0].rx+10)<1e-8);assert.ok(Math.abs(Math.abs(r.nodes[0].rm)-30)<1e-8);assert.ok(r.residual<1e-8);
});
