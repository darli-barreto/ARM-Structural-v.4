import type { GridDrawMode, ToolType } from '../../config/structural.config';
import type { QuickGenerateLevelConfig, LevelDrawMode, LevelTemplateType } from '../../core/level/types/LevelTypes';
import type { ManagedElement, ArrayOptions } from '../../tools/structural/types';
import {
  contextualSubheaderStore,
  type ContextualBarMode,
  type ContextualSubheaderCommands,
  type ContextualSubheaderSnapshot,
} from './ContextualSubheaderStore';

export interface ContextualActions {
  onDrawModeChange?: (mode: GridDrawMode) => void;
  onOffsetChange?: (offset: number) => void;
  onChainChange?: (chain: boolean) => void;
  onFilletRadiusChange?: (radius: number) => void;
  onApplyTemplate?: (template: '5x5' | '4x4' | '6x6') => void;
  onQuickGenerate?: (hSpacing: number, vSpacing: number, countX?: number, countZ?: number) => void;
  onLevelDrawModeChange?: (mode: LevelDrawMode) => void;
  onLevelOffsetChange?: (offset: number) => void;
  onLevelMakePlanViewChange?: (makePlanView: boolean) => void;
  onApplyLevelTemplate?: (template: LevelTemplateType) => void;
  onQuickGenerateLevels?: (config: QuickGenerateLevelConfig) => void;
  onAtGrid?: () => void;
  onCancel?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onToggleGrid?: () => void;
  onStartAlign?: () => void;
  onCancelAlign?: () => void;
  onStartArray?: () => void;
  onExecuteArray?: (options: ArrayOptions) => void;
  onCancelArray?: () => void;
  onToggleColumnStyle?: () => void;
  onStartSketchMode?: () => void;
  onAddVoidSketch?: () => void;
}

export class ContextualSubheader implements ContextualSubheaderCommands {
  public currentOffset = 0;
  public drawMode: GridDrawMode = 'line';
  public isChain = false;
  public filletRadius = 0;
  public levelDrawMode: LevelDrawMode = 'line';
  public levelOffset = 0;
  public levelMakePlanView = true;
  public levelActiveTemplate: LevelTemplateType = 'residential';

  private mode: ContextualBarMode = 'general';
  private tool: ToolType = 'select';
  private levelName = 'Nivel 1 (+3.50m)';
  private element: ManagedElement | null = null;
  private alignStep = '';
  private gridOffsetInput = '0.00';
  private gridRadiusInput = '0.00';
  private gridTemplate: '5x5' | '4x4' | '6x6' = '5x5';
  private gridSpacingX = '6';
  private gridSpacingZ = '6';
  private levelOffsetInput = '0.00';
  private arrayType: 'linear' | 'radial' = 'linear';
  private arraySpacing: 'second' | 'last' = 'second';
  private arrayCount = '3';
  private arrayAngle = '360';
  private arrayDeltaX = '6.00';
  private quickLevelModalOpen = false;

  constructor(private actions: ContextualActions) {
    contextualSubheaderStore.connect(this);
    this.publish();
  }

  public updateForTool(tool: ToolType, levelName: string): void {
    this.tool = tool;
    this.levelName = levelName;
    this.element = null;
    this.mode = tool === 'select' ? 'general' : tool === 'grid' ? 'grid' : tool === 'level' ? 'level' : 'structural';
    this.publish();
  }

  public updateForSelectedElement(element: ManagedElement, levelName: string): void {
    this.element = element;
    this.levelName = levelName;
    this.mode = 'selected';
    this.publish();
  }

  public renderAlignBar(stepText: string): void {
    this.alignStep = stepText;
    this.mode = 'align';
    this.publish();
  }

  public renderArrayBar(element: ManagedElement): void {
    this.element = element;
    this.arrayType = 'linear';
    this.arraySpacing = 'second';
    this.arrayCount = '3';
    this.arrayAngle = '360';
    this.arrayDeltaX = '6.00';
    this.mode = 'array';
    this.publish();
  }

  public updateGridDrawMode(mode: GridDrawMode): void {
    this.drawMode = mode;
    this.actions.onDrawModeChange?.(mode);
    this.publish();
  }

  public updateGridOffset(value: string): void {
    this.gridOffsetInput = value;
    this.currentOffset = Number.parseFloat(value) || 0;
    this.actions.onOffsetChange?.(this.currentOffset);
    this.publish();
  }

  public updateGridChain(value: boolean): void {
    this.isChain = value;
    this.actions.onChainChange?.(value);
    this.publish();
  }

  public updateGridRadius(value: string): void {
    this.gridRadiusInput = value;
    this.filletRadius = Number.parseFloat(value) || 0;
    this.actions.onFilletRadiusChange?.(this.filletRadius);
    this.publish();
  }

  public updateGridTemplate(value: '5x5' | '4x4' | '6x6'): void {
    this.gridTemplate = value;
    this.gridSpacingX = value === '6x6' ? '5' : '6';
    this.gridSpacingZ = value === '6x6' ? '5' : '6';
    this.publish();
  }

