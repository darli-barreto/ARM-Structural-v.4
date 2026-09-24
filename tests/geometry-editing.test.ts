import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { AxisConstraint, slideEdge, translateDefinition } from '../src/core/model/GeometryEditing';
import { quantities, validateDefinition, StructuralDefinition, Vector3D } from '../src/core/model/Geometry';
const p=(x:number,z:number):Vector3D=>({x,y:0,z});
const ring=[p(0,0),p(6,0),p(6,4),p(0,4)];
test('Borde rectangular ignora desplazamiento tangencial y conserva lados ortogonales',()=>{
  assert.deepEqual(slideEdge(ring,0,p(2,1)),[p(0,1),p(6,1),p(6,4),p(0,4)]);
  assert.deepEqual(ring,[p(0,0),p(6,0),p(6,4),p(0,4)]);
  assert.deepEqual(slideEdge(ring,3,p(1,2)),[p(1,0),p(6,0),p(6,4),p(1,4)]);
});
test('Borde oblicuo conserva la direccion de ambos vecinos',()=>{
  const source=[p(0,0),p(4,2),p(5,6),p(-1,4)],out=slideEdge(source,0,p(1,-1));
  const cross=(a:Vector3D,b:Vector3D,c:Vector3D,d:Vector3D)=>(b.x-a.x)*(d.z-c.z)-(b.z-a.z)*(d.x-c.x);
  for(const i of [0,1,3])assert.ok(Math.abs(cross(source[i],source[(i+1)%4],out[i],out[(i+1)%4]))<1e-9);
});
test('Vertices intermedios colineales se desplazan juntos, tambien en el cierre del anillo',()=>{
  assert.deepEqual(slideEdge([p(0,0),p(3,0),p(6,0),p(6,4),p(0,4)],1,p(8,1)),[p(0,1),p(3,1),p(6,1),p(6,4),p(0,4)]);
  assert.deepEqual(slideEdge([p(3,0),p(6,0),p(6,4),p(0,4),p(0,0)],4,p(8,1)),[p(3,1),p(6,1),p(6,4),p(0,4),p(0,1)]);
});
test('Ctrl fija el eje dominante hasta soltar y no altera la coordenada perpendicular',()=>{
  const lock=new AxisConstraint();assert.deepEqual(lock.constrain(p(2,.5),true),p(2,0));
  assert.deepEqual(lock.constrain(p(1,5),true),p(1,0));
  assert.deepEqual(lock.constrain(p(1,5),false),p(1,5));
  assert.deepEqual(lock.constrain(p(1,5),true),p(0,5));
});
test('Mover conserva geometria, huecos y cantidades de todos los tipos',()=>{
  const defs:StructuralDefinition[]=[{type:'slab',boundary:ring,voids:[[p(1,1),p(2,1),p(2,2),p(1,2)]],thickness:.2,elevationY:0},{type:'beam',startPoint:p(0,0),endPoint:p(4,0),width:.3,height:.5},{type:'column',columnStyle:'vertical',basePoint:p(0,0),topPoint:{x:0,y:3,z:0},width:.4,depth:.4},{type:'footing',center:p(0,0),width:2,length:3,height:.6}];
  defs.forEach(d=>{const copy=structuredClone(d),moved=translateDefinition(d,{x:2,y:3,z:4});validateDefinition(moved);assert.ok(Math.abs(quantities(moved).volume-quantities(d).volume)<1e-9);assert.deepEqual(d,copy);assert.deepEqual(translateDefinition(moved,{x:-2,y:-3,z:-4}),d);});
});
