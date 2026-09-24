import * as THREE from 'three';
import type { ExampleId } from '../../core/model/ExampleProjects';
import { createExampleProject, examples } from '../../core/model/ExampleProjects';
import type { Viewer } from '../../core/Viewer';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { PlacementPreview } from '../../tools/PlacementPreview';
import type { SnappingManager } from '../../tools/SnappingManager';
import type { HeaderRibbon } from '../ribbon/HeaderRibbonController';
import type { Sidebar } from '../sidebar/SidebarController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import type { ProjectController } from '../project/ProjectController';
import type { AnalysisPanel } from '../analysis/AnalysisPanelController';

interface ExampleProjectLoaderDependencies {
  projectController: ProjectController;
  ribbon: HeaderRibbon;
  preview: PlacementPreview;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  snapping: SnappingManager;
  sidebar: Sidebar;
  viewer: Viewer;
  structural: StructuralManager;
  footer: FooterStatusBar;
  analysisPanel: AnalysisPanel;
}

export class ExampleProjectLoader {
  constructor(private readonly deps: ExampleProjectLoaderDependencies) {}

  public async load(id: ExampleId, analyze: boolean): Promise<boolean> {
    const loaded = await this.deps.projectController.loadExample(createExampleProject(id));
    if (!loaded) return false;

    this.deps.ribbon.setTool('select');
    this.deps.preview.hide();
    this.deps.gridSystem.selectGrid(null);
    this.deps.levelSystem.selectLevel(null);
    this.deps.snapping.activeLevelIdx = 0;
    this.deps.gridSystem.setActiveLevel(0);
    this.deps.sidebar.showEmptyProperties();
    this.deps.viewer.viewManager.openView('view-3d');

    const view = this.deps.viewer.viewManager.views.get('view-3d')!;
    const bounds = new THREE.Box3();
    this.deps.structural.registry.getAll().forEach(element => bounds.expandByObject(element.mesh));
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 3);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(25)) * 1.15;

    view.controls.target.copy(center);
    view.camera.position.copy(center).add(
      new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance),
    );
    view.camera.lookAt(center);
    view.controls.update();

    const example = examples.find(item => item.id === id)!;
    this.deps.footer.setMessage(`${example.name}: ${this.deps.structural.elementCount} elementos / ejemplo no certificado.`);
    if (analyze) setTimeout(() => this.deps.analysisPanel.open(), 0);
    return true;
  }
}
