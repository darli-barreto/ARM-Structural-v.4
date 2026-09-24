import { ContextualActions } from '../../datum/ContextualSubheaderController';
import { FooterStatusBar } from '../../footer-status/FooterStatusController';
import { GridDrawingManager } from '../../../tools/GridDrawingManager';
import { GridSystem } from '../../../core/GridSystem';
import { LevelDrawingManager } from '../../../tools/LevelDrawingManager';
import { LevelSystem } from '../../../core/LevelSystem';
import { Viewer } from '../../../core/Viewer';

interface DatumContextualActionDependencies {
  gridDrawingManager: GridDrawingManager;
  gridSystem: GridSystem;
  levelDrawingManager: LevelDrawingManager;
  levelSystem: LevelSystem;
  viewer: Viewer;
  footer: FooterStatusBar;
  updateRibbonLevelSelector: () => void;
}

export function createDatumContextualActions(deps: DatumContextualActionDependencies): ContextualActions {
  return {
    onDrawModeChange: mode => {
      deps.gridDrawingManager.setMode(mode);
      deps.footer.setMessage(`Modo dibujo rejilla Revit: ${mode.toUpperCase()}`);
    },
    onOffsetChange: offset => {
      deps.gridDrawingManager.setOffset(offset);
      deps.footer.setMessage(`Desfase (Offset): ${offset.toFixed(2)}m`);
    },
    onChainChange: chain => {
      deps.gridDrawingManager.setChain(chain);
      deps.footer.setMessage(`Cadena: ${chain ? 'Activada' : 'Desactivada'}`);
    },
    onFilletRadiusChange: radius => deps.gridDrawingManager.setFilletRadius(radius),
    onApplyTemplate: template => {
      deps.gridSystem.applyTemplate(template);
      deps.footer.setMessage(`Plantilla de rejilla aplicada: ${template}`);
    },
    onQuickGenerate: (horizontal, vertical, countX, countZ) => {
      deps.gridSystem.quickGenerate(horizontal, vertical, countX || 5, countZ || 5);
      deps.footer.setMessage(`Rejilla generada: ${horizontal}m × ${vertical}m (${countX || 5}x${countZ || 5} ejes)`);
    },
    onLevelDrawModeChange: mode => {
      deps.levelDrawingManager.setMode(mode);
      deps.footer.setMessage(`Modo colocación nivel: ${mode === 'line' ? 'Línea (2 clics horizontal en alzado)' : 'Pick Line (Desfase desde nivel existente)'}`);
    },
    onLevelOffsetChange: offset => {
      deps.levelDrawingManager.setOffset(offset);
      deps.footer.setMessage(`Desfase de nivel: ${offset.toFixed(2)}m`);
    },
    onLevelMakePlanViewChange: makePlanView => {
      deps.levelDrawingManager.setMakePlanView(makePlanView);
      deps.footer.setMessage(`Crear vista de plano de planta asociada: ${makePlanView ? 'Activado' : 'Desactivado'}`);
    },
    onApplyLevelTemplate: template => {
      const generated = deps.levelSystem.applyTemplate(template);
      deps.updateRibbonLevelSelector();
      deps.viewer.viewManager.syncPlanViews(generated);
      deps.footer.setMessage(`Plantilla de niveles aplicada: ${template.toUpperCase()} (${generated.length} niveles generados)`);
    },
    onQuickGenerateLevels: config => {
      const generated = deps.levelSystem.quickGenerate(config);
      deps.updateRibbonLevelSelector();
      if (config.createPlanViews) deps.viewer.viewManager.syncPlanViews(generated);
      deps.footer.setMessage(`⚡ Quick Generate completado: Torre de ${generated.length} niveles generada con éxito.`);
    },
  };
}
