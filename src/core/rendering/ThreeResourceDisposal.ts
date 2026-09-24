import * as THREE from 'three';

export function disposeObjectResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse(object => {
    const drawable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (drawable.geometry) geometries.add(drawable.geometry);
    const objectMaterials = drawable.material
      ? Array.isArray(drawable.material) ? drawable.material : [drawable.material]
      : [];
    objectMaterials.forEach(material => {
      materials.add(material);
      if (material instanceof THREE.SpriteMaterial && material.map) textures.add(material.map);
    });
  });

  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
}

export function clearThreeGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    disposeObjectResources(child);
    group.remove(child);
  }
}
