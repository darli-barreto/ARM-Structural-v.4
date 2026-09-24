import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { ExampleProjectLoader } from '../src/features/application/ExampleProjectLoader';
import type { Viewer } from '../src/core/Viewer';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { StructuralManager } from '../src/tools/StructuralManager';
import type { ProjectController } from '../src/features/project/ProjectController';
import type { PlacementPreview } from '../src/tools/PlacementPreview';
import type { SnappingManager } from '../src/tools/SnappingManager';
import type { HeaderRibbon } from '../src/features/ribbon/HeaderRibbonController';
import type { Sidebar } from '../src/features/sidebar/SidebarController';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';
import type { AnalysisPanel } from '../src/features/analysis/AnalysisPanelController';

test('carga un ejemplo, restablece el estado del workspace y encuadra el modelo 3D', async () => {
  const calls: unknown[] = [];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial());
  mesh.position.set(10, 5, -3);
  const camera = new THREE.PerspectiveCamera();
  const controls = { target: new THREE.Vector3(), update: () => calls.push('update-controls') };
  const view = { camera, controls };
  const loader = new ExampleProjectLoader({
    projectController: {
      loadExample: async project => { calls.push(['load-example', project]); return true; },
    } as unknown as ProjectController,
    ribbon: { setTool: tool => calls.push(['tool', tool]) } as unknown as HeaderRibbon,
    preview: { hide: () => calls.push('hide-preview') } as unknown as PlacementPreview,
    gridSystem: {
      selectGrid: id => calls.push(['select-grid', id]),
      setActiveLevel: id => calls.push(['active-grid-level', id]),
    } as unknown as GridSystem,
    levelSystem: { selectLevel: id => calls.push(['select-level', id]) } as unknown as LevelSystem,
    snapping: { activeLevelIdx: 4 } as unknown as SnappingManager,
    sidebar: { showEmptyProperties: () => calls.push('empty-properties') } as unknown as Sidebar,
    viewer: {
      viewManager: {
        openView: id => calls.push(['open-view', id]),
        views: new Map([['view-3d', view]]),
      },
    } as unknown as Viewer,
    structural: {
      registry: { getAll: () => [{ mesh }] },
      elementCount: 1,
    } as unknown as StructuralManager,
    footer: { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    analysisPanel: { open: () => calls.push('open-analysis') } as unknown as AnalysisPanel,
  });

  expect(await loader.load('supported', true)).toBe(true);
  expect(calls.slice(1, 8)).toEqual([
    ['tool', 'select'],
    'hide-preview',
    ['select-grid', null],
    ['select-level', null],
    ['active-grid-level', 0],
    'empty-properties',
    ['open-view', 'view-3d'],
  ]);
  expect(calls[0][0]).toBe('load-example');
  expect(calls[0][1].analysis.benchmark).toBe('supported');
  expect(controls.target.toArray()).toEqual([10, 5, -3]);
  const expectedDistance = Math.max(new THREE.Vector3(2, 4, 6).length() / 2, 3) /
    Math.sin(THREE.MathUtils.degToRad(25)) * 1.15;
  expect(camera.position.distanceTo(controls.target)).toBeCloseTo(expectedDistance, 8);
  expect(calls).toContain('update-controls');
  expect(calls).toContainEqual(['message', 'Viga biapoyada / carga uniforme: 1 elementos / ejemplo no certificado.']);

  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toContain('open-analysis');
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

test('si ProjectController cancela el reemplazo no cambia el estado de la escena', async () => {
  const calls: unknown[] = [];
  const loader = new ExampleProjectLoader({
    projectController: { loadExample: async () => { calls.push('confirm-replacement'); return false; } } as unknown as ProjectController,
    ribbon: {} as HeaderRibbon,
    preview: {} as PlacementPreview,
    gridSystem: {} as GridSystem,
    levelSystem: {} as LevelSystem,
    snapping: { activeLevelIdx: 2 } as unknown as SnappingManager,
    sidebar: {} as Sidebar,
    viewer: {} as Viewer,
    structural: {} as StructuralManager,
    footer: {} as FooterStatusBar,
    analysisPanel: {} as AnalysisPanel,
  });

  expect(await loader.load('cantilever', false)).toBe(false);
  expect(calls).toEqual(['confirm-replacement']);
});
