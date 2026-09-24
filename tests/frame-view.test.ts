import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { frameDocuments, segmentInFrame } from '../src/core/analysis/FrameView';
import { createExampleProject } from '../src/core/model/ExampleProjects';
import { memberAxes } from '../src/core/analysis/AnalyticalGraph';
const p=(x:number,y:number,z:number)=>({x,y,z});
test('Frame membership uses both neutral-axis endpoints, not projected crossings',()=>{
  assert.equal(segmentInFrame(p(0,0,0),p(5,3,0),{plane:'XY',ordinate:0}),true);
  assert.equal(segmentInFrame(p(0,0,-1),p(0,3,1),{plane:'XY',ordinate:0}),false);
  assert.equal(segmentInFrame(p(0,0,0),p(0,3,.002),{plane:'XY',ordinate:0}),false);
  assert.equal(segmentInFrame(p(2,0,0),p(2,3,5),{plane:'ZY',ordinate:2}),true);
  assert.equal(segmentInFrame(p(0,0,0),p(1,3,0),{plane:'ZY',ordinate:0}),false);
  assert.equal(segmentInFrame(p(0,0,0),p(1,3,0),{plane:'XY',ordinate:NaN}),false);
});
test('Frame filter excludes slab contours and off-plane frames without changing sources or FEM setup',()=>{
  const project=createExampleProject('office-8'),before=JSON.stringify(project);
  const all=frameDocuments(project.elements,{plane:'all',ordinate:0}),xy=frameDocuments(project.elements,{plane:'XY',ordinate:0}),zy=frameDocuments(project.elements,{plane:'ZY',ordinate:0});
  assert.ok(all.every(d=>['beam','column'].includes(d.geometry.definition.type)));assert.equal(xy.length,88);assert.ok(zy.length>0&&zy.length<all.length);
  for(const doc of xy){const axis=memberAxes(doc.geometry.definition)!;assert.ok(Math.abs(axis.a.z)<.001&&Math.abs(axis.b.z)<.001);}
  assert.equal(frameDocuments(project.elements,{plane:'XY',ordinate:100}).length,0);
  assert.equal(JSON.stringify(project),before);
});
