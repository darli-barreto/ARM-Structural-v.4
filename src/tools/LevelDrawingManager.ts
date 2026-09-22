import * as THREE from 'three';
import { Level, LevelDrawMode } from '../core/level/types/LevelTypes';
import { LevelQuickGenerator } from '../core/level/generator/LevelQuickGenerator';
import { LevelSystem } from '../core/LevelSystem';
import { BimView } from '../core/views/BimView';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';

export class LevelDrawingManager {
  public drawMode: LevelDrawMode = 'line';
  public currentOffset = 3.0;
  public makePlanView = true;
  public enabled = false;
  public isOrthoActive = false;

  private step = 0;
  private p1: THREE.Vector3 | null = null;
  private lastMouseEvent: MouseEvent | null = null;

  // Previsualización en escena Three.js
  public previewGroup = new THREE.Group();
  private previewLine: THREE.Line | null = null;
  private previewBubble: THREE.Sprite | null = null;
  private dimensionSprite: THREE.Sprite | null = null;
  private alignmentGuide: THREE.Line | null = null;

  private raycaster = new THREE.Raycaster();
  private intersectPoint = new THREE.Vector3();

  // Candidato para modo Pick Lines
  private hoveredLevelForPick: Level | null = null;
  private pickOffsetSign = 1;

