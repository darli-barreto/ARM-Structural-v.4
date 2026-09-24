import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { clearThreeGroup } from '../src/core/rendering/ThreeResourceDisposal';

test('limpia recursos anidados y evita liberar dos veces recursos compartidos', () => {
  const group = new THREE.Group();
  const nested = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial();
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const disposed = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => disposed.geometry++);
  material.addEventListener('dispose', () => disposed.material++);
  texture.addEventListener('dispose', () => disposed.texture++);

  nested.add(new THREE.Mesh(geometry, material));
  nested.add(new THREE.Mesh(geometry, material));
  group.add(nested, new THREE.Sprite(spriteMaterial));

  clearThreeGroup(group);

  expect(group.children).toHaveLength(0);
  expect(disposed).toEqual({ geometry: 1, material: 1, texture: 1 });
});
