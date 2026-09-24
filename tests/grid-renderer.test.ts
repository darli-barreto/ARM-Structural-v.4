import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { GridRenderer } from '../src/core/grid/rendering/GridRenderer';
import { GridSprites } from '../src/core/grid/rendering/GridSprites';
import type { GridElement } from '../src/config/structural.config';

test('reconstruye reticulas lineales y curvas con mapas e hitboxes coherentes', () => {
  const renderer = new GridRenderer();
  const line: GridElement = {
    id: 'grid-line',
    name: 'A',
    geomType: 'line',
    start: { x: 0, z: 0 },
    end: { x: 0, z: 12 },
    showStartBubble: false,
    showEndBubble: false,
  };
  const arc: GridElement = {
    id: 'grid-arc',
    name: 'B',
    geomType: 'arc',
    start: { x: 5, z: 0 },
    end: { x: 0, z: 5 },
    center: { x: 0, z: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: Math.PI / 2,
    showStartBubble: false,
    showEndBubble: false,
  };

  const bundle = renderer.rebuild([line, arc], null, null, 0, () => false);

  expect(bundle.lineMeshMap.size).toBe(2);
  expect(renderer.highlightMeshesMap.get(line.id)?.length).toBeGreaterThan(0);
  expect(renderer.highlightMeshesMap.get(arc.id)?.length).toBeGreaterThan(0);
  expect(bundle.gridHitMeshes.length).toBeGreaterThan(2);
  expect(bundle.gridHitMeshes.every(mesh => mesh.userData.isGridLineHit)).toBe(true);

  renderer.disposeAll();
  expect(renderer.highlightMeshesMap.size).toBe(0);
  expect(renderer.highlightsGroup.children).toHaveLength(0);

  renderer.rebuild([], null, null, 0, () => false);
  expect(renderer.lineMeshMap.size).toBe(0);
  expect(renderer.highlightMeshesMap.size).toBe(0);
  expect(renderer.hitProxiesGroup.children).toHaveLength(0);
});

test('renderiza burbujas, grips y controles de codo mediante el renderizador de extremos', () => {
  const originalBubble = GridSprites.createBubbleSprite;
  const originalCheckbox = GridSprites.createCheckboxSprite;
  const originalLock = GridSprites.createLockSprite;
  const originalElbow = GridSprites.createElbowIconSprite;
  GridSprites.createBubbleSprite = (() => new THREE.Sprite()) as typeof originalBubble;
  GridSprites.createCheckboxSprite = (() => new THREE.Sprite()) as typeof originalCheckbox;
  GridSprites.createLockSprite = (() => new THREE.Sprite()) as typeof originalLock;
  GridSprites.createElbowIconSprite = (() => new THREE.Sprite()) as typeof originalElbow;

  try {
    const renderer = new GridRenderer();
    const grid: GridElement = {
      id: 'grid-edit',
      name: 'A',
      geomType: 'line',
      start: { x: 0, z: 0 },
      end: { x: 0, z: 12 },
      showStartBubble: true,
      showEndBubble: true,
      startElbow: { active: true, lateralOffset: 2, breakDistance: 2 },
      endElbow: { active: true, lateralOffset: -2, breakDistance: 2 },
    };

    const bundle = renderer.rebuild([grid], grid.id, null, 0, () => true);

    expect(bundle.bubbleSpritesMap.get(grid.id)?.start).toBeDefined();
    expect(bundle.bubbleSpritesMap.get(grid.id)?.end).toBeDefined();
    expect(bundle.bubbleHits).toHaveLength(2);
    expect(bundle.gripHandles).toHaveLength(2);
    expect(bundle.toggleBoxes).toHaveLength(2);
    expect(bundle.elbowToggles).toHaveLength(2);
    expect(bundle.elbowGrips).toHaveLength(2);
    expect(bundle.elbowGrips.every(handle => handle.mesh.userData.isElbowGrip)).toBe(true);
    renderer.disposeAll();
  } finally {
    GridSprites.createBubbleSprite = originalBubble;
    GridSprites.createCheckboxSprite = originalCheckbox;
    GridSprites.createLockSprite = originalLock;
    GridSprites.createElbowIconSprite = originalElbow;
  }
});
