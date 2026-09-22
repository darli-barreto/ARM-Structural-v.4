import * as THREE from 'three';
import { GridElement, GridElbowData } from '../../../config/structural.config';

export type { GridElbowData };

export interface GripHandle {
  gridId: string;
  end: 'start' | 'end';
  mesh: THREE.Mesh;
}

export interface ElbowGripHandle {
  gridId: string;
  end: 'start' | 'end';
  mesh: THREE.Mesh;
}

export interface ElbowToggleHit {
  gridId: string;
  end: 'start' | 'end';
  mesh: THREE.Mesh;
}

export interface BubbleHitProxy {
  gridId: string;
  end: 'start' | 'end';
  mesh: THREE.Mesh;
  worldPos: THREE.Vector3;
}

export interface BubbleToggleHit {
  gridId: string;
  end: 'start' | 'end';
  mesh: THREE.Mesh;
}

export interface AlignedDragItem {
  gridId: string;
  end: 'start' | 'end';
  originalCoord: number;
}

export type GridDisplayMode = 'all' | 'active' | 'none';

export interface GridRenderBundle {
  lineMeshMap: Map<string, THREE.Line>;
  bubbleSpritesMap: Map<string, { start?: THREE.Sprite; end?: THREE.Sprite }>;
  gripHandles: GripHandle[];
  elbowGrips: ElbowGripHandle[];
  elbowToggles: ElbowToggleHit[];
  toggleBoxes: BubbleToggleHit[];
  gridHitMeshes: THREE.Mesh[];
  bubbleHits: BubbleHitProxy[];
}
