import * as THREE from 'three';
import { DIMENSIONS } from '../config/dimensions.config';
import { THEME } from '../config/theme.config';
import { GridSystem } from '../core/GridSystem';

type Segment = { p1: THREE.Vector2; p2: THREE.Vector2 };

export class GridDrawingPreviewRenderer {
  public readonly group = new THREE.Group();

  constructor(private readonly gridSystem: GridSystem) {
    this.group.name = 'GridDrawingPreview';
  }

  public renderLine(
    lineSeg: Segment,
    referenceStart: THREE.Vector2,
    referenceEnd: THREE.Vector2,
    elev: number,
    offset: number,
    isOrtho: boolean,
    nextName: string
  ): void {
    this.clear();
    const line = this.createDashedLine(
      [
        new THREE.Vector3(lineSeg.p1.x, elev, lineSeg.p1.y),
        new THREE.Vector3(lineSeg.p2.x, elev, lineSeg.p2.y),
      ],
      THEME.preview.drawingLine,
      DIMENSIONS.drawing.previewDashSize,
      DIMENSIONS.drawing.previewGapSize,
      DIMENSIONS.drawing.previewLineWidth
    );
    this.group.add(line);

    if (offset > 0) {
      const reference = this.createDashedLine(
        [
          new THREE.Vector3(referenceStart.x, elev, referenceStart.y),
          new THREE.Vector3(referenceEnd.x, elev, referenceEnd.y),
        ],
        THEME.preview.referenceLine,
        DIMENSIONS.drawing.refDashSize,
        DIMENSIONS.drawing.refGapSize,
        1,
        DIMENSIONS.drawing.refOpacity
      );
      this.group.add(reference);
    }

    const direction = new THREE.Vector2().subVectors(lineSeg.p2, lineSeg.p1).normalize();
    const bubble = this.gridSystem.createBubbleSprite(nextName, true);
    bubble.position.set(
      lineSeg.p2.x + direction.x * DIMENSIONS.grid.bubbleOffset,
      elev + DIMENSIONS.grid.yOffsets.base,
      lineSeg.p2.y + direction.y * DIMENSIONS.grid.bubbleOffset
    );
    this.group.add(bubble);

    const length = lineSeg.p1.distanceTo(lineSeg.p2);
    const angle = ((Math.atan2(lineSeg.p2.y - lineSeg.p1.y, lineSeg.p2.x - lineSeg.p1.x) * 180) / Math.PI + 360) % 360;
    const offsetText = offset > 0 ? ` [Offset: ${offset.toFixed(2)}m]` : '';
    const orthoText = isOrtho ? ' [ORTHO]' : '';
    const label = `${length.toFixed(2)}m  •  ${angle.toFixed(1)}°${offsetText}${orthoText}`;
    this.addDimension(label, (lineSeg.p1.x + lineSeg.p2.x) / 2, elev + 0.1, (lineSeg.p1.y + lineSeg.p2.y) / 2);
  }

  public renderArc(arcData: {
    center: THREE.Vector2;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
  }, cursor: THREE.Vector2, elev: number): void {
    this.clear();
    const curve = new THREE.EllipseCurve(
      arcData.center.x,
      arcData.center.y,
      arcData.radius,
      arcData.radius,
      arcData.startAngle,
      arcData.endAngle,
      arcData.clockwise,
      0
    );
    const points = curve.getPoints(DIMENSIONS.drawing.arcCurveSegments)
      .map(point => new THREE.Vector3(point.x, elev, point.y));
    this.group.add(this.createDashedLine(
      points,
      THEME.preview.drawingLine,
      DIMENSIONS.drawing.arcDashSize,
      DIMENSIONS.drawing.arcGapSize,
      DIMENSIONS.drawing.arcLineWidth
    ));
    this.addDimension(`R = ${arcData.radius.toFixed(2)}m`, cursor.x, elev + 0.1, cursor.y);
  }

  public renderPickedLine(lineSeg: Segment, elev: number, offset: number): void {
    this.clear();
    this.group.add(this.createDashedLine(
      [
        new THREE.Vector3(lineSeg.p1.x, elev, lineSeg.p1.y),
        new THREE.Vector3(lineSeg.p2.x, elev, lineSeg.p2.y),
      ],
      THEME.preview.drawingLine,
      DIMENSIONS.drawing.arcDashSize,
      DIMENSIONS.drawing.arcGapSize,
      DIMENSIONS.drawing.arcLineWidth
    ));
    const tag = `Pick Line • Desfase: ${offset.toFixed(2)}m`;
    this.addDimension(tag, (lineSeg.p1.x + lineSeg.p2.x) / 2, elev + 0.1, (lineSeg.p1.y + lineSeg.p2.y) / 2);
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const object = this.group.children[0];
      if (object instanceof THREE.Line) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      } else if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        object.material.dispose();
      }
      this.group.remove(object);
    }
  }

  private createDashedLine(
    points: THREE.Vector3[],
    color: THREE.ColorRepresentation,
    dashSize: number,
    gapSize: number,
    lineWidth: number,
    opacity?: number
  ): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize,
      gapSize,
      linewidth: lineWidth,
      ...(opacity === undefined ? {} : { transparent: true, opacity }),
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }

  private addDimension(text: string, x: number, y: number, z: number): void {
    const sprite = this.createDimensionSprite(text);
    sprite.position.set(x, y, z);
    this.group.add(sprite);
  }

  private createDimensionSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = DIMENSIONS.drawing.dimensionCanvasWidth;
    canvas.height = DIMENSIONS.drawing.dimensionCanvasHeight;
    const context = canvas.getContext('2d')!;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = THEME.preview.dimensionBackground;
    context.beginPath();
    context.roundRect(8, 8, 240, 48, DIMENSIONS.drawing.dimensionBoxRadius);
    context.fill();
    context.lineWidth = DIMENSIONS.drawing.dimensionLineWidth;
    context.strokeStyle = THEME.preview.dimensionBorder;
    context.stroke();
    context.font = `bold ${DIMENSIONS.drawing.dimensionFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    context.fillStyle = THEME.preview.dimensionText;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(
      DIMENSIONS.drawing.dimensionSpriteScale.x,
      DIMENSIONS.drawing.dimensionSpriteScale.y,
      DIMENSIONS.drawing.dimensionSpriteScale.z
    );
    sprite.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sprite;
  }
}
