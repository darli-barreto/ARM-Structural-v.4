import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BimDatabase} from '../src/core/database/BimDatabase';
import {analyticalGraph,memberAxes,ANALYTICAL_GEOMETRY_VERSION} from '../src/core/analysis/AnalyticalGraph';
import {deriveAnalysis,matchesAnalyticalGeometry,validateAnalysis} from '../src/core/analysis/Model';
import {frameDocuments} from '../src/core/analysis/FrameView';
import {solveFrame} from '../src/core/analysis/Solver';
import {createExampleProject} from '../src/core/model/ExampleProjects';
import {parseProject} from '../src/core/model/Project';
import type {StructuralDefinition} from '../src/core/model/Geometry';

const db=BimDatabase.getInstance(),p=(x:number,y:number,z=0)=>({x,y,z});
const options={plane:'XY' as const,ordinate:0,tolerance:.001,elasticModulusMPa:25000,unitWeight:24};
const add=(d:StructuralDefinition)=>db.registerElement({definition:d,legacyId:crypto.randomUUID(),category:d.type,volume:0,levelName:'Nivel 1',dimensions:''});
function crossing(){
  db.clearAll();
  const column=add({type:'column',columnStyle:'vertical',basePoint:p(0,0),topPoint:p(0,3),width:.4,depth:.5});
  const beam=add({type:'beam',startPoint:p(-2,3),endPoint:p(2,3),width:.3,height:.6});
  return {column,beam};
}

test('Una sola topologia: centroides, IDs, referencias y tramos iguales entre vista y FEM',()=>{
  crossing();const docs=db.getAllElements(),graph=analyticalGraph(frameDocuments(docs,options)),model=deriveAnalysis(docs,db.revision,options);
  assert.equal(model.geometryVersion,ANALYTICAL_GEOMETRY_VERSION);assert.equal(model.members.length,4);assert.equal(model.nodes.length,5);
  assert.deepEqual(model.nodes.map(n=>[n.id,n.x,n.y,n.axisReferences]),graph.nodes.map(n=>[n.id,n.point.x,n.point.y,n.references]));
  assert.deepEqual(model.members.map(m=>[m.id,m.sourceId,m.start,m.end,m.sourceRange]),graph.members.map(m=>[m.id,m.sourceId,m.start,m.end,m.sourceRange]));
  assert.ok(model.nodes.some(n=>n.x===0&&Math.abs(n.y-2.7)<1e-12&&n.axisReferences!.length===2));
  assert.ok(matchesAnalyticalGeometry(model,docs));
  assert.deepEqual(deriveAnalysis([...docs].reverse(),db.revision,options),model);
});

test('Subdividir no duplica longitudes ni cargas; conserva equilibrio global',()=>{
  const {column,beam}=crossing(),docs=db.getAllElements(),model=deriveAnalysis(docs,db.revision,options);
  const nodes=new Map(model.nodes.map(n=>[n.id,n]));
  for(const doc of docs){
    const spans=model.members.filter(m=>m.sourceId===doc.uniqueId),axis=memberAxes(doc.geometry.definition)!;
    const length=spans.reduce((sum,m)=>{const a=nodes.get(m.start)!,b=nodes.get(m.end)!;return sum+Math.hypot(a.x-b.x,a.y-b.y);},0);
    assert.ok(Math.abs(length-axis.a.distanceTo(axis.b))<1e-12);
    assert.equal(spans[0].sourceRange![0],0);assert.equal(spans.at(-1)!.sourceRange![1],1);
    spans.slice(1).forEach((m,i)=>assert.equal(spans[i].sourceRange![1],m.sourceRange![0]));
  }
  model.nodes.find(n=>n.y===0)!.support='fixed';
  model.members.filter(m=>m.sourceId===beam.uniqueId).forEach(m=>{m.dead=10;});
  const result=solveFrame(model,{dead:1,live:0,nodal:1},'Subdivisiones');
  const expected=4*(10+.3*.6*24)+3*.4*.5*24;
  assert.ok(Math.abs(result.nodes.reduce((sum,n)=>sum+n.ry,0)-expected)<1e-8);
  assert.ok(result.residual<1e-8);assert.equal(model.members.filter(m=>m.sourceId===column.uniqueId).length,2);
});

