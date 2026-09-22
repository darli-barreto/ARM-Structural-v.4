import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantities,validateDefinition,SlabDefinition } from '../src/core/model/Geometry';
import { BimDatabase } from '../src/core/database/BimDatabase';
import { scheduleRows,scheduleCsv } from '../src/core/model/Schedule';
import { parseProject } from '../src/core/model/Project';
import { deriveAnalysis } from '../src/core/analysis/Model';
const p=(x:number,z:number)=>({x,y:0,z});
const slab:SlabDefinition={type:'slab',boundary:[p(0,0),p(6,0),p(6,4),p(0,4)],voids:[[p(1,1),p(2,1),p(2,2),p(1,2)]],thickness:.2,elevationY:0};
test('Losa: resta el hueco y conserva cantidades sin redondear',()=>{assert.equal(quantities(slab).surfaceArea,23);assert.ok(Math.abs(quantities(slab).volume-4.6)<1e-12);});
test('Rechaza cruces, huecos fuera, superpuestos, vertices repetidos y dimensiones negativas',()=>{
  assert.throws(()=>validateDefinition({...slab,boundary:[p(0,0),p(6,4),p(6,0),p(0,4)]}));
  assert.throws(()=>validateDefinition({...slab,voids:[[p(9,9),p(10,9),p(10,10)]]}));
  assert.throws(()=>validateDefinition({...slab,voids:[slab.voids![0],slab.voids![0]]}));
  assert.throws(()=>validateDefinition({...slab,boundary:[p(0,0),p(6,0),p(6,0),p(0,4)]}));
  assert.throws(()=>validateDefinition({...slab,thickness:-1}));
});
test('Contorno concavo valido y zapata rectangular',()=>{
  validateDefinition({...slab,voids:[],boundary:[p(0,0),p(4,0),p(4,2),p(2,2),p(2,4),p(0,4)]});
  const q=quantities({type:'footing',center:p(0,0),width:2,length:3,height:.5});assert.equal(q.volume,3);assert.equal(q.surfaceArea,5);
});
test('Edicion geometrica sincroniza documento, longitud, costo y exportacion restaurable',()=>{
  const db=BimDatabase.getInstance();db.clearAll();
  const doc=db.registerElement({definition:{type:'beam',startPoint:p(0,0),endPoint:p(5,0),width:.3,height:.5},legacyId:'VIG-1',category:'beam',volume:1,levelName:'Nivel 1',dimensions:'',coordinates:p(0,0)});
  db.updateGeometry(doc.uniqueId,{type:'beam',startPoint:p(0,0),endPoint:p(5,0),width:.3,height:.5});
  assert.equal(doc.instanceParameters.length,5);assert.equal(doc.instanceParameters.volume,.75);assert.equal(doc.instanceParameters.surfaceArea,6.5);assert.equal(doc.instanceParameters.estimatedCost,.75*165);
  const project=parseProject({format:'arm-project',schemaVersion:1,projectId:'test',savedAt:'',units:{length:'m',force:'kN',stress:'MPa'},code:'RNE-PE',elements:db.getAllElements(),levels:[],grids:[]});
  const originalId=doc.uniqueId;db.clearAll();db.restoreElements(project.elements);assert.deepEqual(db.getByGuid(originalId)!.geometry.definition,doc.geometry.definition);
  assert.throws(()=>parseProject({...project,elements:[...project.elements,...project.elements]}));
  const rows=scheduleRows(db.querySchedule({search:doc.instanceParameters.mark}).records,'instance');assert.equal(rows.length,1);assert.match(scheduleCsv(rows),/0.750/);
  rows[0].mark='=1+1';assert.ok(scheduleCsv(rows).includes("'=1+1"));
  const model=deriveAnalysis(db.getAllElements(),db.revision,{plane:'XY',ordinate:0,tolerance:.001,elasticModulusMPa:25000,unitWeight:24});assert.equal(model.members.length,1);assert.equal(model.members[0].sourceId,originalId);assert.equal(model.members[0].area,.15);
});
test('Cambio de tipo y desfase actualizan geometria; cantidades no se sobrescriben manualmente',()=>{
  const db=BimDatabase.getInstance();db.clearAll();
  const doc=db.registerElement({definition:slab,legacyId:'LOS-1',category:'slab',volume:0,levelName:'Nivel 1',dimensions:''});
  db.changeElementType(doc.uniqueId,'LOS-0.15');assert.equal(doc.geometry.definition.type,'slab');
  assert.ok(Math.abs(doc.instanceParameters.volume-23*.15)<1e-12);
  db.updateInstanceParameters(doc.uniqueId,{baseOffset:2,volume:999});
  assert.equal(doc.geometry.definition.type==='slab'&&doc.geometry.definition.elevationY,2);
  assert.ok(Math.abs(doc.instanceParameters.volume-23*.15)<1e-12);
  assert.throws(()=>db.changeElementType(doc.uniqueId,'COL-0.4x0.4'));
  db.updateTypeParameters('LOS-0.15',{thickness:.25});assert.ok(Math.abs(doc.instanceParameters.volume-23*.25)<1e-12);
  const saved=structuredClone(db.getAllElements());db.clearAll();db.restoreElements(saved);
  const restored=db.getByGuid(doc.uniqueId)!;
  assert.equal(restored.typeId,'LOS-0.15');assert.equal(restored.familyType,doc.familyType);
  assert.equal(restored.typeParameters.thickness,.25);assert.equal(restored.instanceParameters.volume,doc.instanceParameters.volume);
});
