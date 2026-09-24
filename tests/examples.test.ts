import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createExampleProject } from '../src/core/model/ExampleProjects';
import { parseProject } from '../src/core/model/Project';
import { validateAnalysis } from '../src/core/analysis/Model';
import { solveFrame } from '../src/core/analysis/Solver';
import { benchmarkChecks, benchmarkMatches } from '../src/core/analysis/Benchmarks';
test('Oficinas: 8 niveles, retranqueo, 827 elementos y portico conectado sin tolerancia artificial',()=>{
  const p=parseProject(createExampleProject('office-8'));
  assert.equal(p.levels.length,9);assert.equal(p.elements.length,827);assert.ok(Math.abs(p.levels[8].elevation-27.3)<1e-10);
  assert.equal(p.elements.filter(e=>e.geometry.definition.type==='slab'&&e.geometry.definition.voids!.length>0).length,8);
  const {model,factors,caseName}=p.analysis!;assert.equal(model.tolerance,.001);assert.ok(!model.issues.some(i=>i.includes('ajustado')));
  // 48 column/beam centroid intersections subdivide the original 88 physical members.
  assert.equal(model.nodes.length,103);assert.equal(model.members.length,136);validateAnalysis(model);
  const r=solveFrame(model,factors,caseName);assert.ok(r.residual<1e-7);
  const expectedVertical=(43.8+18+.35*.65*24)*(4*6*7)+(43.8+18+.3*.6*24)*(3*4*7)+(34.8+6+.3*.6*24)*(4*7)+7*14.1*.7*.7*24+5*13.2*.55*.55*24;
  assert.ok(Math.abs(r.nodes.reduce((sum,n)=>sum+n.ry,0)-expectedVertical)<1e-5);
  assert.ok(model.members.some(m=>m.dead===43.8));assert.ok(model.members.some(m=>m.live===18));
});
for(const id of ['cantilever','supported'] as const)test(`Referencia ${id}: resultados contra solucion cerrada y deteccion de entradas modificadas`,()=>{
  const p=parseProject(createExampleProject(id)),setup=p.analysis!;validateAnalysis(setup.model);
  assert.equal(setup.benchmark,id);assert.ok(benchmarkMatches(id,setup.model,setup.factors));
  const result=solveFrame(setup.model,setup.factors,setup.caseName),checks=benchmarkChecks(id,result);
  assert.ok(checks.every(c=>c.pass),JSON.stringify(checks));
  setup.model.members[0].dead+=1;assert.equal(benchmarkMatches(id,setup.model,setup.factors),false);
});