test('No inventa brazos rigidos: un extremo fuera del eje permanece separado',()=>{
  db.clearAll();
  add({type:'column',columnStyle:'vertical',basePoint:p(0,0),topPoint:p(0,3),width:.4,depth:.4});
  add({type:'beam',startPoint:p(.2,3),endPoint:p(4,3),width:.3,height:.6});
  const model=deriveAnalysis(db.getAllElements(),db.revision,options);model.nodes.find(n=>n.y===0)!.support='fixed';
  assert.equal(model.nodes.length,4);assert.equal(model.members.length,2);
  assert.throws(()=>validateAnalysis(model),/sin restricciones/);
});

test('No conecta cruces proyectados fuera del plano; ZY usa el mismo grafo',()=>{
  db.clearAll();
  add({type:'beam',startPoint:p(0,3,-2),endPoint:p(0,3,2),width:.3,height:.4});
  add({type:'column',columnStyle:'vertical',basePoint:p(0,0),topPoint:p(0,3),width:.4,depth:.5});
  add({type:'beam',startPoint:p(-2,3,-1),endPoint:p(2,3,1),width:.3,height:.4});
  const opts={...options,plane:'ZY' as const},docs=db.getAllElements(),model=deriveAnalysis(docs,db.revision,opts),graph=analyticalGraph(frameDocuments(docs,opts));
  assert.equal(model.omitted,1);assert.equal(model.members.length,4);
  assert.deepEqual(model.nodes.map(n=>[n.x,n.y]),graph.nodes.map(n=>[n.point.z,n.point.y]));
});

test('Tolerancia registra ajustes y rechaza colapsos en vez de perder tramos',()=>{
  crossing();assert.throws(()=>deriveAnalysis(db.getAllElements(),db.revision,{...options,tolerance:.65}),/colapsados/);
  assert.throws(()=>analyticalGraph([],NaN),/Tolerancia/);
  db.clearAll();
  add({type:'beam',startPoint:p(0,1),endPoint:p(2,1),width:.3,height:.4});
  add({type:'beam',startPoint:p(2.0005,1),endPoint:p(4,1),width:.3,height:.4});
  const model=deriveAnalysis(db.getAllElements(),db.revision,options);
  assert.equal(model.nodes.length,3);assert.ok(model.issues.some(i=>i.includes('ajustado')));
  assert.ok(model.nodes.some(n=>n.axisReferences!.some(r=>Math.abs(r.adjustment-.0005)<1e-12)));
});

test('Detecta duplicados y modelos importados divergentes aunque declaren la version actual',()=>{
  const {beam}=crossing();add(beam.geometry.definition);
  const duplicates=deriveAnalysis(db.getAllElements(),db.revision,options);
  assert.throws(()=>validateAnalysis(duplicates),/duplicadas/);
  const project=createExampleProject('cantilever'),original=project.analysis!.model;
  assert.ok(matchesAnalyticalGeometry(original,project.elements));
  for(const corrupt of [
    (m:typeof original)=>{delete m.geometryVersion;},
    (m:typeof original)=>{m.nodes[0].y+=.1;},
    (m:typeof original)=>{m.members[0].area*=2;},
    (m:typeof original)=>{m.members[0].sourceRange=[0,.5];},
    (m:typeof original)=>{m.sourceVersions[m.members[0].sourceId]++;},
  ]){const copy=structuredClone(original);corrupt(copy);assert.equal(matchesAnalyticalGeometry(copy,project.elements),false);}
});

test('Proyectos conservan analisis obsoletos y sus cargas incluso al eliminar su elemento BIM',()=>{
  const project=createExampleProject('cantilever');delete project.analysis!.model.geometryVersion;
  const restored=parseProject(JSON.parse(JSON.stringify(project)));
  assert.equal(matchesAnalyticalGeometry(restored.analysis!.model,restored.elements),false);
  assert.equal(restored.analysis!.model.nodes[1].fy,-10);
  restored.elements=[];restored.analysis!.requiresRegeneration=true;
  assert.equal(parseProject(restored).analysis!.model.nodes[1].fy,-10);
  restored.analysis!.requiresRegeneration=false;assert.throws(()=>parseProject(restored));
});

test('Restaurar recalcula cantidades sin cambiar versiones de origen ni invalidar el plano',()=>{
  const project=createExampleProject('office-8');db.restoreElements(project.elements);
  assert.deepEqual(db.getAllElements().map(d=>d.metadata),project.elements.map(d=>d.metadata));
  assert.ok(matchesAnalyticalGeometry(project.analysis!.model,db.getAllElements()));
});
