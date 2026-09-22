export interface Vector3D { x: number; y: number; z: number }
export interface ColumnDefinition {
  type: 'column'; columnStyle: 'vertical' | 'slanted'; basePoint: Vector3D; topPoint: Vector3D;
  width: number; depth: number; baseOffset?: number; topOffset?: number;
}
export interface BeamDefinition { type: 'beam'; startPoint: Vector3D; endPoint: Vector3D; width: number; height: number }
export interface SlabDefinition { type: 'slab'; boundary: Vector3D[]; voids?: Vector3D[][]; thickness: number; elevationY: number }
export interface FootingDefinition { type: 'footing'; center: Vector3D; width: number; length: number; height: number }
export type StructuralDefinition = ColumnDefinition | BeamDefinition | SlabDefinition | FootingDefinition;
export const distance = (a: Vector3D, b: Vector3D) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const area = (p: Vector3D[]) => Math.abs(p.reduce((s, a, i) => {
  const b = p[(i + 1) % p.length]; return s + a.x * b.z - b.x * a.z;
}, 0)) / 2;
const cross = (a: Vector3D, b: Vector3D, c: Vector3D) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const onSegment = (a: Vector3D, b: Vector3D, p: Vector3D) => Math.abs(cross(a, b, p)) < 1e-8 && p.x >= Math.min(a.x, b.x) - 1e-8 && p.x <= Math.max(a.x, b.x) + 1e-8 && p.z >= Math.min(a.z, b.z) - 1e-8 && p.z <= Math.max(a.z, b.z) + 1e-8;
function intersects(a: Vector3D, b: Vector3D, c: Vector3D, d: Vector3D): boolean {
  return (cross(a,b,c) * cross(a,b,d) < 0 && cross(c,d,a) * cross(c,d,b) < 0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}
function inside(p: Vector3D, ring: Vector3D[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x) result = !result;
  }
  return result;
}
export function validateDefinition(d: StructuralDefinition): void {
  const positive = (...values: number[]) => { if (values.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('Las dimensiones deben ser positivas y finitas.'); };
  const point = (p: Vector3D) => { if (!p || ![p.x,p.y,p.z].every(Number.isFinite)) throw new Error('Coordenadas no validas.'); };
  if (!d || !['beam','column','slab','footing'].includes(d.type)) throw new Error('Tipo geometrico no valido.');
  if (d.type === 'beam' || d.type === 'column') {
    const a = d.type === 'beam' ? d.startPoint : d.basePoint, b = d.type === 'beam' ? d.endPoint : d.topPoint;
    point(a); point(b); positive(d.width, d.type === 'beam' ? d.height : d.depth);
    if (distance(a,b) < 0.001) throw new Error('La longitud minima es 1 mm.');
    if (d.type === 'column' && d.columnStyle === 'vertical' && Math.hypot(a.x-b.x,a.z-b.z) > 1e-6) throw new Error('Una columna vertical debe mantener X y Z.');
  } else if (d.type === 'footing') { point(d.center); positive(d.width,d.length,d.height); }
  else {
    positive(d.thickness);
    if (!Number.isFinite(d.elevationY)) throw new Error('Cota no valida.');
    const rings = [d.boundary, ...(d.voids || [])];
    rings.forEach((ring, r) => {
      if (!Array.isArray(ring) || ring.length < 3) throw new Error('Cada contorno necesita al menos tres vertices.');
      ring.forEach(point);
      if (area(ring) < 1e-6) throw new Error('El contorno tiene area nula.');
      for (let i=0;i<ring.length;i++) {
        const a=ring[i], b=ring[(i+1)%ring.length];
        if (Math.hypot(a.x-b.x,a.z-b.z)<0.001) throw new Error('Hay vertices repetidos o demasiado cercanos.');
        for (let j=i+1;j<ring.length;j++) {
          if (j===i+1 || (i===0 && j===ring.length-1)) continue;
          if (intersects(a,b,ring[j],ring[(j+1)%ring.length])) throw new Error('El contorno se cruza consigo mismo.');
        }
      }
      for (let s=0;s<r;s++) {
        const other = rings[s];
        for (let i=0;i<ring.length;i++) for (let j=0;j<other.length;j++) {
          if (intersects(ring[i],ring[(i+1)%ring.length],other[j],other[(j+1)%other.length])) throw new Error('Los contornos se cruzan o se tocan.');
        }
        if (s>0 && (inside(ring[0],other)||inside(other[0],ring))) throw new Error('Los huecos no pueden superponerse.');
      }
      if (r>0 && !inside(ring[0],d.boundary)) throw new Error('El hueco debe estar dentro del contorno exterior.');
    });
  }
}
export function quantities(d: StructuralDefinition) {
  validateDefinition(d);
  let volume=0, surfaceArea=0, length: number | undefined, height: number | undefined;
  let origin: Vector3D, dimensions: string;
  if (d.type==='beam' || d.type==='column') {
    const a=d.type==='beam'?d.startPoint:d.basePoint, b=d.type==='beam'?d.endPoint:d.topPoint;
    const side=d.type==='beam'?d.height:d.depth;
    length=distance(a,b); height=d.type==='column'?length:undefined; origin={...a};
    volume=d.width*side*length;
    surfaceArea=d.type==='beam'?(d.width+2*side)*length:2*(d.width+side)*length;
    dimensions=`${d.width.toFixed(2)} x ${side.toFixed(2)} m; L=${length.toFixed(3)} m`;
  } else if (d.type==='footing') {
    origin={...d.center}; volume=d.width*d.length*d.height; surfaceArea=2*(d.width+d.length)*d.height;
    dimensions=`${d.width.toFixed(2)} x ${d.length.toFixed(2)} x ${d.height.toFixed(2)} m`;
  } else {
    surfaceArea=area(d.boundary)-(d.voids||[]).reduce((s,r)=>s+area(r),0);
    volume=surfaceArea*d.thickness; origin={...d.boundary[0],y:d.elevationY};
    dimensions=`e=${d.thickness.toFixed(3)} m; A=${surfaceArea.toFixed(3)} m2`;
  }
  if(![volume,surfaceArea].every(Number.isFinite))throw new Error('Las dimensiones exceden el rango numerico.');
  return {volume,surfaceArea,length,height,origin,dimensions};
}
