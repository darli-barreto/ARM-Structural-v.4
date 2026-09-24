import { test } from 'bun:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { resolvePhysicalJoins,JoinInput } from '../src/core/model/PhysicalJoins';
const api=await Module();api.setup();
const p=(x:number,y:number,z:number)=>({x,y,z});
const column:JoinInput={id:'column',elementId:2,definition:{type:'column',columnStyle:'vertical',basePoint:p(0,0,0),topPoint:p(0,3,0),width:1,depth:1}};
const beam:JoinInput={id:'beam',elementId:1,definition:{type:'beam',startPoint:p(-2,3,0),endPoint:p(2,3,0),width:.5,height:.5}};
const slab:JoinInput={id:'slab',elementId:3,definition:{type:'slab',boundary:[p(-2,0,-2),p(2,0,-2),p(2,0,2),p(-2,0,2)],thickness:.2,elevationY:2.8}};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('Boolean joins: column > beam > slab; triple intersection deducted once',()=>{
  const rows=resolvePhysicalJoins(api,[slab,beam,column]);
  near(rows[0].net,3);near(rows[1].net,.75);near(rows[2].net,3.2-.2-.3);
  near(rows.reduce((s,r)=>s+r.net,0),6.45);
  assert.deepEqual(rows[2].deductedBy,['column','beam']);
  const reversed=resolvePhysicalJoins(api,[column,beam,slab]);assert.deepEqual(rows.map(r=>r.net),reversed.map(r=>r.net));
});
test('Identical elements have deterministic ownership; touching faces are not deducted',()=>{
  const rows=resolvePhysicalJoins(api,[column,{...column,id:'copy',elementId:5},{...column,id:'touch',elementId:6,definition:{...column.definition,type:'column',columnStyle:'vertical',basePoint:p(1,0,0),topPoint:p(1,3,0),width:1,depth:1}}]);
  near(rows[1].net,0);near(rows[2].net,3);
});
test('Holes remain empty; oblique solids use actual geometry',()=>{
  const d=slab.definition;if(d.type!=='slab')throw Error();
  const rows=resolvePhysicalJoins(api,[column,{...slab,definition:{...d,voids:[[p(-.6,0,-.6),p(.6,0,-.6),p(.6,0,.6),p(-.6,0,.6)]]}}]);
  near(rows[1].deduction,0);
  const diagonal={...beam,definition:{type:'beam' as const,startPoint:p(-2,3,-2),endPoint:p(2,3,2),width:.5,height:.5}};
  const cuts=resolvePhysicalJoins(api,[column,diagonal]);
  assert.ok(cuts[1].deduction>0&&cuts[1].deduction<.5);
});
