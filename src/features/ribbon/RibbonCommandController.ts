import type { HeaderRibbon } from './HeaderRibbonController';
import { RIBBON_ACTION_EVENT, type RibbonAction } from './RibbonActionsBridge';

export interface RibbonCommandHandlers {
  openSchedule(): void;
  selectById(): void;
  openMongoInspector(): void;
  exportCsv(): void;
  exportJson(): void;
}

export class RibbonCommandController {
  constructor(private ribbon: HeaderRibbon, private handlers: RibbonCommandHandlers) {}

  public attach(target: EventTarget): () => void {
    const listener = (event: Event) => this.handle((event as CustomEvent<RibbonAction>).detail);
    target.addEventListener(RIBBON_ACTION_EVENT, listener);
    return () => target.removeEventListener(RIBBON_ACTION_EVENT, listener);
  }

  public handle(action: RibbonAction): void {
    switch (action.type) {
      case 'open-schedule': this.handlers.openSchedule(); break;
      case 'select-by-id': this.handlers.selectById(); break;
      case 'open-mongo-inspector': this.handlers.openMongoInspector(); break;
      case 'export-csv': this.handlers.exportCsv(); break;
      case 'export-json': this.handlers.exportJson(); break;
      default: this.ribbon.handleAction(action);
    }
  }
}
