import { ManagedElement } from '../../tools/structural/types';

export class PropertiesPanel {
  private panel: HTMLElement;

  constructor(private onDeleteRequested: (element: ManagedElement) => void) {
    this.panel = document.createElement('div');
    this.panel.id = 'properties-panel';
    this.panel.style.display = 'none';
    document.body.appendChild(this.panel);
  }

  public show(element: ManagedElement): void {
    const icon = { footing: '🧱 Zapata', column: '🏛️ Columna', beam: '📏 Viga', slab: '🏠 Losa / Techo' }[element.type];
    
    this.panel.innerHTML = `
      <div class="prop-header">
        <h3>${icon}</h3>
        <span class="badge">${element.id}</span>
      </div>
      <div class="prop-row"><span>Nivel:</span><strong>${element.levelName}</strong></div>
      <div class="prop-row"><span>Dimensiones:</span><strong>${element.dimensions}</strong></div>
      <div class="prop-row"><span>Volumen:</span><strong class="highlight">${element.volume.toFixed(3)} m³</strong></div>
      <button id="btn-delete-element" class="btn-danger-sm">🗑️ Eliminar Elemento</button>
    `;

    document.getElementById('btn-delete-element')?.addEventListener('click', () => {
      this.onDeleteRequested(element);
      this.hide();
    });

    this.panel.style.display = 'block';
  }

  public hide(): void {
    this.panel.style.display = 'none';
  }
}