  public updateGridSpacing(axis: 'x' | 'z', value: string): void {
    if (axis === 'x') this.gridSpacingX = value;
    else this.gridSpacingZ = value;
    this.publish();
  }

  public updateLevelDrawMode(mode: LevelDrawMode): void {
    this.levelDrawMode = mode;
    this.actions.onLevelDrawModeChange?.(mode);
    this.publish();
  }

  public updateLevelOffset(value: string): void {
    this.levelOffsetInput = value;
    this.levelOffset = Number.parseFloat(value) || 0;
    this.actions.onLevelOffsetChange?.(this.levelOffset);
    this.publish();
  }

  public updateLevelMakePlanView(value: boolean): void {
    this.levelMakePlanView = value;
    this.actions.onLevelMakePlanViewChange?.(value);
    this.publish();
  }

  public updateLevelTemplate(value: LevelTemplateType): void {
    this.levelActiveTemplate = value;
    this.publish();
  }

  public updateArrayType(value: 'linear' | 'radial'): void { this.arrayType = value; this.publish(); }
  public updateArraySpacing(value: 'second' | 'last'): void { this.arraySpacing = value; this.publish(); }
  public updateArrayCount(value: string): void { this.arrayCount = value; this.publish(); }
  public updateArrayAngle(value: string): void { this.arrayAngle = value; this.publish(); }
  public updateArrayDeltaX(value: string): void { this.arrayDeltaX = value; this.publish(); }

  public applyGridTemplate(): void {
    const spacingX = Number.parseFloat(this.gridSpacingX) || 6;
    const spacingZ = Number.parseFloat(this.gridSpacingZ) || 6;
    const count = this.gridTemplate === '4x4' ? 4 : this.gridTemplate === '6x6' ? 6 : 5;
    if (this.actions.onQuickGenerate) this.actions.onQuickGenerate(spacingX, spacingZ, count, count);
    else this.actions.onApplyTemplate?.(this.gridTemplate);
  }

  public applyLevelTemplate(): void {
    this.actions.onApplyLevelTemplate?.(this.levelActiveTemplate);
  }

  public executeArray(): void {
    const options: ArrayOptions = {
      type: this.arrayType,
      count: Number.parseInt(this.arrayCount, 10) || 3,
      spacingMethod: this.arraySpacing,
      delta: { x: Number.parseFloat(this.arrayDeltaX) || 6, y: 0, z: 0 },
      angleDegrees: Number.parseFloat(this.arrayAngle) || 360,
    };
    this.actions.onExecuteArray?.(options);
  }

  public openQuickLevelModal(): void { this.quickLevelModalOpen = true; this.publish(); }
  public closeQuickLevelModal(): void { this.quickLevelModalOpen = false; this.publish(); }

  public generateQuickLevels(config: QuickGenerateLevelConfig): void {
    this.quickLevelModalOpen = false;
    this.publish();
    this.actions.onQuickGenerateLevels?.(config);
  }

  public clearSelection(): void { this.actions.onClearSelection?.(); }
  public deleteSelected(): void { this.actions.onDeleteSelected?.(); }
  public toggleGrid(): void { this.actions.onToggleGrid?.(); }
  public cancel(): void { this.actions.onCancel?.(); }
  public atGrid(): void { this.actions.onAtGrid?.(); }
  public startAlign(): void { this.actions.onStartAlign?.(); }
  public cancelAlign(): void { this.actions.onCancelAlign?.(); }
  public startArray(): void { this.actions.onStartArray?.(); }
  public cancelArray(): void { this.actions.onCancelArray?.(); }
  public toggleColumnStyle(): void { this.actions.onToggleColumnStyle?.(); }
  public startSketch(): void { this.actions.onStartSketchMode?.(); }
  public addVoidSketch(): void { this.actions.onAddVoidSketch?.(); }

  private publish(): void {
    const next: ContextualSubheaderSnapshot = {
      mode: this.mode,
      tool: this.tool,
      levelName: this.levelName,
      element: this.element,
      alignStep: this.alignStep,
      gridDrawMode: this.drawMode,
      gridOffset: this.currentOffset,
      gridOffsetInput: this.gridOffsetInput,
      gridChain: this.isChain,
      gridRadius: this.filletRadius,
      gridRadiusInput: this.gridRadiusInput,
      gridTemplate: this.gridTemplate,
      gridSpacingX: this.gridSpacingX,
      gridSpacingZ: this.gridSpacingZ,
      levelDrawMode: this.levelDrawMode,
      levelOffset: this.levelOffset,
      levelOffsetInput: this.levelOffsetInput,
      levelMakePlanView: this.levelMakePlanView,
      levelTemplate: this.levelActiveTemplate,
      arrayType: this.arrayType,
      arraySpacing: this.arraySpacing,
      arrayCount: this.arrayCount,
      arrayAngle: this.arrayAngle,
      arrayDeltaX: this.arrayDeltaX,
      quickLevelModalOpen: this.quickLevelModalOpen,
    };
    contextualSubheaderStore.publish(next);
  }
}
