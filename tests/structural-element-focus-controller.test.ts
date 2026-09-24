import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { StructuralElementFocusController } from '../src/features/application/StructuralElementFocusController';
import type { ManagedElement } from '../src/tools/structural/types';
import type { Viewer } from '../src/core/Viewer';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { PlacementPreview } from '../src/tools/PlacementPreview';
import type { SelectionManager } from '../src/tools/SelectionManager';
import type { Sidebar } from '../src/features/sidebar/SidebarController';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';

test('enfoca, selecciona y muestra propiedades del elemento en modo físico 3D', () => {
  const calls: unknown[] = [];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2), new THREE.MeshBasicMaterial());
  mesh.position.set(20, 7, -5);
  const originalUpdate = mesh.updateMatrixWorld.bind(mesh);
  mesh.updateMatrixWorld = force => { calls.push(['update-matrix', force]); return originalUpdate(force); };
  const element = { id: 'beam-23', elementId: 23, mesh } as unknown as ManagedElement;
  const view = {
    modelMode: 'analytical',
    camera: new THREE.PerspectiveCamera(),
    controls: { target: new THREE.Vector3(), update: () => calls.push('update-controls') },
  };
  const controller = new StructuralElementFocusController({
    viewer: {
      viewManager: {
        openView: id => calls.push(['open-view', id]),
        views: new Map([['view-3d', view]]),
        getActiveView: () => view,
      },
    } as unknown as Viewer,
    gridSystem: { selectGrid: id => calls.push(['select-grid', id]) } as unknown as GridSystem,
    levelSystem: { selectLevel: id => calls.push(['select-level', id]) } as unknown as LevelSystem,
    preview: { hide: () => calls.push('hide-preview') } as unknown as PlacementPreview,
    selection: { select: item => calls.push(['select-element', item]) } as unknown as SelectionManager,
    sidebar: { showElementProperties: item => calls.push(['show-properties', item]) } as unknown as Sidebar,
    footer: { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    setSelectionTool: () => calls.push(['tool', 'select']),
  });

  controller.focus(element);

  expect(calls.slice(0, 6)).toEqual([
    ['tool', 'select'], 'hide-preview', ['select-grid', null], ['select-level', null],
    ['open-view', 'view-3d'], ['update-matrix', true],
  ]);
  expect(view.modelMode).toBe('physical');
  expect(view.controls.target.toArray()).toEqual([20, 7, -5]);
  const expectedDistance = 6 * 2.8;
  expect(view.camera.position.distanceTo(view.controls.target)).toBeCloseTo(expectedDistance * Math.sqrt(0.75 ** 2 + 0.65 ** 2 + 0.75 ** 2), 8);
  expect(calls.slice(6)).toEqual([
    'update-controls', ['select-element', element], ['show-properties', element],
    ['message', 'Elemento beam-23 (ID: 23) enfocado y resaltado en 3D.'],
  ]);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});
