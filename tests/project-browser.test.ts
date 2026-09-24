import { test } from 'bun:test';
import assert from 'node:assert/strict';
import type { Level } from '../src/core/level/types/LevelTypes';
import type { BimView } from '../src/core/views/BimView';
import { projectBrowserStore } from '../src/features/project-browser/ProjectBrowserStore';

test('El navegador recibe snapshots planos, filtra vistas internas y omite actualizaciones idénticas', () => {
  const level: Level = {
    id: 'level-1', name: 'Nivel 1 (+0.00m)', elevation: 0,
    start: { x: 0, z: 0 }, end: { x: 10, z: 0 },
    showStartBubble: true, showEndBubble: true, isLocked: false, hasPlanView: true,
  };
  const views = [
    { id: 'view-3d', title: '{3D} - Vista General', type: '3d' },
    { id: 'plan-level-1', title: 'Planta - Nivel 1 (+0.00m)', type: 'plan' },
    { id: 'dual-peer', title: 'Modelo vinculado', type: '3d' },
  ] as unknown as BimView[];
  let notifications = 0;
  const unsubscribe = projectBrowserStore.subscribe(() => notifications++);

  projectBrowserStore.update([level], views, 'view-3d');
  const firstSnapshot = projectBrowserStore.getSnapshot();
  assert.equal(firstSnapshot.levels[0].id, 'level-1');
  assert.equal(firstSnapshot.views.some(view => view.id === 'dual-peer'), false);
  assert.equal(firstSnapshot.views.length, 2);
  assert.equal(notifications, 1);

  projectBrowserStore.update([level], views, 'view-3d');
  assert.equal(notifications, 1);
  level.name = 'Renombrado después del snapshot';
  assert.equal(projectBrowserStore.getSnapshot().levels[0].name, 'Nivel 1 (+0.00m)');
  projectBrowserStore.update([level], views, 'view-3d');
  assert.equal(notifications, 2);

  unsubscribe();
  projectBrowserStore.update([], [], 'view-3d');
});
