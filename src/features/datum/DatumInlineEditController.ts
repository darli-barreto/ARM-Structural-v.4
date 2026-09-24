import * as THREE from 'three';
import { DIMENSIONS } from '../../config/dimensions.config';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { Viewer } from '../../core/Viewer';
import type { BimView } from '../../core/views/BimView';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import type { Sidebar } from '../sidebar/SidebarController';

export class DatumInlineEditController {
  constructor(
    private readonly viewer: Viewer,
    private readonly gridSystem: GridSystem,
    private readonly levelSystem: LevelSystem,
    private readonly sidebar: Sidebar,
    private readonly footer: FooterStatusBar,
    private readonly updateRibbonLevelSelector: () => void,
    private readonly raycaster: THREE.Raycaster,
    private readonly isInsideView: (event: MouseEvent, activeView: BimView) => boolean,
    private readonly setRay: (event: MouseEvent, activeView: BimView, raycaster: THREE.Raycaster) => void,
  ) {}

  public handleDoubleClick(event: MouseEvent): void {
    if (this.isUiTarget(event.target as HTMLElement)) return;

    const activeView = this.viewer.viewManager.getActiveView();
    if (!activeView || !this.isInsideView(event, activeView)) return;
    this.setRay(event, activeView, this.raycaster);

    if (activeView.type === 'elevation' || activeView.type === '3d') {
      const hits = this.raycaster.intersectObjects(this.levelSystem.bubbleHits.map(bubble => bubble.mesh));
      if (!hits.length) return;
      const data = hits[0].object.userData as { levelId?: string; end?: 'start' | 'end' };
      if (!data?.levelId) return;
      const hit = this.levelSystem.bubbleHits.find(bubble => bubble.mesh === hits[0].object);
      this.levelSystem.openInlineEditor(
        data.levelId,
        hit ? hit.worldPos : hits[0].point,
        activeView.camera,
        activeView.domElement,
        () => {
          this.updateRibbonLevelSelector();
          const selected = this.levelSystem.getSelectedLevel();
          if (selected) this.sidebar.showLevelProperties(
            selected,
            () => { this.levelSystem.rebuildMeshes(); this.updateRibbonLevelSelector(); },
            id => { this.levelSystem.deleteLevel(id); this.updateRibbonLevelSelector(); },
          );
          this.footer.setMessage('Nivel actualizado correctamente.');
        },
        warning => this.footer.setMessage(warning),
      );
      event.stopPropagation();
      return;
    }

    if (activeView.type !== 'plan') return;
    const hits = this.raycaster.intersectObjects([
      ...this.gridSystem.bubbleHits.map(bubble => bubble.mesh),
      ...this.gridSystem.bubbleSprites,
    ]);
    let gridId: string | null = null;
    let end: 'start' | 'end' | undefined;
    if (hits.length) {
      const data = hits[0].object.userData as { gridId?: string; end?: 'start' | 'end' };
      if (data?.gridId) { gridId = data.gridId; end = data.end; }
    }

    if (!gridId) {
      const gridHits = this.raycaster.intersectObjects(this.gridSystem.gridHitMeshes);
      if (gridHits.length) {
        const data = gridHits[0].object.userData as { gridId?: string; end?: 'start' | 'end'; isBubbleHit?: boolean };
        if (data?.gridId && data.isBubbleHit) {
          gridId = data.gridId;
          end = data.end;
        } else if (data?.gridId) {
          const nearest = this.gridSystem.bubbleHits
            .filter(bubble => bubble.gridId === data.gridId)
            .sort((a, b) => a.worldPos.distanceTo(gridHits[0].point) - b.worldPos.distanceTo(gridHits[0].point))[0];
          if (nearest && nearest.worldPos.distanceTo(gridHits[0].point) < DIMENSIONS.grid.bubbleDoubleClickMaxDist) {
            gridId = nearest.gridId;
            end = nearest.end;
          }
        }
      }
    }

    if (!gridId) return;
    const opened = this.gridSystem.openBubbleRename(gridId, end, activeView.camera, activeView.domElement, warning => this.footer.setMessage(warning));
    if (!opened) return;
    this.gridSystem.selectGrid(gridId);
    const selected = this.gridSystem.getSelectedGrid();
    if (selected) this.sidebar.showGridProperties(selected, () => this.gridSystem.rebuildSystem(), id => this.gridSystem.deleteGrid(id));
    this.footer.setMessage('Editando identificador de burbuja. Escribe el nuevo nombre y presiona Enter.');
    event.stopPropagation();
  }

  private isUiTarget(target: HTMLElement): boolean {
    return !!target.closest('#app-header, #app-sidebar, #view-tabs-bar, #app-footer, .view-panel-header') || target.id === 'grid-inline-bubble-input';
  }
}
