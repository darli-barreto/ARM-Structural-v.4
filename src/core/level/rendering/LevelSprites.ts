import * as THREE from 'three';
import { Level } from '../types/LevelTypes';
import { LevelQuickGenerator } from '../generator/LevelQuickGenerator';
import { DIMENSIONS } from '../../../config/dimensions.config';

export class LevelSprites {
  /**
   * Crea el cabezal de nivel estilo Autodesk Revit con dos líneas de texto
   * (Nombre arriba y Cota abajo), cuadrantes diana y respuestas visuales a hover/selección.
   */
  public static createLevelHeadSprite(
    lvl: Level,
    isSelected: boolean = false,
    isHovered: boolean = false
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bubbleX = 46;
    const bubbleY = 64;
    const radius = 32;

    // Color según vista asociada y estado
    let primaryColor = lvl.hasPlanView ? '#0284c7' : '#475569';
    if (isSelected) primaryColor = '#2563eb';
    else if (isHovered) primaryColor = '#0284c7';

    // 1. Círculo exterior diana
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // 2. Cuadrantes opuestos en blanco (diana Revit)
    ctx.fillStyle = '#ffffff';
    // Cuadrante superior derecho (0 a PI/2)
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI / 2);
    ctx.fill();
    // Cuadrante inferior izquierdo (PI a 3PI/2)
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, Math.PI, (3 * Math.PI) / 2);
    ctx.fill();

    // Contorno exterior nítido
    ctx.lineWidth = isSelected || isHovered ? 4 : 2.5;
    ctx.strokeStyle = isSelected ? '#38bdf8' : isHovered ? '#00e5ff' : '#ffffff';
    ctx.stroke();

    // 3. Línea directriz horizontal divisoria detrás del texto
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.lineTo(360, bubbleY);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = isSelected ? 3.5 : 2.5;
    ctx.stroke();

    // 4. Nombre del nivel (Texto superior)
    ctx.font = `bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = isSelected ? '#1d4ed8' : isHovered ? '#0369a1' : '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const shortName = lvl.name.split('(')[0]?.trim() || lvl.name;
    ctx.fillText(shortName, bubbleX + radius + 12, bubbleY - 5);

    // 5. Cota / Elevación formateada (Texto inferior)
    const elevText = LevelQuickGenerator.formatElevation(lvl.elevation);
    ctx.font = `bold 22px "Consolas", "Courier New", monospace`;
    ctx.fillStyle = isSelected ? '#2563eb' : '#0284c7';
    ctx.fillText(elevText, bubbleX + radius + 12, bubbleY + 26);

    // 6. Indicador de candado de alineación (si está bloqueado)
    if (lvl.isLocked) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('🔒', bubbleX + radius + 210, bubbleY + 24);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    // Escala del sprite proporcional
    sprite.scale.set(6.0, 2.0, 1.0);
    sprite.renderOrder = DIMENSIONS.renderOrders.levelSystemDatum;

    return sprite;
  }

  /**
   * Genera el mesh de hitbox para la burbuja.
   * Cubre TODO el círculo interior con un radio generoso de 1.6m
   * con material transparente (opacity 0) para garantizar que Raycaster lo detecte siempre.
   */
  public static createBubbleHitMesh(
    pos: THREE.Vector3,
    levelId: string,
    end: 'start' | 'end'
  ): THREE.Mesh {
    const geom = new THREE.SphereGeometry(1.6, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.userData = {
      isLevelHit: true,
      isLevelBubbleHit: true,
      levelId,
      end,
    };
    return mesh;
  }

  /**
   * Botón interactivo de Codo / Elbow estilo Revit (icono de quiebre de hombro)
   */
  public static createElbowToggleSprite(
    pos: THREE.Vector3,
    levelId: string,
    end: 'start' | 'end',
    isActive: boolean
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo circular
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#9333ea' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isActive ? '#c084fc' : '#9333ea';
    ctx.stroke();

    // Glifo de quiebre (Z o escalón)
    ctx.beginPath();
    ctx.moveTo(18, 44);
    ctx.lineTo(28, 44);
    ctx.lineTo(36, 20);
    ctx.lineTo(46, 20);
    ctx.lineWidth = 4;
    ctx.strokeStyle = isActive ? '#ffffff' : '#9333ea';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(0.9, 0.9, 1.0);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridElbowIcon;
    sprite.userData = {
      isLevelElbowToggle: true,
      levelId,
      end,
    };
    return sprite;
  }

  /**
   * Checkbox de visibilidad de burbuja (extremo inicial o final)
   */
  public static createCheckboxSprite(
    pos: THREE.Vector3,
    levelId: string,
    end: 'start' | 'end',
    isChecked: boolean
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Caja cuadrada redondeada
    const r = 8;
    const x = 10, y = 10, w = 44, h = 44;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();

    ctx.fillStyle = isChecked ? '#0284c7' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = isChecked ? '#0369a1' : '#64748b';
    ctx.stroke();

    if (isChecked) {
      // Checkmark blanco
      ctx.beginPath();
      ctx.moveTo(20, 32);
      ctx.lineTo(28, 40);
      ctx.lineTo(44, 22);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(0.8, 0.8, 1.0);
    sprite.renderOrder = DIMENSIONS.renderOrders.gridCheckbox;
    sprite.userData = {
      isLevelBubbleToggle: true,
      levelId,
      end,
    };
    return sprite;
  }

  /**
   * Grip circular para arrastre de extremos (alargar y achicar el nivel).
   * Genera el grupo visual (anillo exterior + círculo interior relleno)
   * y una hitbox generosa que cubre TODO el círculo (no solo los bordes)
   * para agarre instantáneo y ergonómico.
   */
  public static createGripHandle(
    pos: THREE.Vector3,
    levelId: string,
    end: 'start' | 'end'
  ): { visual: THREE.Group; hitMesh: THREE.Mesh } {
    const visual = new THREE.Group();
    visual.position.copy(pos);

    // 1. Círculo interior relleno blanco
    const innerGeom = new THREE.CircleGeometry(0.32, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const innerMesh = new THREE.Mesh(innerGeom, innerMat);
    innerMesh.renderOrder = DIMENSIONS.renderOrders.gridGrips;
    visual.add(innerMesh);

    // 2. Anillo exterior azul Revit
    const ringGeom = new THREE.RingGeometry(0.30, 0.48, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.renderOrder = DIMENSIONS.renderOrders.gridGrips + 1;
    visual.add(ringMesh);

    // 3. Hitbox amplia que cubre TODO el círculo y área adyacente (radio 0.85m)
    const hitGeom = new THREE.SphereGeometry(0.85, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hitMesh = new THREE.Mesh(hitGeom, hitMat);
    hitMesh.position.copy(pos);
    hitMesh.userData = {
      isLevelGrip: true,
      levelId,
      end,
    };

    return { visual, hitMesh };
  }

  /**
   * Grip interactivo de Codo (Elbow Jog Grip) estilo Autodesk Revit.
   * Permite mover la posición/altura del codo una vez activado,
   * exactamente igual que en las grillas.
   */
  public static createElbowGripHandle(
    pos: THREE.Vector3,
    levelId: string,
    end: 'start' | 'end'
  ): { visual: THREE.Group; hitMesh: THREE.Mesh } {
    const visual = new THREE.Group();
    visual.position.copy(pos);

    // 1. Círculo interior relleno lila suave
    const innerGeom = new THREE.CircleGeometry(0.28, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xf3e8ff,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const innerMesh = new THREE.Mesh(innerGeom, innerMat);
    innerMesh.renderOrder = DIMENSIONS.renderOrders.gridGrips;
    visual.add(innerMesh);

    // 2. Anillo exterior morado Revit Elbow
    const ringGeom = new THREE.RingGeometry(0.26, 0.44, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.renderOrder = DIMENSIONS.renderOrders.gridGrips + 1;
    visual.add(ringMesh);

    // 3. Punto central guía
    const dotGeom = new THREE.CircleGeometry(0.1, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.renderOrder = DIMENSIONS.renderOrders.gridGrips + 2;
    visual.add(dotMesh);

    // 4. Hitbox amplia de esfera (radio 0.85m) para agarre cómodo del codo
    const hitGeom = new THREE.SphereGeometry(0.85, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hitMesh = new THREE.Mesh(hitGeom, hitMat);
    hitMesh.position.copy(pos);
    hitMesh.userData = {
      isLevelElbowGrip: true,
      levelId,
      end,
    };

    return { visual, hitMesh };
  }
}
