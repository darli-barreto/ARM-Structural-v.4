import * as THREE from 'three';
import { THEME } from '../../../config/theme.config';
import { DIMENSIONS } from '../../../config/dimensions.config';

export class GridSprites {
  /**
   * Genera el sprite de burbuja con textura nítida estilo Autodesk Revit.
   */
  public static createBubbleSprite(
    text: string,
    isHighlighted: boolean,
    isHovered = false
  ): THREE.Sprite {
    const size = DIMENSIONS.grid.bubbleCanvasSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Color de relleno y borde
    let fill: string = THEME.grid.bubble.fill;
    let stroke: string = THEME.grid.bubble.borderDefault;
    let textColor: string = THEME.grid.bubble.textDefault;
    let strokeWidth: number = DIMENSIONS.grid.bubbleStrokeWidthDefault;

    if (isHighlighted) {
      fill = THEME.grid.bubble.fillSelected;
      stroke = THEME.grid.bubble.borderSelected;
      textColor = THEME.grid.bubble.textSelected;
      strokeWidth = DIMENSIONS.grid.bubbleStrokeWidthHighlighted;
    } else if (isHovered) {
      fill = THEME.grid.bubble.fillHover;
      stroke = THEME.grid.bubble.borderHover;
      textColor = THEME.grid.bubble.textHover;
      strokeWidth = DIMENSIONS.grid.bubbleStrokeWidthHovered;
    }

    // Círculo principal
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - strokeWidth, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    // Borde exterior
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    // Texto identificador
    ctx.font = `bold ${DIMENSIONS.grid.bubbleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + DIMENSIONS.grid.bubbleTextOffsetY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    const { x: scaleX, y: scaleY, z: scaleZ } = DIMENSIONS.grid.bubbleSpriteScale;
    sprite.scale.set(scaleX, scaleY, scaleZ);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridBubble;
    return sprite;
  }

  /**
   * Checkbox de visibilidad de burbuja estilo Revit.
   */
  public static createCheckboxSprite(isChecked: boolean): THREE.Sprite {
    const cfg = DIMENSIONS.grid.controls.checkbox;
    const colors = THEME.grid.checkbox;
    const size = cfg.canvasSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Cuadrado fondo
    ctx.fillStyle = isChecked ? colors.fillChecked : colors.fillUnchecked;
    ctx.beginPath();
    ctx.roundRect(cfg.rectX, cfg.rectY, cfg.rectWidth, cfg.rectHeight, cfg.rectRadius);
    ctx.fill();

    ctx.lineWidth = cfg.strokeWidth;
    ctx.strokeStyle = isChecked ? colors.borderChecked : colors.borderUnchecked;
    ctx.stroke();

    if (isChecked) {
      // Checkmark blanco ✓
      ctx.beginPath();
      ctx.moveTo(18, 32);
      ctx.lineTo(28, 42);
      ctx.lineTo(46, 20);
      ctx.lineWidth = cfg.checkStrokeWidth;
      ctx.strokeStyle = colors.checkmark;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(cfg.spriteScale.x, cfg.spriteScale.y, cfg.spriteScale.z);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridCheckbox;
    return sprite;
  }

  /**
   * Candado de alineación estilo Revit (🔒).
   */
  public static createLockSprite(isLocked: boolean): THREE.Sprite {
    const cfg = DIMENSIONS.grid.controls.lock;
    const size = cfg.canvasSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    ctx.font = `${cfg.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLocked ? '🔒' : '🔓', size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(cfg.spriteScale.x, cfg.spriteScale.y, cfg.spriteScale.z);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridLock;
    return sprite;
  }

  /**
   * Icono interactivo de codo (Grid Elbow / Jog) estilo Autodesk Revit.
   */
  public static createElbowIconSprite(isActive: boolean): THREE.Sprite {
    const cfg = DIMENSIONS.grid.controls.elbow;
    const colors = THEME.grid.elbowIcon;
    const size = cfg.canvasSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Fondo circular blanco con borde
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - cfg.circleRadiusPadding, 0, Math.PI * 2);
    ctx.fillStyle = colors.bg;
    ctx.fill();
    ctx.lineWidth = cfg.borderWidth;
    ctx.strokeStyle = isActive ? colors.strokeActive : colors.strokeInactive;
    ctx.stroke();

    // Glifo de codo escalonado tipo Revit
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(32, 24);
    ctx.lineTo(20, 38);
    ctx.lineTo(20, 52);
    ctx.lineWidth = cfg.glyphLineWidth;
    ctx.strokeStyle = isActive ? colors.strokeActive : colors.strokeInactive;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(cfg.spriteScale.x, cfg.spriteScale.y, cfg.spriteScale.z);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridElbowIcon;
    return sprite;
  }
}
