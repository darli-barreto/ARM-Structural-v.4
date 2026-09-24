import * as THREE from 'three';
import type { AlignReference, ArrayOptions, ManagedElement } from './types';
import type { WasmBridge } from '../../kernel/WasmBridge';
import type { VisualStyle } from '../../config/theme.config';
import { ElementFactory } from './ElementFactory';
import { ElementRegistry } from './ElementRegistry';
import { AlignmentTool } from './AlignmentTool';
import { ArrayTool } from './ArrayTool';

export class ModificationTools {
  private readonly alignment: AlignmentTool;
  private readonly array: ArrayTool;

  constructor(
    scene: THREE.Scene,
    wasm: WasmBridge,
    factory: ElementFactory,
    registry: ElementRegistry,
    currentStyleGetter: () => VisualStyle,
    onStatusPrompt: (message: string) => void,
    onElementsChanged: () => void,
  ) {
    this.alignment = new AlignmentTool(scene, wasm, onStatusPrompt, onElementsChanged);
    this.array = new ArrayTool(scene, wasm, factory, registry, currentStyleGetter, onStatusPrompt, onElementsChanged);
  }

  public get isAlignActive(): boolean { return this.alignment.isActive; }
  public set isAlignActive(value: boolean) { this.alignment.isActive = value; }
  public get alignStep(): 'pick_reference' | 'pick_target' { return this.alignment.step; }
  public set alignStep(value: 'pick_reference' | 'pick_target') { this.alignment.step = value; }
  public get currentReference(): AlignReference | null { return this.alignment.reference; }
  public set currentReference(value: AlignReference | null) { this.alignment.reference = value; }
  public get isArrayActive(): boolean { return this.array.isActive; }
  public set isArrayActive(value: boolean) { this.array.isActive = value; }
  public get arrayConfig(): ArrayOptions { return this.array.config; }
  public set arrayConfig(value: ArrayOptions) { this.array.config = value; }

  public startAlign(preselectedElement?: ManagedElement): void {
    void preselectedElement;
    this.alignment.start();
  }

  public cancelAlign(): void { this.alignment.cancel(); }
  public setReference(reference: AlignReference): void { this.alignment.setReference(reference); }
  public alignElement(target: ManagedElement): boolean { return this.alignment.alignElement(target); }

  public startArray(element: ManagedElement): void {
    void element;
    this.array.start();
  }

  public cancelArray(): void { this.array.cancel(); }
  public executeArray(source: ManagedElement, options: ArrayOptions): ManagedElement[] {
    return this.array.execute(source, options);
  }
}
