import * as THREE from 'three';
import type { Level } from '../core/level/types/LevelTypes';
import { LevelQuickGenerator } from '../core/level/generator/LevelQuickGenerator';
import type { LevelSystem } from '../core/LevelSystem';
import { DIMENSIONS } from '../config/dimensions.config';

export class LevelPreviewRenderer {
  public readonly group = new THREE.Group();
  private alignmentGuide: THREE.Line | null = null;

  constructor(private levelSystem: LevelSystem) {
    this.group.name = 'LevelDrawingPreview';
  }

  public renderStartTooltip(point: THREE.Vector3): void {
    this.clear();
    const text = `Cota: ${LevelQuickGenerator.formatElevation(point.y)}`;
    const sprite = this.createDimensionSprite(text);
    sprite.position.set(point.x, point.y + 1.2, point.z);
    this.group.add(sprite);
  }

  public renderLine(start: THREE.Vector3, end: THREE.Vector3, isPickLine: boolean, makePlanView: boolean): void {
    this.clear();
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineDashedMaterial({
      color: isPickLine ? 0x9333ea : 0x0284c7,
      dashSize: 0.6,
      gapSize: 0.3,
      linewidth: 2,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.group.add(line);

    const tempLevel: Level = {
      id: 'preview',
      name: 'Nuevo Nivel',
      elevation: end.y,
      start: { x: start.x, z: start.z },
      end: { x: end.x, z: end.z },
      showStartBubble: false,
      showEndBubble: true,
      isLocked: true,
      hasPlanView: makePlanView,
    };
    const head = this.createPreviewHeadSprite(tempLevel);
    head.position.set(end.x + 2.5, end.y, end.z);
    this.group.add(head);

    const length = Math.hypot(end.x - start.x, end.z - start.z);
    const label = `${length.toFixed(2)}m  •  Cota: ${LevelQuickGenerator.formatElevation(end.y)}`;
    const dimension = this.createDimensionSprite(label);
    dimension.position.set((start.x + end.x) / 2, (start.y + end.y) / 2 + 1.2, (start.z + end.z) / 2);
    this.group.add(dimension);
    this.showHorizontalAlignment(end);
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
        else (child.material as THREE.Material)?.dispose();
      } else if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
      this.group.remove(child);
    }
    this.alignmentGuide = null;
  }

  private showHorizontalAlignment(point: THREE.Vector3): void {
    const half = DIMENSIONS.levels.boundsExtentDefault;
    const tolerance = 0.5;
    this.levelSystem.getLevels().forEach(level => {
      if (Math.abs(point.x - half) >= tolerance && Math.abs(point.x + half) >= tolerance) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(point.x, level.elevation, 0),
        new THREE.Vector3(point.x, point.y, 0),
      ]);
      const material = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.4, gapSize: 0.2 });
      this.alignmentGuide = new THREE.Line(geometry, material);
      this.alignmentGuide.computeLineDistances();
      this.group.add(this.alignmentGuide);
    });
  }

  private createDimensionSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(15, 23, 42, 0.9)';
    context.roundRect(4, 4, 292, 56, 8);
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#38bdf8';
    context.stroke();
    context.font = 'bold 20px "Consolas", monospace';
    context.fillStyle = '#38bdf8';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 150, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(3.6, 0.8, 1);
    sprite.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sprite;
  }

  private createPreviewHeadSprite(level: Level): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const x = 36;
    const y = 48;
    const radius = 24;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = '#0284c7';
    context.fill();
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, radius, 0, Math.PI / 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, radius, Math.PI, (3 * Math.PI) / 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#38bdf8';
    context.stroke();
    context.font = 'bold 18px sans-serif';
    context.fillStyle = '#0284c7';
    context.textAlign = 'left';
    context.fillText('Nuevo Nivel', x + radius + 8, y - 4);
    context.font = 'bold 16px monospace';
    context.fillStyle = '#0369a1';
    context.fillText(LevelQuickGenerator.formatElevation(level.elevation), x + radius + 8, y + 20);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(4.8, 1.8, 1);
    sprite.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sprite;
  }
}
