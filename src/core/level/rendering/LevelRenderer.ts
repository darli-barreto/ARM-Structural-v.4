import * as THREE from 'three';
import { Level } from '../types/LevelTypes';
import { LevelSprites } from './LevelSprites';
import { LevelEndpointRenderer, type LevelEndpointRenderResult } from './LevelEndpointRenderer';
import { THEME } from '../../../config/theme.config';
import { DIMENSIONS } from '../../../config/dimensions.config';

export interface LevelInteractiveControlHits {
  hitMeshes: THREE.Mesh[];
  bubbleHits: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh; worldPos: THREE.Vector3 }>;
  elbowToggles: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }>;
  bubbleToggles: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }>;
  grips: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }>;
  elbowGrips: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }>;
}

export class LevelRenderer {
  public rootGroup = new THREE.Group();

  public linesGroup = new THREE.Group();
  public planesGroup = new THREE.Group();
  public headsGroup = new THREE.Group();
  public hitProxiesGroup = new THREE.Group();
  public highlightsGroup = new THREE.Group();
  public controlsGroup = new THREE.Group();

  public levelHitMeshes: THREE.Mesh[] = [];
  public bubbleHits: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh; worldPos: THREE.Vector3 }> = [];
  public elbowToggles: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }> = [];
  public bubbleToggles: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Sprite }> = [];
  public grips: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }> = [];
  public elbowGrips: Array<{ levelId: string; end: 'start' | 'end'; mesh: THREE.Mesh }> = [];

  public lineMeshMap = new Map<string, THREE.Line[]>();
  public headSpritesMap = new Map<string, THREE.Sprite[]>();
  private highlightMeshesMap = new Map<string, THREE.Mesh[]>();
  private endpointRenderer: LevelEndpointRenderer;

  constructor() {
    this.rootGroup.name = 'BimLevelRenderer';
    this.rootGroup.add(this.planesGroup);
    this.rootGroup.add(this.highlightsGroup);
    this.rootGroup.add(this.linesGroup);
    this.rootGroup.add(this.headsGroup);
    this.rootGroup.add(this.controlsGroup);
    this.rootGroup.add(this.hitProxiesGroup);
    this.endpointRenderer = new LevelEndpointRenderer({
      linesGroup: this.linesGroup,
      headsGroup: this.headsGroup,
      hitProxiesGroup: this.hitProxiesGroup,
      controlsGroup: this.controlsGroup,
    });
  }

  /**
   * Obtiene la lista completa de líneas para raycasting directo
   */
  public getLineMeshes(): THREE.Line[] {
    const list: THREE.Line[] = [];
    this.lineMeshMap.forEach(lines => {
      list.push(...lines);
    });
    return list;
  }

  public rebuild(
    levels: Level[],
    selectedLevelId: string | null,
    hoveredLevelId: string | null,
    halfExtent: number = DIMENSIONS.levels.boundsExtentDefault
  ): void {
    this.clearAll();

    if (!levels || levels.length === 0) {
      return;
    }

    const defaultHalf = halfExtent;

    levels.forEach(lvl => {
      const isSelected = selectedLevelId === lvl.id;
      const isHovered = hoveredLevelId === lvl.id;
      const y = lvl.elevation;

      const xStart = typeof lvl.start?.x === 'number' ? lvl.start.x : -defaultHalf;
      const xEnd = typeof lvl.end?.x === 'number' ? lvl.end.x : defaultHalf;
      const zStart = typeof lvl.start?.z === 'number' ? lvl.start.z : -defaultHalf;
      const zEnd = typeof lvl.end?.z === 'number' ? lvl.end.z : defaultHalf;

      const xSpan = Math.max(1.0, xEnd - xStart);
      const xMid = (xStart + xEnd) / 2;
      const zSpan = Math.max(1.0, zEnd - zStart);
      const zMid = (zStart + zEnd) / 2;

      const hlMeshes: THREE.Mesh[] = [];
      const lvlLines: THREE.Line[] = [];
      const lvlSprites: THREE.Sprite[] = [];

      // 1. Color de línea según estado
      const lineColor = isSelected
        ? THEME.grid.lineActive
        : isHovered
        ? THEME.grid.lineHover
        : THEME.levels.contourLine;

      // 2. Líneas Datum horizontales:
      // 2.1 Línea Frontal (visible en Alzado Sur/Norte y 3D)
      const frontPts = [
        new THREE.Vector3(xStart, y, 0),
        new THREE.Vector3(xEnd, y, 0),
      ];
      const frontGeom = new THREE.BufferGeometry().setFromPoints(frontPts);
      const lineMat = new THREE.LineDashedMaterial({
        color: lineColor,
        dashSize: DIMENSIONS.levels.dashSize,
        gapSize: DIMENSIONS.levels.gapSize,
        transparent: true,
        opacity: isSelected ? 1.0 : isHovered ? 1.0 : DIMENSIONS.levels.opacityLine,
      });
      const frontLine = new THREE.Line(frontGeom, lineMat);
      frontLine.name = lvl.id;
      frontLine.userData = { levelId: lvl.id, isLevelLine: true };
      frontLine.computeLineDistances();
      this.linesGroup.add(frontLine);
      lvlLines.push(frontLine);

      // 2.2 Línea Lateral (visible en Alzado Este/Oeste y 3D)
      const sidePts = [
        new THREE.Vector3(0, y, zStart),
        new THREE.Vector3(0, y, zEnd),
      ];
      const sideGeom = new THREE.BufferGeometry().setFromPoints(sidePts);
      const sideLine = new THREE.Line(sideGeom, lineMat.clone());
      sideLine.name = lvl.id;
      sideLine.userData = { levelId: lvl.id, isLevelLine: true };
      sideLine.computeLineDistances();
      this.linesGroup.add(sideLine);
      lvlLines.push(sideLine);

      // 2.3 Contorno perimetral XZ para 3D
      const rectPts = [
        new THREE.Vector3(xStart, y, zStart),
        new THREE.Vector3(xEnd, y, zStart),
        new THREE.Vector3(xEnd, y, zEnd),
        new THREE.Vector3(xStart, y, zEnd),
        new THREE.Vector3(xStart, y, zStart),
      ];
      const rectGeom = new THREE.BufferGeometry().setFromPoints(rectPts);
      const rectLine = new THREE.Line(rectGeom, lineMat.clone());
      rectLine.name = lvl.id;
      rectLine.userData = { levelId: lvl.id, isLevelLine: true };
      rectLine.computeLineDistances();
      this.linesGroup.add(rectLine);
      lvlLines.push(rectLine);

      this.lineMeshMap.set(lvl.id, lvlLines);

      // 2.4 Plano tenue de referencia en 3D
      const planeGeom = new THREE.PlaneGeometry(xSpan, zSpan);
      planeGeom.rotateX(-Math.PI / 2);
      planeGeom.translate(xMid, y, zMid);
      const planeMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x2563eb : THEME.levels.datumPlane,
        transparent: true,
        opacity: isSelected ? 0.08 : isHovered ? 0.05 : DIMENSIONS.levels.opacityPlane,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      this.planesGroup.add(planeMesh);

      // 2.5 Resalte luminoso (Glow underlay) para Hover y Selección
      // Debe ser visible tanto en Alzado Frontal (XY), Lateral (ZY) como en 3D (XZ)
      const glowMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x0284c7 : 0x00e5ff,
        transparent: true,
        opacity: isSelected ? 0.45 : isHovered ? 0.65 : 0,
        side: THREE.DoubleSide,
        depthTest: false,
      });

      // Ribbon Frontal (plano vertical XY para vista de Alzado Sur/Norte)
      const glowGeomFront = new THREE.PlaneGeometry(xSpan, 1.4);
      const glowMeshFront = new THREE.Mesh(glowGeomFront, glowMat);
      glowMeshFront.position.set(xMid, y, 0);
      glowMeshFront.visible = isSelected || isHovered;
      this.highlightsGroup.add(glowMeshFront);
      hlMeshes.push(glowMeshFront);

      // Ribbon Lateral (plano vertical ZY para vista de Alzado Este/Oeste)
      const glowGeomSide = new THREE.PlaneGeometry(zSpan, 1.4);
      glowGeomSide.rotateY(Math.PI / 2);
      const glowMeshSide = new THREE.Mesh(glowGeomSide, glowMat.clone());
      glowMeshSide.position.set(0, y, zMid);
      glowMeshSide.visible = isSelected || isHovered;
      this.highlightsGroup.add(glowMeshSide);
      hlMeshes.push(glowMeshSide);

      // Ribbon Horizontal (plano horizontal XZ para vista 3D)
      const glowGeom3D = new THREE.PlaneGeometry(xSpan, 1.4);
      glowGeom3D.rotateX(-Math.PI / 2);
      const glowMesh3D = new THREE.Mesh(glowGeom3D, glowMat.clone());
      glowMesh3D.position.set(xMid, y, 0);
      glowMesh3D.visible = isSelected || isHovered;
      this.highlightsGroup.add(glowMesh3D);
      hlMeshes.push(glowMesh3D);

      this.highlightMeshesMap.set(lvl.id, hlMeshes);

      // 3. HITBOXES AMPLIAS Y REACTIVAS DE LÍNEA
      // NOTA CRÍTICA: Se usa transparent: true con opacity: 0 en lugar de visible: false
      // para que THREE.Raycaster pueda detectarlas siempre con total fiabilidad.
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const lineHitGeomX = new THREE.BoxGeometry(xSpan + 4, 2.2, 2.2);
      const lineHitMeshX = new THREE.Mesh(lineHitGeomX, hitMat);
      lineHitMeshX.position.set(xMid, y, 0);
      lineHitMeshX.userData = { isLevelHit: true, isLevelLineHit: true, levelId: lvl.id };
      this.hitProxiesGroup.add(lineHitMeshX);
      this.levelHitMeshes.push(lineHitMeshX);

      const lineHitGeomZ = new THREE.BoxGeometry(2.2, 2.2, zSpan + 4);
      const lineHitMeshZ = new THREE.Mesh(lineHitGeomZ, hitMat);
      lineHitMeshZ.position.set(0, y, zMid);
      lineHitMeshZ.userData = { isLevelHit: true, isLevelLineHit: true, levelId: lvl.id };
      this.hitProxiesGroup.add(lineHitMeshZ);
      this.levelHitMeshes.push(lineHitMeshZ);

      // 4. CABEZALES, CODOS Y CONTROLES DE AMBOS EXTREMOS
      this.collectEndpoint(this.endpointRenderer.render(
        lvl, 'end', { x: xEnd, z: zEnd }, y, isSelected, isHovered,
      ), lvlLines, lvlSprites);
      this.collectEndpoint(this.endpointRenderer.render(
        lvl, 'start', { x: xStart, z: zStart }, y, isSelected, isHovered,
      ), lvlLines, lvlSprites);

      this.headSpritesMap.set(lvl.id, lvlSprites);
    });
  }

  private collectEndpoint(result: LevelEndpointRenderResult, lines: THREE.Line[], sprites: THREE.Sprite[]): void {
    lines.push(...result.lines);
    sprites.push(...result.sprites);
    this.levelHitMeshes.push(...result.hitMeshes);
    this.bubbleHits.push(...result.bubbleHits);
    this.elbowToggles.push(...result.elbowToggles);
    this.bubbleToggles.push(...result.bubbleToggles);
    this.grips.push(...result.grips);
    this.elbowGrips.push(...result.elbowGrips);
  }

  /**
   * Actualización visual rápida de resaltado por Hover y Selección
   */
  public setHoveredLevel(
    levelId: string | null,
    selectedLevelId: string | null,
    levels?: Level[]
  ): void {
    // 1. Actualizar mallas de resalte luminoso (Halo Glow)
    this.highlightMeshesMap.forEach((meshes, id) => {
      const isSelected = id === selectedLevelId;
      const isHovered = id === levelId;
      meshes.forEach(m => {
        m.visible = isSelected || isHovered;
        if (isSelected || isHovered) {
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set(isSelected ? 0x0284c7 : 0x00e5ff);
          mat.opacity = isSelected ? 0.45 : 0.65;
        }
      });
    });

    // 2. Actualizar color de las líneas
    this.lineMeshMap.forEach((lines, id) => {
      const isSelected = id === selectedLevelId;
      const isHovered = id === levelId;
      const color = isSelected
        ? THEME.grid.lineActive
        : isHovered
        ? THEME.grid.lineHover
        : THEME.levels.contourLine;

      lines.forEach(l => {
        if (l.material instanceof THREE.LineDashedMaterial || l.material instanceof THREE.LineBasicMaterial) {
          l.material.color.set(color);
          l.material.opacity = isSelected || isHovered ? 1.0 : DIMENSIONS.levels.opacityLine;
        }
      });
    });

    // 3. Actualizar texturas de cabezal (burbujas) para respuesta visual instantánea
    if (levels) {
      this.headSpritesMap.forEach((sprites, id) => {
        const isSelected = id === selectedLevelId;
        const isHovered = id === levelId;
        const lvl = levels.find(l => l.id === id);
        if (lvl) {
          sprites.forEach(sprite => {
            const newSprite = LevelSprites.createLevelHeadSprite(lvl, isSelected, isHovered);
            const oldMat = sprite.material;
            oldMat.map?.dispose();
            sprite.material = newSprite.material;
          });
        }
      });
    }
  }

  private clearAll(): void {
    const clearGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const child = g.children[0];
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else (child.material as THREE.Material)?.dispose();
        } else if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
        g.remove(child);
      }
    };

    clearGroup(this.linesGroup);
    clearGroup(this.planesGroup);
    clearGroup(this.headsGroup);
    clearGroup(this.hitProxiesGroup);
    clearGroup(this.highlightsGroup);
    clearGroup(this.controlsGroup);

    this.levelHitMeshes = [];
    this.bubbleHits = [];
    this.elbowToggles = [];
    this.bubbleToggles = [];
    this.grips = [];
    this.elbowGrips = [];
    this.highlightMeshesMap.clear();
    this.lineMeshMap.clear();
    this.headSpritesMap.clear();
  }

  public dispose(): void {
    this.clearAll();
  }
}
