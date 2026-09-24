import * as THREE from 'three';
import { GRID_X, GRID_Z, LEVELS_Y } from '../config/structural.config';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';
import { BimView } from '../core/views/BimView';

export class SnappingManager {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectPoint = new THREE.Vector3();

  public snapRing: THREE.Mesh;
  public currentSnappedPosition: { x: number; z: number } | null = null;
  public activeLevelIdx = 0;
  public enabled = false;
  public activeViewGetter: () => BimView;
  private onMouseMove = (event: MouseEvent): void => this.handleMouseMove(event);

  constructor(private scene: THREE.Scene, activeViewGetter: () => BimView) {
    this.activeViewGetter = activeViewGetter;

    this.snapRing = new THREE.Mesh(
      new THREE.RingGeometry(
        DIMENSIONS.snapping.ringInnerRadius,
        DIMENSIONS.snapping.ringOuterRadius,
        DIMENSIONS.snapping.ringSegments
      ).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: THEME.snapping.ring, side: THREE.DoubleSide })
    );
    this.snapRing.visible = false;
    scene.add(this.snapRing);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.enabled) {
      this.snapRing.visible = false;
      this.currentSnappedPosition = null;
      return;
    }

    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();

    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      this.snapRing.visible = false;
      this.currentSnappedPosition = null;
      return;
    }

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, activeView.camera);
    const levelElevation = LEVELS_Y[this.activeLevelIdx] || 0;
    this.plane.constant = -levelElevation;

    if (this.raycaster.ray.intersectPlane(this.plane, this.intersectPoint)) {
      if (GRID_X.length > 0 && GRID_Z.length > 0) {
        const nearestX = GRID_X.reduce((prev, curr) => 
          Math.abs(curr - this.intersectPoint.x) < Math.abs(prev - this.intersectPoint.x) ? curr : prev
        );
        const nearestZ = GRID_Z.reduce((prev, curr) => 
          Math.abs(curr - this.intersectPoint.z) < Math.abs(prev - this.intersectPoint.z) ? curr : prev
        );

        const dist = Math.hypot(this.intersectPoint.x - nearestX, this.intersectPoint.z - nearestZ);
        if (dist < DIMENSIONS.snapping.snapDistanceThreshold) {
          this.snapRing.position.set(nearestX, levelElevation + DIMENSIONS.snapping.ringHeightOffset, nearestZ);
          this.snapRing.visible = true;
          this.currentSnappedPosition = { x: nearestX, z: nearestZ };
        } else {
          this.snapRing.visible = false;
          this.currentSnappedPosition = null;
        }
      } else {
        // Cuadrícula libre (snap a 1 metro) si no hay rejillas definidas aún
        const snapX = Math.round(this.intersectPoint.x);
        const snapZ = Math.round(this.intersectPoint.z);
        this.snapRing.position.set(snapX, levelElevation + DIMENSIONS.snapping.ringHeightOffset, snapZ);
        this.snapRing.visible = true;
        this.currentSnappedPosition = { x: snapX, z: snapZ };
      }
    }
  }

  public dispose(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    this.scene.remove(this.snapRing);
    this.snapRing.geometry.dispose();
    (this.snapRing.material as THREE.Material).dispose();
    this.currentSnappedPosition = null;
  }
}
