import * as THREE from 'three';
import { GridDrawMode, LEVELS_Y } from '../config/structural.config';
import { GridSystem } from '../core/GridSystem';
import { BimView } from '../core/views/BimView';
import { ElementRegistry } from './structural/ElementRegistry';
import { GridPickLineController } from './GridPickLineController';
import {
  applyOrtho as constrainOrtho,
  calculateArcCenterEnds as getArcByCenter,
  calculateArcStartEndRadius as getArcByRadius,
  calculateOffsetLine as getOffsetLine,
  generateNextGridName,
  type ArcDrawingData,
} from './GridDrawingGeometry';
import { GridDrawingPreviewRenderer } from './GridDrawingPreviewRenderer';

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
  public previewGroup: THREE.Group;
  private previewRenderer: GridDrawingPreviewRenderer;
  private pickLineController: GridPickLineController;

  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectPoint = new THREE.Vector3();
  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (event.key === 'Shift' || event.key === 'Control') {
      this.isOrthoActive = true;
      if (this.lastMouseEvent) this.handlePointerMove(this.lastMouseEvent);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.cyclePickCandidate();
    } else if (event.key === 'Escape') {
      this.cancelCurrentDraw();
    }
  };
  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Shift' && event.key !== 'Control') return;
    this.isOrthoActive = false;
    if (this.enabled && this.lastMouseEvent) this.handlePointerMove(this.lastMouseEvent);
  };

  constructor(
    scene: THREE.Scene,
    private gridSystem: GridSystem,
    registry: ElementRegistry,
    private activeViewGetter: () => BimView,
    private onStatusMessage: (msg: string) => void
  ) {
    this.previewRenderer = new GridDrawingPreviewRenderer(gridSystem);
    this.previewGroup = this.previewRenderer.group;
    scene.add(this.previewGroup);
    this.pickLineController = new GridPickLineController(
      registry,
      gridSystem,
      this.previewRenderer,
      onStatusMessage,
    );

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
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
    this.pickLineController.clearHoveredEdge();
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
    return constrainOrtho(origin, target);
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
      this.pickLineController.updatePreview(cur, elev, this.currentOffset);
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
      return this.pickLineController.placeGrid(cur, this.currentOffset);
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
    return getOffsetLine(p1, p2, cursor, offset);
  }

  /**
   * Cálculo de Arco por Inicio, Fin y Radio (3 pasos).
   */
  private calculateArcStartEndRadius(
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    cursor: THREE.Vector2,
    offset: number
  ): ArcDrawingData | null {
    return getArcByRadius(p1, p2, cursor, offset);
  }

  /**
   * Cálculo de Arco por Centro y Extremos con volteo automático (> 180°).
   */
  private calculateArcCenterEnds(
    center: THREE.Vector2,
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    offset: number
  ): ArcDrawingData | null {
    return getArcByCenter(center, p1, p2, offset);
  }

  /**
   * Renderiza la previsualización de línea con desfase y cota de longitud/ángulo.
   */
  private renderLinePreview(p1: THREE.Vector2, p2: THREE.Vector2, elev: number): void {
    const lineSeg = this.calculateOffsetLine(p1, p2, p2, this.currentOffset);
    const nextName = this.generateNextGridName(lineSeg.p1, lineSeg.p2);
    const isOrtho = Boolean(this.isOrthoActive || this.lastMouseEvent?.shiftKey || this.lastMouseEvent?.ctrlKey);
    this.previewRenderer.renderLine(lineSeg, p1, p2, elev, this.currentOffset, isOrtho, nextName);
  }

  /**
   * Previsualización de Arco Inicio-Fin-Radio.
   */
  private renderArcStartEndRadiusPreview(p1: THREE.Vector2, p2: THREE.Vector2, cur: THREE.Vector2, elev: number): void {
    const arcData = this.calculateArcStartEndRadius(p1, p2, cur, this.currentOffset);
    if (!arcData) {
      this.clearPreview();
      return;
    }
    this.previewRenderer.renderArc(arcData, cur, elev);
  }

  /**
   * Previsualización de Arco Centro-Extremos.
   */
  private renderArcCenterEndsPreview(center: THREE.Vector2, p1: THREE.Vector2, cur: THREE.Vector2, elev: number): void {
    const arcData = this.calculateArcCenterEnds(center, p1, cur, this.currentOffset);
    if (!arcData) {
      this.clearPreview();
      return;
    }
    this.previewRenderer.renderArc(arcData, cur, elev);
  }

  public cyclePickCandidate(): void {
    this.pickLineController.cycleCandidate();
  }

  /**
   * Genera el siguiente nombre/identificador lógico para la nueva grilla.
   */
  private generateNextGridName(p1: THREE.Vector2, p2: THREE.Vector2): string {
    return generateNextGridName(p1, p2, this.gridSystem.elements.map(element => element.name));
  }

  private clearPreview(): void {
    this.previewRenderer.clear();
  }
}
