import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { ModificationTools } from '../src/tools/structural/ModificationTools';
import type { ManagedElement } from '../src/tools/structural/types';
import type { WasmBridge } from '../src/kernel/WasmBridge';

test('ModificationTools conserva su fachada pública y delega el estado de cada herramienta', () => {
  const messages: string[] = [];
  const scene = new THREE.Scene();
  const tools = new ModificationTools(
    scene,
    {} as WasmBridge,
    {} as never,
    {} as never,
    () => 'realistic',
    message => messages.push(message),
    () => {},
  );

  tools.startAlign();
  expect(tools.isAlignActive).toBe(true);
  tools.setReference({ type: 'grid', label: 'Eje A', point: { x: 2, y: 0, z: 0 }, axis: 'X', coordinate: 2 });
  expect(tools.alignStep).toBe('pick_target');
  expect(tools.currentReference?.label).toBe('Eje A');
  tools.cancelAlign();
  expect(tools.isAlignActive).toBe(false);
  expect(tools.currentReference).toBeNull();

  tools.startArray({} as ManagedElement);
  expect(tools.isArrayActive).toBe(true);
  tools.arrayConfig = { type: 'radial', count: 5, spacingMethod: 'last', angleDegrees: 180 };
  expect(tools.arrayConfig.type).toBe('radial');
  tools.cancelArray();
  expect(tools.isArrayActive).toBe(false);
  expect(messages).toHaveLength(5);
  expect(scene.children).toHaveLength(0);
});
