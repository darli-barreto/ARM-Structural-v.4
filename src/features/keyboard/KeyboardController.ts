import type { ToolType } from '../../config/structural.config';

export interface KeyboardControllerActions {
  openSelectById(): void;
  openMongoInspector(): void;
  openSchedule(): void;
  escape(): void;
  isTyping(): boolean;
  alignShortcut(): void;
  arrayShortcut(): void;
  setTool(tool: Extract<ToolType, 'grid' | 'level'>): void;
  deleteSelection(): void;
}

export class KeyboardController {
  private sequence = '';
  private sequenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private actions: KeyboardControllerActions) {}

  public attach(target: EventTarget): () => void {
    const handler = (event: Event) => this.handleKeydown(event as KeyboardEvent);
    target.addEventListener('keydown', handler);
    return () => {
      target.removeEventListener('keydown', handler);
      if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    };
  }

  public handleKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'i') {
        event.preventDefault();
        this.actions.openSelectById();
        return;
      }
      if (event.key.toLowerCase() === 'm' && event.shiftKey) {
        event.preventDefault();
        this.actions.openMongoInspector();
        return;
      }
      if (event.key.toLowerCase() === 's' && event.shiftKey) {
        event.preventDefault();
        this.actions.openSchedule();
        return;
      }
    }

    if (event.key === 'Escape') this.actions.escape();

    if (!this.actions.isTyping() && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toUpperCase();
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        this.sequence += key;
        if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
        this.sequenceTimer = setTimeout(() => { this.sequence = ''; }, 1200);

        if (this.sequence.endsWith('AL')) {
          this.sequence = '';
          this.actions.alignShortcut();
        } else if (this.sequence.endsWith('AR')) {
          this.sequence = '';
          this.actions.arrayShortcut();
        }
      }

      if (event.key.toLowerCase() === 'l') this.actions.setTool('level');
      else if (event.key.toLowerCase() === 'g') this.actions.setTool('grid');
    }

    if (event.key === 'Delete' || event.key === 'Backspace') this.actions.deleteSelection();
  }
}
