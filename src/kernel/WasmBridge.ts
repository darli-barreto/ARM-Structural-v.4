import * as THREE from 'three';
import { THEME, VisualStyle } from '../config/theme.config';
import type { StructuralDefinition } from '../core/model/Geometry';
import { Frame2dKernelClient, type Frame2dSolveOptions } from './worker/Frame2dKernelClient';
import type { Frame2dModelInputV1, Frame2dResultV1 } from './worker/frame2d.protocol';
import { KernelClient, type MeshOptions } from './worker/KernelClient';
import type { KernelGeometry, KernelMeshResult } from './worker/protocol';
import {
  assertKernelPoint,
  assertKernelPositive,
  assertKernelSegment,
  KERNEL_CONTRACT_VERSION,
} from './KernelContract';

export interface MeshData {
  geometry: THREE.BufferGeometry;
  volume: number;
  definition: StructuralDefinition;
}

function createBoxGeometry(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): THREE.BufferGeometry {
  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const depth = Math.max(0.001, maxZ - minZ);
  const geom = new THREE.BoxGeometry(width, height, depth);
  geom.translate(minX + width / 2, minY + height / 2, minZ + depth / 2);
  return geom;
}

export class WasmBridge {
  private ready = false;
  private kernelClient: KernelClient | undefined;
  private frame2dKernelClient: Frame2dKernelClient | undefined;
  public readonly contractVersion = KERNEL_CONTRACT_VERSION;

  /** Opt-in WASM geometry. Existing synchronous methods continue to use Three.js. */
  public createKernelMesh(element: KernelGeometry, options: MeshOptions): Promise<KernelMeshResult> {
    this.kernelClient ??= new KernelClient();
    return this.kernelClient.mesh(element, options);
  }

  /** Opt-in SI-unit 2D frame analysis. The active TypeScript solver remains unchanged. */
  public solveKernelFrame2d(model: Frame2dModelInputV1, options: Frame2dSolveOptions): Promise<Frame2dResultV1> {
    this.frame2dKernelClient ??= new Frame2dKernelClient();
    return this.frame2dKernelClient.solve(model, options);
  }

  public disposeKernel(): void {
    this.kernelClient?.dispose();
    this.kernelClient = undefined;
    this.frame2dKernelClient?.dispose();
    this.frame2dKernelClient = undefined;
  }

