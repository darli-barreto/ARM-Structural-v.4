export type StructuralApplicationDisposer = () => void;

export interface StructuralApplicationLease {
  ready: Promise<void>;
  release(): void;
}

export class StructuralApplicationLifecycle {
  private references = 0;
  private generation = 0;
  private startup: Promise<void> | null = null;
  private disposeApplication: StructuralApplicationDisposer | null = null;

  public acquire(start: () => Promise<StructuralApplicationDisposer | void>): StructuralApplicationLease {
    this.references += 1;
    if (!this.startup) this.start(start);

    const ready = this.startup!;
    let released = false;
    return {
      ready,
      release: () => {
        if (released) return;
        released = true;
        this.references = Math.max(0, this.references - 1);
        if (this.references === 0 && this.disposeApplication) this.stop();
      },
    };
  }

  private start(start: () => Promise<StructuralApplicationDisposer | void>): void {
    const generation = ++this.generation;
    this.startup = Promise.resolve()
      .then(start)
      .then(dispose => {
        if (generation !== this.generation) {
          dispose?.();
          return;
        }
        this.disposeApplication = dispose ?? null;
        if (this.references === 0) this.stop();
      })
      .catch(error => {
        if (generation === this.generation) {
          this.startup = null;
          this.disposeApplication = null;
        }
        throw error;
      });
  }

  private stop(): void {
    const dispose = this.disposeApplication;
    this.disposeApplication = null;
    this.startup = null;
    this.generation += 1;
    dispose?.();
  }
}

export const structuralApplicationLifecycle = new StructuralApplicationLifecycle();