  constructor(
    private scene: THREE.Scene,
    private levelSystem: LevelSystem,
    private activeViewGetter: () => BimView,
    private onStatusMessage: (msg: string) => void
  ) {
    this.previewGroup.name = 'LevelDrawingPreview';
    this.scene.add(this.previewGroup);

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.key === 'Shift' || e.key === 'Control') {
        this.isOrthoActive = true;
        if (this.lastMouseEvent) {
          this.handlePointerMove(this.lastMouseEvent);
        }
      } else if (e.key === 'Escape') {
        this.cancelCurrentDraw();
        this.onStatusMessage('Trazado de nivel cancelado.');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.key === 'Control') {
        this.isOrthoActive = false;
        if (this.enabled && this.lastMouseEvent) {
          this.handlePointerMove(this.lastMouseEvent);
        }
      }
    });
  }

  public setMode(mode: LevelDrawMode): void {
    this.drawMode = mode;
    this.cancelCurrentDraw();
    this.updateInstruction();
  }

  public setOffset(offset: number): void {
    this.currentOffset = Math.max(0.1, offset);
  }

  public setMakePlanView(makePlan: boolean): void {
    this.makePlanView = makePlan;
  }

  public activate(): void {
    this.enabled = true;
    this.cancelCurrentDraw();
    this.updateInstruction();
  }

  public deactivate(): void {
    this.enabled = false;
    this.cancelCurrentDraw();
    this.clearPreview();
  }

  public cancelCurrentDraw(): void {
    this.step = 0;
    this.p1 = null;
    this.hoveredLevelForPick = null;
    this.clearPreview();
    this.updateInstruction();
  }

  private updateInstruction(): void {
    if (!this.enabled) return;
    if (this.drawMode === 'line') {
      if (this.step === 0) {
        this.onStatusMessage('Nivel [Línea]: Clic para punto inicial • Vistas de Alzado Sur/Este recomendadas');
      } else {
        this.onStatusMessage('Nivel [Línea]: Clic para punto final • [Shift] Forzar Horizontal • Esc para cancelar');
      }
    } else {
      this.onStatusMessage(`Nivel [Pick Line]: Pasa el cursor sobre un nivel existente • Desfase: ${this.currentOffset.toFixed(2)}m • Clic para colocar`);
    }
  }

  /**
   * Obtiene la intersección del rayo con el plano vertical correspondiente a la vista activa.
   * Soporta Alzado Sur (XY con Z=0), Alzado Este (ZY con X=0), y Vista 3D.
   */
  private getElevationPlaneIntersection(e: MouseEvent): THREE.Vector3 | null {
    const activeView = this.activeViewGetter();
    if (!activeView) return null;

    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, activeView.camera);

    let plane: THREE.Plane;

    if (activeView.id === 'elev-east' || activeView.id === 'elev-west') {
      // Plano lateral ZY (perpendicular al eje X en X = 0)
      plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    } else if (activeView.type === 'elevation' || activeView.id === 'elev-south' || activeView.id === 'elev-north') {
      // Plano frontal XY (perpendicular al eje Z en Z = 0)
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    } else if (activeView.type === '3d') {
      // En vista 3D, plano vertical orientado según la dirección de la cámara
      const camDir = new THREE.Vector3();
      activeView.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 0.001) camDir.set(0, 0, -1);
      camDir.normalize();
      plane = new THREE.Plane(camDir.clone().negate(), 0);
    } else {
      // En vista de planta, los niveles se crean en alzado: plano frontal por defecto
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    }

    if (this.raycaster.ray.intersectPlane(plane, this.intersectPoint)) {
      // Redondear suavemente a 0.05m para limpieza CAD
      const ySnapped = Math.round(this.intersectPoint.y * 20) / 20;
      return new THREE.Vector3(
        Math.round(this.intersectPoint.x * 20) / 20,
        ySnapped,
        Math.round(this.intersectPoint.z * 20) / 20
      );
    }

    return null;
  }

  public handlePointerMove(e: MouseEvent): void {
    this.lastMouseEvent = e;
    if (!this.enabled) return;

    const cur = this.getElevationPlaneIntersection(e);
    if (!cur) {
      this.clearPreview();
      return;
    }

    const isOrtho = e.shiftKey || e.ctrlKey || this.isOrthoActive;

    if (this.drawMode === 'line') {
      if (this.step === 1 && this.p1) {
        let p2 = cur.clone();
        if (isOrtho) {
          // RESTRICCIÓN ORTOGONAL: Forzar nivel 100% horizontal manteniendo cota Y del punto inicial
          p2.y = this.p1.y;
        }

        this.renderLinePreview(this.p1, p2);
      } else {
        // En step 0, mostrar tooltip con la cota Y que tendrá el nivel antes del primer clic
        this.renderStartTooltip(cur);
      }
    } else if (this.drawMode === 'pick_lines') {
      this.handlePickLinesHover(cur);
    }
  }

  public handlePointerClick(e: MouseEvent): boolean {
    if (!this.enabled) return false;

    const cur = this.getElevationPlaneIntersection(e);
    if (!cur) return false;

    const isOrtho = e.shiftKey || e.ctrlKey || this.isOrthoActive;

    if (this.drawMode === 'line') {
      if (this.step === 0) {
        // PRIMER CLIC: Punto Inicial
        this.p1 = cur.clone();
        this.step = 1;
        this.updateInstruction();
        return true;
      } else if (this.step === 1 && this.p1) {
        // SEGUNDO CLIC: Punto Final
        let p2 = cur.clone();
        if (isOrtho) {
          p2.y = this.p1.y;
        }

        const span = Math.hypot(p2.x - this.p1.x, p2.z - this.p1.z);
        if (span < 1.0) {
          this.onStatusMessage('La longitud del nivel es muy corta. Traza una línea más amplia.');
          return true;
        }

        const activeView = this.activeViewGetter();
        const elev = Number(p2.y.toFixed(2));

        // Determinar extensión espacial
        let startCoord: { x: number; z: number };
        let endCoord: { x: number; z: number };

        if (activeView.id === 'elev-east') {
          const minZ = Math.min(this.p1.z, p2.z);
          const maxZ = Math.max(this.p1.z, p2.z);
          startCoord = { x: -DIMENSIONS.levels.boundsExtentDefault, z: minZ };
          endCoord = { x: DIMENSIONS.levels.boundsExtentDefault, z: maxZ };
        } else {
          const minX = Math.min(this.p1.x, p2.x);
          const maxX = Math.max(this.p1.x, p2.x);
          startCoord = { x: minX, z: -DIMENSIONS.levels.boundsExtentDefault };
          endCoord = { x: maxX, z: DIMENSIONS.levels.boundsExtentDefault };
        }

        const existingLevels = this.levelSystem.getLevels();
        const nextNum = existingLevels.length + 1;
        const elevFormatted = LevelQuickGenerator.formatElevation(elev);
        const name = `Nivel ${nextNum} (${elevFormatted})`;

        // Crear la entidad independiente
        this.levelSystem.addLevel({
          name,
          elevation: elev,
          start: startCoord,
          end: endCoord,
          showStartBubble: true,
          showEndBubble: true,
          isLocked: true,
          hasPlanView: this.makePlanView,
        });

        this.onStatusMessage(`Nivel ${name} creado con éxito.`);

        // REGLA FUNDAMENTAL: NO CHAINING (Sin encadenamiento involuntario)
        // Al hacer el segundo clic, el trazo termina y el origen se reinicia por completo
        this.cancelCurrentDraw();
        return true;
      }
    } else if (this.drawMode === 'pick_lines') {
      if (this.hoveredLevelForPick) {
        const ref = this.hoveredLevelForPick;
        const newElev = Number((ref.elevation + this.pickOffsetSign * this.currentOffset).toFixed(2));
        const elevFormatted = LevelQuickGenerator.formatElevation(newElev);
        const nextNum = this.levelSystem.getLevels().length + 1;
        const name = `Nivel ${nextNum} (${elevFormatted})`;

        this.levelSystem.addLevel({
          name,
          elevation: newElev,
          start: { ...ref.start },
          end: { ...ref.end },
          showStartBubble: true,
          showEndBubble: true,
          isLocked: true,
          hasPlanView: this.makePlanView,
        });

        this.onStatusMessage(`Nivel ${name} creado por desfase de ${this.currentOffset.toFixed(2)}m.`);
        this.clearPreview();
        return true;
      }
    }

    return false;
  }

  private handlePickLinesHover(cur: THREE.Vector3): void {
    const levels = this.levelSystem.getLevels();
    if (levels.length === 0) {
      this.clearPreview();
      return;
    }

    // Encontrar el nivel más cercano en elevación Y
    let closestLevel: Level | null = null;
    let minDist = Infinity;

    levels.forEach(l => {
      const dist = Math.abs(cur.y - l.elevation);
      if (dist < minDist && dist < 6.0) {
        minDist = dist;
        closestLevel = l;
      }
    });

    if (closestLevel) {
      this.hoveredLevelForPick = closestLevel;
      this.pickOffsetSign = cur.y >= (closestLevel as Level).elevation ? 1 : -1;
      const targetElev = (closestLevel as Level).elevation + this.pickOffsetSign * this.currentOffset;

      const half = DIMENSIONS.levels.boundsExtentDefault;
      const pA = new THREE.Vector3(-half, targetElev, 0);
      const pB = new THREE.Vector3(half, targetElev, 0);

      this.renderLinePreview(pA, pB, true);
    } else {
      this.hoveredLevelForPick = null;
      this.clearPreview();
    }
  }

  private renderStartTooltip(pt: THREE.Vector3): void {
    this.clearPreview();
    const elevFormatted = LevelQuickGenerator.formatElevation(pt.y);
    const text = `Cota: ${elevFormatted}`;
    const sp = this.createDimensionSprite(text);
    sp.position.set(pt.x, pt.y + 1.2, pt.z);
    this.previewGroup.add(sp);
    this.dimensionSprite = sp;
  }

  private renderLinePreview(p1: THREE.Vector3, p2: THREE.Vector3, isPickLine = false): void {
    this.clearPreview();

    // 1. Línea elástica de vista previa
    const pts = [p1, p2];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: isPickLine ? 0x9333ea : 0x0284c7,
      dashSize: 0.6,
      gapSize: 0.3,
      linewidth: 2,
    });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    this.previewGroup.add(line);
    this.previewLine = line;

    // 2. Cabezal diana provisional en el extremo p2
    const tempLevel: Level = {
      id: 'preview',
      name: 'Nuevo Nivel',
      elevation: p2.y,
      start: { x: p1.x, z: p1.z },
      end: { x: p2.x, z: p2.z },
      showStartBubble: false,
      showEndBubble: true,
      isLocked: true,
      hasPlanView: this.makePlanView,
    };
    const headSprite = this.createPreviewHeadSprite(tempLevel);
    headSprite.position.set(p2.x + 2.5, p2.y, p2.z);
    this.previewGroup.add(headSprite);
    this.previewBubble = headSprite;

    // 3. Etiqueta flotante de dimensión (Longitud y Cota)
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const elevText = LevelQuickGenerator.formatElevation(p2.y);
    const label = `${dist.toFixed(2)}m  •  Cota: ${elevText}`;
    const dimSprite = this.createDimensionSprite(label);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 + 1.2;
    const midZ = (p1.z + p2.z) / 2;
    dimSprite.position.set(midX, midY, midZ);
    this.previewGroup.add(dimSprite);
    this.dimensionSprite = dimSprite;

    // 4. Guía de alineación horizontal con otros niveles
    this.checkHorizontalAlignment(p2);
  }

  private checkHorizontalAlignment(p2: THREE.Vector3): void {
    const levels = this.levelSystem.getLevels();
    const half = DIMENSIONS.levels.boundsExtentDefault;
    const tol = 0.5;

    levels.forEach(lvl => {
      // Si la cota o los extremos se alinean
      if (Math.abs(p2.x - half) < tol || Math.abs(p2.x - (-half)) < tol) {
        const guidePts = [
          new THREE.Vector3(p2.x, lvl.elevation, 0),
          new THREE.Vector3(p2.x, p2.y, 0),
        ];
        const gGeom = new THREE.BufferGeometry().setFromPoints(guidePts);
        const gMat = new THREE.LineDashedMaterial({
          color: 0x38bdf8,
          dashSize: 0.4,
          gapSize: 0.2,
        });
        const gLine = new THREE.Line(gGeom, gMat);
        gLine.computeLineDistances();
        this.previewGroup.add(gLine);
        this.alignmentGuide = gLine;
      }
    });
  }

  private createDimensionSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(4, 4, 292, 56, 8);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.font = 'bold 20px "Consolas", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 150, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(3.6, 0.8, 1);
    sp.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sp;
  }

  private createPreviewHeadSprite(lvl: Level): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bx = 36, by = 48, r = 24;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, r, 0, Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, r, Math.PI, (3 * Math.PI) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#0284c7';
    ctx.textAlign = 'left';
    ctx.fillText('Nuevo Nivel', bx + r + 8, by - 4);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#0369a1';
    ctx.fillText(LevelQuickGenerator.formatElevation(lvl.elevation), bx + r + 8, by + 20);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(4.8, 1.8, 1);
    sp.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sp;
  }

  private clearPreview(): void {
    while (this.previewGroup.children.length > 0) {
      const c = this.previewGroup.children[0];
      if (c instanceof THREE.Mesh || c instanceof THREE.Line) {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else (c.material as THREE.Material)?.dispose();
      } else if (c instanceof THREE.Sprite) {
        c.material.map?.dispose();
        c.material.dispose();
      }
      this.previewGroup.remove(c);
    }
    this.previewLine = null;
    this.previewBubble = null;
    this.dimensionSprite = null;
    this.alignmentGuide = null;
  }
}
