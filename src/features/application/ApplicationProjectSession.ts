import type { Viewer } from '../../core/Viewer';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { WasmBridge } from '../../kernel/WasmBridge';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { GripManager } from '../../tools/structural/GripManager';
import type { PlacementPreview } from '../../tools/PlacementPreview';
import type { SnappingManager } from '../../tools/SnappingManager';
import type { HeaderRibbon } from '../ribbon/HeaderRibbonController';
import type { Sidebar } from '../sidebar/SidebarController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import type { ManagedElement } from '../../tools/structural/types';
import { AnalysisPanel } from '../analysis/AnalysisPanelController';
import { DualModelController } from '../dual-model/DualModelController';
import { ProjectController } from '../project/ProjectController';
import { ExamplesModal } from '../examples/ExamplesModalView.tsx';
import { ExampleProjectLoader } from './ExampleProjectLoader';

interface ApplicationProjectSessionDependencies {
  viewer: Viewer;
  structural: StructuralManager;
  selection: SelectionManager;
  levels: LevelSystem;
  grids: GridSystem;
  wasm: WasmBridge;
  ribbon: HeaderRibbon;
  preview: PlacementPreview;
  gripManager: GripManager;
  snapping: SnappingManager;
  sidebar: Sidebar;
  footer: FooterStatusBar;
  updateRibbonLevelSelector: () => void;
  focusElementIn3D: (element: ManagedElement) => void;
}

export class ApplicationProjectSession {
  private constructor(
    private readonly analysisPanel: AnalysisPanel,
    private readonly dualModelController: DualModelController,
    private readonly projectController: ProjectController,
    private readonly examplesModal: ExamplesModal,
  ) {}

  public static async start(deps: ApplicationProjectSessionDependencies): Promise<ApplicationProjectSession> {
    const analysisPanel = new AnalysisPanel(id => {
      const element = deps.structural.registry.findById(id);
      if (element) deps.focusElementIn3D(element);
    });
    const dualModelController = new DualModelController(
      deps.viewer,
      deps.structural.registry,
      deps.selection,
      analysisPanel,
      () => {
        deps.ribbon.setTool('select');
        deps.preview.hide();
        deps.gripManager.clearGrips();
      },
    );
    const projectController = new ProjectController(
      deps.structural,
      deps.levels,
      deps.grids,
      deps.wasm,
      () => {
        deps.selection.clearSelection();
        deps.gripManager.clearGrips();
        deps.viewer.viewManager.syncPlanViews(deps.levels.getLevels());
        deps.sidebar.updateProjectBrowser(deps.levels.getLevels(), deps.viewer.viewManager.activeViewId);
        deps.updateRibbonLevelSelector();
      },
      () => analysisPanel.open(),
      () => analysisPanel.getSetup(),
      setup => analysisPanel.restoreSetup(setup),
    );

    await projectController.init();

    const exampleProjectLoader = new ExampleProjectLoader({
      projectController,
      ribbon: deps.ribbon,
      preview: deps.preview,
      gridSystem: deps.grids,
      levelSystem: deps.levels,
      snapping: deps.snapping,
      sidebar: deps.sidebar,
      viewer: deps.viewer,
      structural: deps.structural,
      footer: deps.footer,
      analysisPanel,
    });
    const examplesModal = new ExamplesModal((id, analyze) => exampleProjectLoader.load(id, analyze));

    return new ApplicationProjectSession(analysisPanel, dualModelController, projectController, examplesModal);
  }

  public openExamples(): void {
    this.examplesModal.open();
  }

  public dispose(): void {
    this.dualModelController.dispose();
    this.analysisPanel.dispose();
    this.projectController.dispose();
  }
}
