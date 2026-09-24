import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { LevelRenderer } from '../src/core/level/rendering/LevelRenderer';
import { LevelSprites } from '../src/core/level/rendering/LevelSprites';
import type { Level } from '../src/core/level/types/LevelTypes';

const createLevel = (): Level => ({
  id: 'level-1',
  name: 'Nivel 1',
  elevation: 3.2,
  start: { x: -8, z: -6 },
  end: { x: 8, z: 6 },
  showStartBubble: true,
  showEndBubble: true,
  isLocked: false,
  hasPlanView: true,
  startElbow: { active: true, verticalOffset: 0.4, breakDistance: 1.6 },
  endElbow: { active: true, verticalOffset: -0.4, breakDistance: 1.6 },
});

test('LevelRenderer delega el renderizado simétrico de extremos y recoge todos los controles', () => {
  const originals = {
    head: LevelSprites.createLevelHeadSprite,
    elbow: LevelSprites.createElbowToggleSprite,
    checkbox: LevelSprites.createCheckboxSprite,
    grip: LevelSprites.createGripHandle,
    elbowGrip: LevelSprites.createElbowGripHandle,
  };
  LevelSprites.createLevelHeadSprite = (() => new THREE.Sprite()) as typeof originals.head;
  LevelSprites.createElbowToggleSprite = (() => new THREE.Sprite()) as typeof originals.elbow;
  LevelSprites.createCheckboxSprite = (() => new THREE.Sprite()) as typeof originals.checkbox;
  LevelSprites.createGripHandle = (() => ({ visual: new THREE.Group(), hitMesh: new THREE.Mesh() })) as typeof originals.grip;
  LevelSprites.createElbowGripHandle = (() => ({ visual: new THREE.Group(), hitMesh: new THREE.Mesh() })) as typeof originals.elbowGrip;

  try {
    const renderer = new LevelRenderer();
    const level = createLevel();
    renderer.rebuild([level], level.id, null);

    expect(renderer.headSpritesMap.get(level.id)).toHaveLength(4);
    expect(renderer.bubbleHits).toHaveLength(4);
    expect(renderer.elbowToggles).toHaveLength(2);
    expect(renderer.bubbleToggles).toHaveLength(2);
    expect(renderer.grips).toHaveLength(2);
    expect(renderer.elbowGrips).toHaveLength(2);
    expect(renderer.lineMeshMap.get(level.id)).toHaveLength(7);
    expect(renderer.levelHitMeshes).toHaveLength(10);

    level.showStartBubble = false;
    renderer.rebuild([level], level.id, null);

    expect(renderer.headSpritesMap.get(level.id)).toHaveLength(2);
    expect(renderer.bubbleHits).toHaveLength(2);
    expect(renderer.elbowToggles).toHaveLength(1);
    expect(renderer.bubbleToggles).toHaveLength(2);
    expect(renderer.grips).toHaveLength(2);
    expect(renderer.elbowGrips).toHaveLength(1);
    expect(renderer.lineMeshMap.get(level.id)).toHaveLength(5);

    renderer.dispose();
    expect(renderer.lineMeshMap.size).toBe(0);
    expect(renderer.headSpritesMap.size).toBe(0);
    expect(renderer.hitProxiesGroup.children).toHaveLength(0);
    expect(renderer.controlsGroup.children).toHaveLength(0);
  } finally {
    LevelSprites.createLevelHeadSprite = originals.head;
    LevelSprites.createElbowToggleSprite = originals.elbow;
    LevelSprites.createCheckboxSprite = originals.checkbox;
    LevelSprites.createGripHandle = originals.grip;
    LevelSprites.createElbowGripHandle = originals.elbowGrip;
  }
});