  // 1. MATERIAL LÍNEA OCULTA (Revit Hidden Line): Blanco puro opaco en AMBAS caras para tapar aristas traseras
  public hiddenLineMaterial = new THREE.MeshBasicMaterial({ 
    color: THEME.styles.hidden_line.surface,
    side: THREE.DoubleSide, // CLAVE: Dibuja la cara frontal y ocluye las aristas de atrás
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  // 2. MATERIAL ALÁMBRICO (Revit Wireframe)
  public wireframeMaterial = new THREE.MeshBasicMaterial({ 
    colorWrite: false, 
    depthWrite: false 
  });

  // 3. MATERIALES COLORES COHERENTES (Revit Consistent Colors)
  public consistentMaterials = {
    footing: new THREE.MeshBasicMaterial({ color: THEME.elements.footing.surface, side: THREE.DoubleSide }),
    column:  new THREE.MeshBasicMaterial({ color: THEME.elements.column.surface, side: THREE.DoubleSide }),
    beam:    new THREE.MeshBasicMaterial({ color: THEME.elements.beam.surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    slab:    new THREE.MeshBasicMaterial({ color: THEME.elements.slab.surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };

  // 4. MATERIALES SOMBREADOS (Revit Shaded - PBR con sombras)
  public shadedMaterials = {
    footing: new THREE.MeshStandardMaterial({ color: THEME.elements.footing.surface, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    column:  new THREE.MeshStandardMaterial({ color: THEME.elements.column.surface, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    beam:    new THREE.MeshStandardMaterial({ color: THEME.elements.beam.surface, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    slab:    new THREE.MeshStandardMaterial({ color: THEME.elements.slab.surface, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };

  public async init(): Promise<void> {
    this.ready = true;
    console.log('[Geometry] Motor geometrico Three.js inicializado.');
  }

  public isReady(): boolean {
    return this.ready;
  }

  public getMaterial(type: 'footing' | 'column' | 'beam' | 'slab', style: VisualStyle): THREE.Material {
    switch (style) {
      case 'hidden_line':
        return this.hiddenLineMaterial;
      case 'wireframe':
        return this.wireframeMaterial;
      case 'consistent_colors':
        return this.consistentMaterials[type];
      case 'shaded':
      default:
        return this.shadedMaterials[type];
    }
  }

  public buildGeometry(meshData: MeshData): THREE.BufferGeometry {
    meshData.geometry.userData.definition = structuredClone(meshData.definition);
    return meshData.geometry;
  }

  public createFooting(x: number, y: number, z: number, w: number, l: number, h: number): MeshData {
    assertKernelPoint({ x, y, z }, 'footing.center');
    assertKernelPositive(w, 'footing.width');
    assertKernelPositive(l, 'footing.length');
    assertKernelPositive(h, 'footing.height');
    const minX = x - w / 2;
    const maxX = x + w / 2;
    const minY = y;
    const maxY = y + h;
    const minZ = z - l / 2;
    const maxZ = z + l / 2;
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = w * l * h;
    return { geometry, volume, definition:{type:'footing',center:{x,y,z},width:w,length:l,height:h} };
  }

  public createColumn(x: number, z: number, y0: number, y1: number, w: number, d: number): MeshData {
    assertKernelSegment({ x, y: y0, z }, { x, y: y1, z }, 'column.axis');
    assertKernelPositive(w, 'column.width');
    assertKernelPositive(d, 'column.depth');
    const minX = x - w / 2;
    const maxX = x + w / 2;
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const minZ = z - d / 2;
    const maxZ = z + d / 2;
    const height = Math.max(0.001, maxY - minY);
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = w * d * height;
    return { geometry, volume, definition:{type:'column',columnStyle:'vertical',basePoint:{x,y:minY,z},topPoint:{x,y:maxY,z},width:w,depth:d} };
  }

  public createBeam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, w: number, h: number): MeshData {
    assertKernelSegment({ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }, 'beam.axis');
    assertKernelPositive(w, 'beam.width');
    assertKernelPositive(h, 'beam.height');
    const minY = Math.min(y1, y2) - h;
    const maxY = Math.max(y1, y2);
    const dx = Math.abs(x2 - x1);
    const dz = Math.abs(z2 - z1);

    let minX: number;
    let maxX: number;
    let minZ: number;
    let maxZ: number;
    let length: number;

    if (dx >= dz) {
      minX = Math.min(x1, x2);
      maxX = Math.max(x1, x2);
      const midZ = (z1 + z2) / 2;
      minZ = midZ - w / 2;
      maxZ = midZ + w / 2;
      length = Math.max(0.001, maxX - minX);
    } else {
      const midX = (x1 + x2) / 2;
      minX = midX - w / 2;
      maxX = midX + w / 2;
      minZ = Math.min(z1, z2);
      maxZ = Math.max(z1, z2);
      length = Math.max(0.001, maxZ - minZ);
    }

    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = length * w * h;
    return { geometry, volume, definition:{type:'beam',startPoint:{x:x1,y:y1,z:z1},endPoint:{x:x2,y:y2,z:z2},width:w,height:h} };
  }

  public createSlab(cx: number, cy: number, cz: number, wx: number, lz: number, th: number): MeshData {
    assertKernelPoint({ x: cx, y: cy, z: cz }, 'slab.center');
    assertKernelPositive(wx, 'slab.width');
    assertKernelPositive(lz, 'slab.length');
    assertKernelPositive(th, 'slab.thickness');
    const minX = cx - wx / 2;
    const maxX = cx + wx / 2;
    const minY = cy;
    const maxY = cy + th;
    const minZ = cz - lz / 2;
    const maxZ = cz + lz / 2;
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = wx * lz * th;
    return { geometry, volume, definition:{type:'slab',boundary:[{x:minX,y:cy,z:minZ},{x:maxX,y:cy,z:minZ},{x:maxX,y:cy,z:maxZ},{x:minX,y:cy,z:maxZ}],voids:[],thickness:th,elevationY:cy} };
  }

  /**
   * Genera una Columna Inclinada o Vertical conectando dos puntos 3D arbitrarios (p1 -> p2).
   */
  public createSlantedColumn(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    w: number,
    d: number
  ): MeshData {
    assertKernelSegment(p1, p2, 'column.axis');
    assertKernelPositive(w, 'column.width');
    assertKernelPositive(d, 'column.depth');
    const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
    const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
    const dir = new THREE.Vector3().subVectors(v2, v1);
    const length = Math.max(0.001, dir.length());
    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

    // Si es vertical pura (mismo X y Z)
    if (Math.abs(p1.x - p2.x) < 0.001 && Math.abs(p1.z - p2.z) < 0.001) {
      return this.createColumn(p1.x, p1.z, p1.y, p2.y, w, d);
    }

    const unitDir = dir.clone().normalize();
    const geom = new THREE.BoxGeometry(w, length, d);

    // Orientar el cilindro/caja vertical Y hacia el vector unitario
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);
    const mat = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    geom.applyMatrix4(mat);
    geom.computeVertexNormals();

    const volume = w * d * length;
    return { geometry: geom, volume, definition:{type:'column',columnStyle:'slanted',basePoint:{...p1},topPoint:{...p2},width:w,depth:d} };
  }

  /**
   * Genera una Viga entre dos puntos 3D arbitrarios (p1 -> p2) orientada con vector de gravedad.
   */
  public createArbitraryBeam(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    w: number,
    h: number
  ): MeshData {
    assertKernelSegment(p1, p2, 'beam.axis');
    assertKernelPositive(w, 'beam.width');
    assertKernelPositive(h, 'beam.height');
    const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
    const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
    const spanVec = new THREE.Vector3().subVectors(v2, v1);
    const length = Math.max(0.001, spanVec.length());
    const forward = spanVec.clone().normalize();

    // Sistema de coordenadas ortonormal: en estructuras la cara superior de la viga es horizontal
    const reference = Math.abs(forward.y) > 0.999999
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(reference, forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();

    // La cota superior de la viga se alinea con la línea entre nodos (p1 -> p2)
    // Por lo tanto, el centro volumétrico de la viga está desplazado -h/2 respecto al centro de los nodos
    const midNodes = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const center = midNodes.clone().sub(up.clone().multiplyScalar(h / 2));

    const geom = new THREE.BoxGeometry(w, h, length);

    // Matriz de rotación basada en [right, up, forward]
    const rotMat = new THREE.Matrix4().makeBasis(right, up, forward);
    const transformMat = new THREE.Matrix4().setPosition(center).multiply(rotMat);
    geom.applyMatrix4(transformMat);
    geom.computeVertexNormals();

    const volume = length * w * h;
    return { geometry: geom, volume, definition:{type:'beam',startPoint:{...p1},endPoint:{...p2},width:w,height:h} };
  }

  /**
   * Genera una Losa por Boceto Libre (Sketch) de polígono cerrado con soporte para huecos (voids).
   */
  public createPolygonSlab(
    boundary: { x: number; y: number; z: number }[],
    voids: { x: number; y: number; z: number }[][] = [],
    thickness: number,
    elevY: number
  ): MeshData {
    assertKernelPositive(thickness, 'slab.thickness');
    if (!Number.isFinite(elevY)) throw new Error('KERNEL_NON_FINITE: slab.elevation');
    if (boundary.length < 3) throw new Error('KERNEL_INVALID_POLYGON: slab.boundary');
    boundary.forEach((point, index) => assertKernelPoint(point, `slab.boundary[${index}]`));
    voids.forEach((ring, ringIndex) => {
      if (ring.length < 3) throw new Error(`KERNEL_INVALID_POLYGON: slab.voids[${ringIndex}]`);
      ring.forEach((point, pointIndex) => assertKernelPoint(point, `slab.voids[${ringIndex}][${pointIndex}]`));
    });

    const shape = new THREE.Shape();
    shape.moveTo(boundary[0].x, boundary[0].z);
    for (let i = 1; i < boundary.length; i++) {
      shape.lineTo(boundary[i].x, boundary[i].z);
    }
    shape.closePath();

    // Huecos y shafts
    if (voids && voids.length > 0) {
      voids.forEach(vPoly => {
        if (vPoly.length >= 3) {
          const holePath = new THREE.Path();
          holePath.moveTo(vPoly[0].x, vPoly[0].z);
          for (let k = 1; k < vPoly.length; k++) {
            holePath.lineTo(vPoly[k].x, vPoly[k].z);
          }
          holePath.closePath();
          shape.holes.push(holePath);
        }
      });
    }

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: thickness,
      bevelEnabled: false,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // En ExtrudeGeometry, la extrusión va a lo largo del eje Z local.
    // Rotamos alrededor del eje X para que la profundidad se proyecte verticalmente hacia abajo en Y.
    geom.rotateX(Math.PI / 2);
    // La cara superior de la losa queda en elevY + thickness, por lo que trasladamos para que la cara superior esté en elevY + thickness
    geom.translate(0, elevY + thickness, 0);
    geom.computeVertexNormals();

    // Cálculo de área por fórmula de Shoelace
    const calcArea = (pts: { x: number; z: number }[]): number => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        a += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
      }
      return Math.abs(a) / 2;
    };

    let totalArea = calcArea(boundary);
    if (voids) {
      voids.forEach(v => {
        totalArea = Math.max(0, totalArea - calcArea(v));
      });
    }

    const volume = totalArea * thickness;
    return { geometry: geom, volume, definition:{type:'slab',boundary:structuredClone(boundary),voids:structuredClone(voids),thickness,elevationY:elevY} };
  }
}
