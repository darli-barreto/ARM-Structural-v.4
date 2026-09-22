import { LEVELS } from '../config/structural.config';

export class LevelSelector {
  private select = document.getElementById('level-select') as HTMLSelectElement | null;

  constructor(private onChange: (levelIdx: number) => void) {
    if (!this.select) return;
    this.renderOptions();

    this.select.addEventListener('change', () => {
      const val = parseInt(this.select!.value);
      if (!isNaN(val) && val >= 0) {
        this.onChange(val);
      }
    });
  }

  public renderOptions(): void {
    if (!this.select) return;
    if (LEVELS.length === 0) {
      this.select.innerHTML = '<option value="-1">(Sin niveles cargados)</option>';
      return;
    }
    this.select.innerHTML = LEVELS.map(l => 
      `<option value="${l.index}">${l.name}</option>`
    ).join('');
  }
}
