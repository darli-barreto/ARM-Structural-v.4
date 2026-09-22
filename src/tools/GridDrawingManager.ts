import * as THREE from 'three';
import { GridDrawMode, GridElement, LEVELS_Y } from '../config/structural.config';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';
import { GridSystem } from '../core/GridSystem';
import { BimView } from '../core/views/BimView';
import { ElementRegistry } from './structural/ElementRegistry';

export class GridDrawingManager {
  public drawMode: GridDrawMode = 'line';
  public currentOffset = 0.0;
  public isChain = false;
  public filletRadius = 0.0;
  public enabled = false;
  public isOrthoActive = false;
  private lastMouseEvent: MouseEvent | null = null;

  private step = 0;
  private p1: THREE.Vector2 | null = null;
  private p2: THREE.Vector2 | null = null;
  private arcCenter: THREE.Vector2 | null = null;

  // Previsualización Three.js
  public previewGroup = new THREE.Group();
  private previewLine: THREE.Line | null = null;
  private previewArc: THREE.Line | null = null;
  private previewRefLine: THREE.Line | null = null;
  private dimensionSprite: THREE.Sprite | null = null;
  private previewStartBubble: THREE.Sprite | null = null;
  private previewEndBubble: THREE.Sprite | null = null;

  // Pick lines candidates
  private candidateEdges: Array<{ start: THREE.Vector2; end: THREE.Vector2 }> = [];
  private candidateIndex = 0;
  private hoveredEdge: { start: THREE.Vector2; end: THREE.Vector2 } | null = null;

  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectPoint = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private gridSystem: GridSystem,
    private registry: ElementRegistry,
    private activeViewGetter: () => BimView,
    private onStatusMessage: (msg: string) => void
  ) {
    this.previewGroup.name = 'GridDrawingPreview';
    scene.add(this.previewGroup);

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.key === 'Shift' || e.key === 'Control') {
        this.isOrthoActive = true;
        if (this.lastMouseEvent) {
          this.handlePointerMove(this.lastMouseEvent);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.cyclePickCandidate();
      } else if (e.key === 'Escape') {
        this.cancelCurrentDraw();
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

  public setMode(mode: GridDrawMode): void {
    this.drawMode = mode;
    this.cancelCurrentDraw();
    this.updateInstruction();
  }

  public setOffset(offset: number): void {
    this.currentOffset = Math.max(0, offset);
  }

  public setChain(chain: boolean): void {
    this.isChain = chain;
  }

  public setFilletRadius(radius: number): void {
    this.filletRadius = Math.max(0, radius);
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
    this.p2 = null;
    this.arcCenter = null;
    this.hoveredEdge = null;
    this.clearPreview();
    this.updateInstruction();
  }

  private updateInstruction(): void {
    if (!this.enabled) return;
    switch (this.drawMode) {
      case 'line':
        if (this.step === 0) this.onStatusMessage('Grilla [Línea]: Clic para el punto inicial');
        else this.onStatusMessage('Grilla [Línea]: Clic para el punto final • [Shift / Ctrl] Restricción Ortogonal • Esc para cancelar');
        break;
      case 'arc_start_end_radius':
        if (this.step === 0) this.onStatusMessage('Grilla [Arco Inicio-Fin-Radio]: Clic en Punto Inicial');
        else if (this.step === 1) this.onStatusMessage('Grilla [Arco Inicio-Fin-Radio]: Clic en Punto Final • [Shift / Ctrl] Ortogonal');
        else this.onStatusMessage('Grilla [Arco Inicio-Fin-Radio]: Mueve el cursor para definir el Radio • Clic para fijar');
        break;
      case 'arc_center_ends':
        if (this.step === 0) this.onStatusMessage('Grilla [Arco Centro-Extremos]: Clic en Punto Centro');
        else if (this.step === 1) this.onStatusMessage('Grilla [Arco Centro-Extremos]: Clic en Punto Inicial (define Radio) • [Shift / Ctrl] Ortogonal');
        else this.onStatusMessage('Grilla [Arco Centro-Extremos]: Mueve el cursor para definir barrido • Clic para fijar');
        break;
      case 'pick_lines':
        this.onStatusMessage('Grilla [Pick Lines]: Pasa sobre líneas o elementos • Tab para ciclar aristas • Clic para colocar con Desfase');
        break;
    }
  }

  /**
   * Restringe un punto a 0°, 90°, 180°, 270° respecto a un origen dado (Modo Ortho).
   */
  private applyOrtho(origin: THREE.Vector2, target: THREE.Vector2): THREE.Vector2 {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y; // Representa Z en el plano de la escena
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Forzar horizontal (Z constante)
      return new THREE.Vector2(target.x, origin.y);
    } else {
      // Forzar vertical (X constante)
      return new THREE.Vector2(origin.x, target.y);
    }
  }

  /**
   * Obtiene la posición del cursor proyectada en el plano XZ de la vista activa.
   */
  private getPlaneIntersection(e: MouseEvent): THREE.Vector2 | null {
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
    const elev = LEVELS_Y[this.gridSystem.activeLevelIdx] || 0;
    this.plane.constant = -elev;

    if (this.raycaster.ray.intersectPlane(this.plane, this.intersectPoint)) {
      return new THREE.Vector2(this.intersectPoint.x, this.intersectPoint.z);
    }
    return null;
  }

  /**
   * Manejador de movimiento del cursor.
   */
  public handlePointerMove(e: MouseEvent): void {
    this.lastMouseEvent = e;
    if (!this.enabled) return;

    let cur = this.getPlaneIntersection(e);
    if (!cur) {
      this.clearPreview();
      return;
    }

    const isOrtho = e.shiftKey || e.ctrlKey || this.isOrthoActive;
    const elev = (LEVELS_Y[this.gridSystem.activeLevelIdx] || 0) + 0.08;

    if (this.drawMode === 'line') {
      if (this.step === 1 && this.p1) {
        if (isOrtho) {
          cur = this.applyOrtho(this.p1, cur);
        }
        this.renderLinePreview(this.p1, cur, elev);
      }
    } else if (this.drawMode === 'arc_start_end_radius') {
      if (this.step === 1 && this.p1) {
        if (isOrtho) {
          cur = this.applyOrtho(this.p1, cur);
        }
        this.renderLinePreview(this.p1, cur, elev);
      } else if (this.step === 2 && this.p1 && this.p2) {
        this.renderArcStartEndRadiusPreview(this.p1, this.p2, cur, elev);
      }
    } else if (this.drawMode === 'arc_center_ends') {
      if (this.step === 1 && this.arcCenter) {
        if (isOrtho) {
          cur = this.applyOrtho(this.arcCenter, cur);
        }
        this.renderLinePreview(this.arcCenter, cur, elev);
      } else if (this.step === 2 && this.arcCenter && this.p1) {
        this.renderArcCenterEndsPreview(this.arcCenter, this.p1, cur, elev);
      }
    } else if (this.drawMode === 'pick_lines') {
      this.detectCandidateEdges(cur);
      if (this.hoveredEdge) {
        this.renderPickLinePreview(this.hoveredEdge, cur, elev);
      } else {
        this.clearPreview();
      }
    }
  }

  /**
   * Manejador de clics del ratón.
   */
  public handlePointerClick(e: MouseEvent): boolean {
    if (!this.enabled) return false;

    let cur = this.getPlaneIntersection(e);
    if (!cur) return false;

    const isOrtho = e.shiftKey || e.ctrlKey || this.isOrthoActive;
    const elev = (LEVELS_Y[this.gridSystem.activeLevelIdx] || 0) + 0.08;

    if (this.drawMode === 'line') {
      if (this.step === 0) {
        this.p1 = cur.clone();
        this.step = 1;
        this.updateInstruction();
        return true;
      } else if (this.step === 1 && this.p1) {
        if (isOrtho) {
          cur = this.applyOrtho(this.p1, cur);
        }
        if (this.p1.distanceTo(cur) < 0.5) return true; // Muy corto

        // Calcular puntos desfasados
        const lineSeg = this.calculateOffsetLine(this.p1, cur, cur, this.currentOffset);
        const nextName = this.generateNextGridName(lineSeg.p1, lineSeg.p2);

        this.gridSystem.addGridElement({
          id: `grid-${Date.now()}`,
          name: nextName,
          geomType: 'line',
          start: { x: lineSeg.p1.x, z: lineSeg.p1.y },
          end: { x: lineSeg.p2.x, z: lineSeg.p2.y },
          showStartBubble: true,
          showEndBubble: true,
          isLocked: true,
        });

        this.onStatusMessage(`Rejilla ${nextName} creada.`);

        if (this.isChain) {
          this.p1 = cur.clone();
          this.step = 1;
          this.updateInstruction();
        } else {
          this.cancelCurrentDraw();
        }
        return true;
      }
    } else if (this.drawMode === 'arc_start_end_radius') {
      if (this.step === 0) {
        this.p1 = cur.clone();
        this.step = 1;
        this.updateInstruction();
        return true;
      } else if (this.step === 1 && this.p1) {
        if (isOrtho) {
          cur = this.applyOrtho(this.p1, cur);
        }
        if (this.p1.distanceTo(cur) < 1.0) return true;
        this.p2 = cur.clone();
        this.step = 2;
        this.updateInstruction();
        return true;
      } else if (this.step === 2 && this.p1 && this.p2) {
        const arcData = this.calculateArcStartEndRadius(this.p1, this.p2, cur, this.currentOffset);
        if (arcData) {
          const nextName = this.generateNextGridName(this.p1, this.p2);
          this.gridSystem.addGridElement({
            id: `grid-arc-${Date.now()}`,
            name: nextName,
            geomType: 'arc',
            start: { x: arcData.start.x, z: arcData.start.y },
            end: { x: arcData.end.x, z: arcData.end.y },
            center: { x: arcData.center.x, z: arcData.center.y },
            radius: arcData.radius,
            startAngle: arcData.startAngle,
            endAngle: arcData.endAngle,
            clockwise: arcData.clockwise,
            showStartBubble: true,
            showEndBubble: true,
            isLocked: true,
          });
          this.onStatusMessage(`Rejilla curva ${nextName} creada.`);
        }
        this.cancelCurrentDraw();
        return true;
      }
    } else if (this.drawMode === 'arc_center_ends') {
      if (this.step === 0) {
        this.arcCenter = cur.clone();
        this.step = 1;
        this.updateInstruction();
        return true;
      } else if (this.step === 1 && this.arcCenter) {
        if (this.arcCenter.distanceTo(cur) < 1.0) return true;
        this.p1 = cur.clone();
        this.step = 2;
        this.updateInstruction();
        return true;
      } else if (this.step === 2 && this.arcCenter && this.p1) {
        const arcData = this.calculateArcCenterEnds(this.arcCenter, this.p1, cur, this.currentOffset);
        if (arcData) {
          const nextName = this.generateNextGridName(this.p1, cur);
          this.gridSystem.addGridElement({
            id: `grid-arc-${Date.now()}`,
            name: nextName,
            geomType: 'arc',
            start: { x: arcData.start.x, z: arcData.start.y },
            end: { x: arcData.end.x, z: arcData.end.y },
            center: { x: arcData.center.x, z: arcData.center.y },
            radius: arcData.radius,
            startAngle: arcData.startAngle,
            endAngle: arcData.endAngle,
            clockwise: arcData.clockwise,
            showStartBubble: true,
            showEndBubble: true,
            isLocked: true,
          });
          this.onStatusMessage(`Rejilla circular ${nextName} creada.`);
        }
        this.cancelCurrentDraw();
        return true;
      }
    } else if (this.drawMode === 'pick_lines') {
      if (this.hoveredEdge) {
        const lineSeg = this.calculateOffsetLine(
          this.hoveredEdge.start,
          this.hoveredEdge.end,
          cur,
          this.currentOffset
        );
        const nextName = this.generateNextGridName(lineSeg.p1, lineSeg.p2);

        this.gridSystem.addGridElement({
          id: `grid-pick-${Date.now()}`,
          name: nextName,
          geomType: 'line',
          start: { x: lineSeg.p1.x, z: lineSeg.p1.y },
          end: { x: lineSeg.p2.x, z: lineSeg.p2.y },
          showStartBubble: true,
          showEndBubble: true,
          isLocked: true,
        });

        this.onStatusMessage(`Rejilla ${nextName} creada desde referencia con desfase.`);
        return true;
      }
    }

    return false;
  }

  /**
   * Matemática Vectorial de Desfase (Offset):
   * Funciona universalmente en 360° para líneas verticales, horizontales y en cualquier ángulo.
   */
  private calculateOffsetLine(
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    cursor: THREE.Vector2,
    offset: number
  ): { p1: THREE.Vector2; p2: THREE.Vector2 } {
    if (offset <= 0) return { p1: p1.clone(), p2: p2.clone() };

    const dir = new THREE.Vector2().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.001) return { p1: p1.clone(), p2: p2.clone() };

    dir.normalize();

    // Normal perpendicular en el plano 2D (XZ): n = (-dir.y, dir.x)
    const normal = new THREE.Vector2(-dir.y, dir.x);

    // Vector desde p1 al cursor
    const toCursor = new THREE.Vector2().subVectors(cursor, p1);

    // Producto escalar para determinar si el cursor está en el lado positivo o negativo de la normal
    const side = toCursor.dot(normal) >= 0 ? 1 : -1;

    const offsetVec = normal.clone().multiplyScalar(side * offset);

    return {
      p1: new THREE.Vector2().addVectors(p1, offsetVec),
      p2: new THREE.Vector2().addVectors(p2, offsetVec),
    };
  }

  /**
   * Cálculo de Arco por Inicio, Fin y Radio (3 pasos).
   */
  private calculateArcStartEndRadius(
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    cursor: THREE.Vector2,
    offset: number
  ): {
    start: THREE.Vector2;
    end: THREE.Vector2;
    center: THREE.Vector2;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
  } | null {
    const chord = new THREE.Vector2().subVectors(p2, p1);
    const chordLen = chord.length();
    if (chordLen < 0.5) return null;

    const mid = new THREE.Vector2().addVectors(p1, p2).multiplyScalar(0.5);
    const chordDir = chord.clone().normalize();
    const chordNormal = new THREE.Vector2(-chordDir.y, chordDir.x);

    // Sagita h (distancia con signo desde el punto medio hacia la normal)
    const toCursor = new THREE.Vector2().subVectors(cursor, mid);
    let h = toCursor.dot(chordNormal);
    if (Math.abs(h) < 0.08) h = 0.08 * (h >= 0 ? 1 : -1);

    // Radio: R = |h|/2 + L^2 / (8 * |h|)
    const absH = Math.abs(h);
    let radius = absH / 2 + (chordLen * chordLen) / (8 * absH);

    // Centro del círculo
    const distToCenter = Math.sqrt(Math.max(0, radius * radius - (chordLen * chordLen) / 4));
    const centerSign = h >= 0 ? 1 : -1;
    const center = new THREE.Vector2().addVectors(
      mid,
      chordNormal.clone().multiplyScalar(-centerSign * (radius - absH))
    );

    // Ajuste de desfase radial
    if (offset > 0) {
      const distCursorToCenter = cursor.distanceTo(center);
      if (distCursorToCenter > radius) radius += offset;
      else radius = Math.max(1, radius - offset);
    }

    const startAng = Math.atan2(p1.y - center.y, p1.x - center.x);
    const endAng = Math.atan2(p2.y - center.y, p2.x - center.x);

    return {
      start: p1,
      end: p2,
      center,
      radius,
      startAngle: startAng,
      endAngle: endAng,
      clockwise: h < 0,
    };
  }

  /**
   * Cálculo de Arco por Centro y Extremos con volteo automático (> 180°).
   */
  private calculateArcCenterEnds(
    center: THREE.Vector2,
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    offset: number
  ): {
    start: THREE.Vector2;
    end: THREE.Vector2;
    center: THREE.Vector2;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
  } | null {
    let radius = center.distanceTo(p1);
    if (radius < 0.5) return null;

    if (offset > 0) {
      const distCurToCenter = center.distanceTo(p2);
      if (distCurToCenter > radius) radius += offset;
      else radius = Math.max(1, radius - offset);
    }

    const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
    const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

    // Calcular barrido y regla de Revit: Si > 180°, voltear sentido
    let diff = endAngle - startAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const clockwise = diff < 0;

    return {
      start: p1,
      end: p2,
      center,
      radius,
      startAngle,
      endAngle,
      clockwise,
    };
  }

  /**
   * Renderiza la previsualización de línea con desfase y cota de longitud/ángulo.
   */
  private renderLinePreview(p1: THREE.Vector2, p2: THREE.Vector2, elev: number): void {
    this.clearPreview();

    const lineSeg = this.calculateOffsetLine(p1, p2, p2, this.currentOffset);

    // 1. Línea principal desfasada (Cian discontinuo)
    const pts = [
      new THREE.Vector3(lineSeg.p1.x, elev, lineSeg.p1.y),
      new THREE.Vector3(lineSeg.p2.x, elev, lineSeg.p2.y),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: THEME.preview.drawingLine,
      dashSize: DIMENSIONS.drawing.previewDashSize,
      gapSize: DIMENSIONS.drawing.previewGapSize,
      linewidth: DIMENSIONS.drawing.previewLineWidth,
    });
    this.previewLine = new THREE.Line(geom, mat);
    this.previewLine.computeLineDistances();
    this.previewGroup.add(this.previewLine);

    // 2. Línea de referencia si hay offset
    if (this.currentOffset > 0) {
      const refPts = [
        new THREE.Vector3(p1.x, elev, p1.y),
        new THREE.Vector3(p2.x, elev, p2.y),
      ];
      const refGeom = new THREE.BufferGeometry().setFromPoints(refPts);
      const refMat = new THREE.LineDashedMaterial({
        color: THEME.preview.referenceLine,
        dashSize: DIMENSIONS.drawing.refDashSize,
        gapSize: DIMENSIONS.drawing.refGapSize,
        transparent: true,
        opacity: DIMENSIONS.drawing.refOpacity,
      });
      this.previewRefLine = new THREE.Line(refGeom, refMat);
      this.previewRefLine.computeLineDistances();
      this.previewGroup.add(this.previewRefLine);
    }

    // 3. Burbuja de previsualización en el extremo
    const nextName = this.generateNextGridName(lineSeg.p1, lineSeg.p2);
    this.previewEndBubble = this.gridSystem.createBubbleSprite(nextName, true);
    const dir = new THREE.Vector2().subVectors(lineSeg.p2, lineSeg.p1).normalize();
    this.previewEndBubble.position.set(
      lineSeg.p2.x + dir.x * DIMENSIONS.grid.bubbleOffset,
      elev + DIMENSIONS.grid.yOffsets.base,
      lineSeg.p2.y + dir.y * DIMENSIONS.grid.bubbleOffset
    );
    this.previewGroup.add(this.previewEndBubble);

    // 4. Cota interactiva de longitud y ángulo
    const length = lineSeg.p1.distanceTo(lineSeg.p2);
    const angleDeg = ((Math.atan2(lineSeg.p2.y - lineSeg.p1.y, lineSeg.p2.x - lineSeg.p1.x) * 180) / Math.PI + 360) % 360;
    const midX = (lineSeg.p1.x + lineSeg.p2.x) / 2;
    const midZ = (lineSeg.p1.y + lineSeg.p2.y) / 2;

    const offsetText = this.currentOffset > 0 ? ` [Offset: ${this.currentOffset.toFixed(2)}m]` : '';
    const isOrtho = this.isOrthoActive || this.lastMouseEvent?.shiftKey || this.lastMouseEvent?.ctrlKey;
    const orthoText = isOrtho ? ' [ORTHO]' : '';
    const labelText = `${length.toFixed(2)}m  •  ${angleDeg.toFixed(1)}°${offsetText}${orthoText}`;
    this.dimensionSprite = this.createDimensionSprite(labelText);
    this.dimensionSprite.position.set(midX, elev + 0.1, midZ);
    this.previewGroup.add(this.dimensionSprite);
  }

  /**
   * Previsualización de Arco Inicio-Fin-Radio.
   */
  private renderArcStartEndRadiusPreview(p1: THREE.Vector2, p2: THREE.Vector2, cur: THREE.Vector2, elev: number): void {
    this.clearPreview();
    const arcData = this.calculateArcStartEndRadius(p1, p2, cur, this.currentOffset);
    if (!arcData) return;

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

    const pts2D = curve.getPoints(DIMENSIONS.drawing.arcCurveSegments);
    const pts3D = pts2D.map(p => new THREE.Vector3(p.x, elev, p.y));
    const geom = new THREE.BufferGeometry().setFromPoints(pts3D);
    const mat = new THREE.LineDashedMaterial({
      color: THEME.preview.drawingLine,
      dashSize: DIMENSIONS.drawing.arcDashSize,
      gapSize: DIMENSIONS.drawing.arcGapSize,
      linewidth: DIMENSIONS.drawing.arcLineWidth,
    });
    this.previewArc = new THREE.Line(geom, mat);
    this.previewArc.computeLineDistances();
    this.previewGroup.add(this.previewArc);

    // Cota de Radio
    const dimText = `R = ${arcData.radius.toFixed(2)}m`;
    this.dimensionSprite = this.createDimensionSprite(dimText);
    this.dimensionSprite.position.set(cur.x, elev + 0.1, cur.y);
    this.previewGroup.add(this.dimensionSprite);
  }

  /**
   * Previsualización de Arco Centro-Extremos.
   */
  private renderArcCenterEndsPreview(center: THREE.Vector2, p1: THREE.Vector2, cur: THREE.Vector2, elev: number): void {
    this.clearPreview();
    const arcData = this.calculateArcCenterEnds(center, p1, cur, this.currentOffset);
    if (!arcData) return;

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

    const pts2D = curve.getPoints(DIMENSIONS.drawing.arcCurveSegments);
    const pts3D = pts2D.map(p => new THREE.Vector3(p.x, elev, p.y));
    const geom = new THREE.BufferGeometry().setFromPoints(pts3D);
    const mat = new THREE.LineDashedMaterial({
      color: THEME.preview.drawingLine,
      dashSize: DIMENSIONS.drawing.arcDashSize,
      gapSize: DIMENSIONS.drawing.arcGapSize,
      linewidth: DIMENSIONS.drawing.arcLineWidth,
    });
    this.previewArc = new THREE.Line(geom, mat);
    this.previewArc.computeLineDistances();
    this.previewGroup.add(this.previewArc);

    // Cota radial
    const dimText = `R = ${arcData.radius.toFixed(2)}m`;
    this.dimensionSprite = this.createDimensionSprite(dimText);
    this.dimensionSprite.position.set(cur.x, elev + 0.1, cur.y);
    this.previewGroup.add(this.dimensionSprite);
  }

  /**
   * Detecta aristas candidatas para la herramienta Pick Lines.
   */
  private detectCandidateEdges(cursor: THREE.Vector2): void {
    const candidates: Array<{ start: THREE.Vector2; end: THREE.Vector2; dist: number }> = [];

    // 1. Aristas de elementos estructurales existentes
    const meshes = this.registry.getMeshes();
    meshes.forEach(mesh => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;

      const worldBox = box.clone().applyMatrix4(mesh.matrixWorld);
      const minX = worldBox.min.x;
      const maxX = worldBox.max.x;
      const minZ = worldBox.min.z;
      const maxZ = worldBox.max.z;

      // 4 bordes del elemento en planta
      const edges = [
        { start: new THREE.Vector2(minX, minZ), end: new THREE.Vector2(maxX, minZ) },
        { start: new THREE.Vector2(maxX, minZ), end: new THREE.Vector2(maxX, maxZ) },
        { start: new THREE.Vector2(maxX, maxZ), end: new THREE.Vector2(minX, maxZ) },
        { start: new THREE.Vector2(minX, maxZ), end: new THREE.Vector2(minX, minZ) },
      ];

      edges.forEach(edge => {
        const dist = this.distPointToSegment(cursor, edge.start, edge.end);
        if (dist < DIMENSIONS.drawing.pickLinesThreshold) candidates.push({ ...edge, dist });
      });
    });

    // 2. Aristas de rejillas ya existentes
    this.gridSystem.elements.forEach(grid => {
      if (grid.geomType === 'line') {
        const s = new THREE.Vector2(grid.start.x, grid.start.z);
        const e = new THREE.Vector2(grid.end.x, grid.end.z);
        const dist = this.distPointToSegment(cursor, s, e);
        if (dist < DIMENSIONS.drawing.pickLinesThreshold) candidates.push({ start: s, end: e, dist });
      }
    });

    candidates.sort((a, b) => a.dist - b.dist);
    this.candidateEdges = candidates.map(c => ({ start: c.start, end: c.end }));

    if (this.candidateEdges.length > 0) {
      this.hoveredEdge = this.candidateEdges[this.candidateIndex % this.candidateEdges.length];
    } else {
      this.hoveredEdge = null;
    }
  }

  public cyclePickCandidate(): void {
    if (this.candidateEdges.length > 1) {
      this.candidateIndex = (this.candidateIndex + 1) % this.candidateEdges.length;
      this.hoveredEdge = this.candidateEdges[this.candidateIndex];
      this.onStatusMessage(`Arista candidata cambiada [Tab] (${this.candidateIndex + 1}/${this.candidateEdges.length})`);
    }
  }

  private renderPickLinePreview(edge: { start: THREE.Vector2; end: THREE.Vector2 }, cursor: THREE.Vector2, elev: number): void {
    this.clearPreview();

    // Línea desfasada
    const lineSeg = this.calculateOffsetLine(edge.start, edge.end, cursor, this.currentOffset);

    const pts = [
      new THREE.Vector3(lineSeg.p1.x, elev, lineSeg.p1.y),
      new THREE.Vector3(lineSeg.p2.x, elev, lineSeg.p2.y),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: THEME.preview.drawingLine,
      dashSize: DIMENSIONS.drawing.arcDashSize,
      gapSize: DIMENSIONS.drawing.arcGapSize,
      linewidth: DIMENSIONS.drawing.arcLineWidth,
    });
    this.previewLine = new THREE.Line(geom, mat);
    this.previewLine.computeLineDistances();
    this.previewGroup.add(this.previewLine);

    // Cota
    const tag = `Pick Line • Desfase: ${this.currentOffset.toFixed(2)}m`;
    this.dimensionSprite = this.createDimensionSprite(tag);
    this.dimensionSprite.position.set((lineSeg.p1.x + lineSeg.p2.x) / 2, elev + 0.1, (lineSeg.p1.y + lineSeg.p2.y) / 2);
    this.previewGroup.add(this.dimensionSprite);
  }

  private distPointToSegment(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): number {
    const ab = new THREE.Vector2().subVectors(b, a);
    const ap = new THREE.Vector2().subVectors(p, a);
    const lenSq = ab.lengthSq();
    if (lenSq === 0) return ap.length();

    let t = ap.dot(ab) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = new THREE.Vector2().addVectors(a, ab.multiplyScalar(t));
    return p.distanceTo(proj);
  }

  /**
   * Genera el siguiente nombre/identificador lógico para la nueva grilla.
   */
  private generateNextGridName(p1: THREE.Vector2, p2: THREE.Vector2): string {
    const isVertical = Math.abs(p1.x - p2.x) < Math.abs(p1.y - p2.y);
    if (isVertical) {
      // Números (1, 2, 3...)
      const nums = this.gridSystem.elements
        .map(e => parseInt(e.name))
        .filter(n => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return (max + 1).toString();
    } else {
      // Letras (A, B, C...)
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const existing = this.gridSystem.elements.map(e => e.name.toUpperCase());
      for (let i = 0; i < letters.length; i++) {
        if (!existing.includes(letters[i])) return letters[i];
      }
      return `G${this.gridSystem.elements.length + 1}`;
    }
  }

  private createDimensionSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = DIMENSIONS.drawing.dimensionCanvasWidth;
    canvas.height = DIMENSIONS.drawing.dimensionCanvasHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = THEME.preview.dimensionBackground;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, DIMENSIONS.drawing.dimensionBoxRadius);
    ctx.fill();

    ctx.lineWidth = DIMENSIONS.drawing.dimensionLineWidth;
    ctx.strokeStyle = THEME.preview.dimensionBorder;
    ctx.stroke();

    ctx.font = `bold ${DIMENSIONS.drawing.dimensionFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = THEME.preview.dimensionText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(
      DIMENSIONS.drawing.dimensionSpriteScale.x,
      DIMENSIONS.drawing.dimensionSpriteScale.y,
      DIMENSIONS.drawing.dimensionSpriteScale.z
    );
    sprite.renderOrder = DIMENSIONS.renderOrders.drawingDimension;
    return sprite;
  }

  private clearPreview(): void {
    while (this.previewGroup.children.length > 0) {
      const obj = this.previewGroup.children[0];
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
      this.previewGroup.remove(obj);
    }
    this.previewLine = null;
    this.previewArc = null;
    this.previewRefLine = null;
    this.dimensionSprite = null;
    this.previewStartBubble = null;
    this.previewEndBubble = null;
  }
}
