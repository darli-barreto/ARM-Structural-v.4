import * as THREE from 'three';
import { DIMENSIONS } from '../../../config/dimensions.config';
import type { Level } from '../types/LevelTypes';
import { LevelSprites } from './LevelSprites';

type LevelEnd = 'start' | 'end';

export interface LevelEndpointRenderResult {
  lines: THREE.Line[];
  sprites: THREE.Sprite[];
  hitMeshes: THREE.Mesh[];
  bubbleHits: Array<{ levelId: string; end: LevelEnd; mesh: THREE.Mesh; worldPos: THREE.Vector3 }>;
  elbowToggles: Array<{ levelId: string; end: LevelEnd; mesh: THREE.Sprite }>;
  bubbleToggles: Array<{ levelId: string; end: LevelEnd; mesh: THREE.Sprite }>;
  grips: Array<{ levelId: string; end: LevelEnd; mesh: THREE.Mesh }>;
  elbowGrips: Array<{ levelId: string; end: LevelEnd; mesh: THREE.Mesh }>;
}

interface LevelEndpointRendererDependencies {
  linesGroup: THREE.Group;
  headsGroup: THREE.Group;
  hitProxiesGroup: THREE.Group;
  controlsGroup: THREE.Group;
}

export class LevelEndpointRenderer {
  constructor(private readonly deps: LevelEndpointRendererDependencies) {}

  public render(
    level: Level,
    end: LevelEnd,
    coordinate: { x: number; z: number },
    elevation: number,
    isSelected: boolean,
    isHovered: boolean,
  ): LevelEndpointRenderResult {
    const result: LevelEndpointRenderResult = {
      lines: [],
      sprites: [],
      hitMeshes: [],
      bubbleHits: [],
      elbowToggles: [],
      bubbleToggles: [],
      grips: [],
      elbowGrips: [],
    };
    const direction = end === 'end' ? 1 : -1;
    const elbow = end === 'end' ? level.endElbow : level.startElbow;
    const elbowOffset = elbow?.active ? elbow.verticalOffset : 0;
    const showBubble = end === 'end' ? level.showEndBubble : level.showStartBubble;
    const headPosX = new THREE.Vector3(
      coordinate.x + direction * DIMENSIONS.levels.headOffset,
      elevation + elbowOffset,
      0,
    );
    const headPosZ = new THREE.Vector3(
      0,
      elevation + elbowOffset,
      coordinate.z + direction * DIMENSIONS.levels.headOffset,
    );

    if (showBubble) {
      this.addHead(level, end, headPosX, isSelected, isHovered, result);
      this.addHead(level, end, headPosZ, isSelected, isHovered, result);
      if (elbow?.active) this.addElbowLines(level.id, coordinate, elevation, elbowOffset, direction, result);
      this.addBubbleHit(level.id, end, headPosX, result);
      this.addBubbleHit(level.id, end, headPosZ, result);
      if (isSelected) this.addVisibleControls(level, end, coordinate, elevation, elbowOffset, direction, !!elbow?.active, result);
    } else if (isSelected) {
      this.addBubbleToggle(level.id, end, coordinate, elevation, false, direction, result);
      this.addGrip(level.id, end, new THREE.Vector3(coordinate.x, elevation, 0), result);
    }

    return result;
  }

  private addHead(
    level: Level,
    end: LevelEnd,
    position: THREE.Vector3,
    isSelected: boolean,
    isHovered: boolean,
    result: LevelEndpointRenderResult,
  ): void {
    const sprite = LevelSprites.createLevelHeadSprite(level, isSelected, isHovered);
    sprite.position.copy(position);
    sprite.userData = { levelId: level.id, isLevelHead: true, end };
    this.deps.headsGroup.add(sprite);
    result.sprites.push(sprite);
  }

  private addElbowLines(
    levelId: string,
    coordinate: { x: number; z: number },
    elevation: number,
    elbowOffset: number,
    direction: number,
    result: LevelEndpointRenderResult,
  ): void {
    const xPoints = [
      new THREE.Vector3(coordinate.x - direction * 1.6, elevation, 0),
      new THREE.Vector3(coordinate.x, elevation + elbowOffset, 0),
      new THREE.Vector3(coordinate.x + direction * DIMENSIONS.levels.headOffset, elevation + elbowOffset, 0),
    ];
    const zPoints = [
      new THREE.Vector3(0, elevation, coordinate.z - direction * 1.6),
      new THREE.Vector3(0, elevation + elbowOffset, coordinate.z),
      new THREE.Vector3(0, elevation + elbowOffset, coordinate.z + direction * DIMENSIONS.levels.headOffset),
    ];
    for (const points of [xPoints, zPoints]) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x9333ea, linewidth: 2.5 }),
      );
      line.userData = { levelId };
      this.deps.linesGroup.add(line);
      result.lines.push(line);
    }
  }

  private addBubbleHit(levelId: string, end: LevelEnd, position: THREE.Vector3, result: LevelEndpointRenderResult): void {
    const mesh = LevelSprites.createBubbleHitMesh(position, levelId, end);
    this.deps.hitProxiesGroup.add(mesh);
    result.hitMeshes.push(mesh);
    result.bubbleHits.push({ levelId, end, mesh, worldPos: position });
  }

  private addVisibleControls(
    level: Level,
    end: LevelEnd,
    coordinate: { x: number; z: number },
    elevation: number,
    elbowOffset: number,
    direction: number,
    elbowActive: boolean,
    result: LevelEndpointRenderResult,
  ): void {
    const elbowToggle = LevelSprites.createElbowToggleSprite(
      new THREE.Vector3(coordinate.x + direction * 0.8, elevation + elbowOffset, 0),
      level.id,
      end,
      elbowActive,
    );
    this.deps.controlsGroup.add(elbowToggle);
    result.elbowToggles.push({ levelId: level.id, end, mesh: elbowToggle });
    this.addBubbleToggle(level.id, end, coordinate, elevation, true, direction, result);
    this.addGrip(level.id, end, new THREE.Vector3(coordinate.x, elevation, 0), result);

    if (elbowActive) {
      const elbowGrip = LevelSprites.createElbowGripHandle(
        new THREE.Vector3(coordinate.x, elevation + elbowOffset, 0),
        level.id,
        end,
      );
      this.deps.controlsGroup.add(elbowGrip.visual);
      this.deps.hitProxiesGroup.add(elbowGrip.hitMesh);
      result.hitMeshes.push(elbowGrip.hitMesh);
      result.elbowGrips.push({ levelId: level.id, end, mesh: elbowGrip.hitMesh });
    }
  }

  private addBubbleToggle(
    levelId: string,
    end: LevelEnd,
    coordinate: { x: number; z: number },
    elevation: number,
    isChecked: boolean,
    direction: number,
    result: LevelEndpointRenderResult,
  ): void {
    const position = new THREE.Vector3(coordinate.x - direction * 1.4, elevation, 0);
    const sprite = LevelSprites.createCheckboxSprite(position, levelId, end, isChecked);
    this.deps.controlsGroup.add(sprite);
    result.bubbleToggles.push({ levelId, end, mesh: sprite });
  }

  private addGrip(levelId: string, end: LevelEnd, position: THREE.Vector3, result: LevelEndpointRenderResult): void {
    const grip = LevelSprites.createGripHandle(position, levelId, end);
    this.deps.controlsGroup.add(grip.visual);
    this.deps.hitProxiesGroup.add(grip.hitMesh);
    result.hitMeshes.push(grip.hitMesh);
    result.grips.push({ levelId, end, mesh: grip.hitMesh });
  }
}
