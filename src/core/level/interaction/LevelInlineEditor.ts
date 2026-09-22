import * as THREE from 'three';
import { Level } from '../types/LevelTypes';
import { LevelQuickGenerator } from '../generator/LevelQuickGenerator';

export interface LevelInlineEditorOptions {
  worldPos: THREE.Vector3;
  level: Level;
  camera: THREE.Camera;
  domElement: HTMLElement;
  isNameUnique: (name: string, excludeId?: string) => boolean;
  onCommit: (newName: string, newElevation: number) => void;
  onCancel?: () => void;
  onValidationWarning?: (msg: string) => void;
}

export class LevelInlineEditor {
  private activeContainer: HTMLElement | null = null;
  private isCommitting = false;

  public open(options: LevelInlineEditorOptions): void {
    this.close();

    const {
      worldPos,
      level,
      camera,
      domElement,
      isNameUnique,
      onCommit,
      onCancel,
      onValidationWarning,
    } = options;

    // Proyectar coordenadas del espacio 3D a la pantalla 2D
    const p = worldPos.clone().project(camera);
    if (p.z > 1) return; // Fuera del frustum

    const rect = domElement.getBoundingClientRect();
    const screenX = ((p.x + 1) / 2) * rect.width + rect.left;
    const screenY = ((-p.y + 1) / 2) * rect.height + rect.top;

    const container = document.createElement('div');
    container.id = 'level-inline-editor-card';
    container.className = 'fixed z-50 bg-slate-900 border-2 border-sky-500 rounded-lg p-2.5 shadow-2xl flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-150';
    Object.assign(container.style, {
      left: `${Math.max(10, Math.min(window.innerWidth - 220, screenX - 100))}px`,
      top: `${Math.max(10, Math.min(window.innerHeight - 150, screenY - 45))}px`,
      width: '210px',
    });

    const shortName = level.name.split('(')[0]?.trim() || level.name;
    const elevFormatted = level.elevation.toFixed(2);

    container.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold text-sky-400 border-b border-sky-500/30 pb-1">
        <span>✏️ Editar Nivel</span>
        <span class="text-[9px] text-slate-400">Enter para guardar</span>
      </div>
      <div class="flex flex-col gap-1.5 text-xs">
        <div>
          <label class="block text-[10px] text-slate-400 font-semibold mb-0.5">Nombre:</label>
          <input id="lvl-inline-name" type="text" value="${shortName}" class="w-full px-2 py-1 bg-slate-950 border border-slate-700 focus:border-sky-400 rounded text-slate-100 font-bold text-xs outline-none" />
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 font-semibold mb-0.5">Cota / Elevación (m):</label>
          <div class="flex items-center gap-1">
            <input id="lvl-inline-elev" type="number" step="0.1" value="${elevFormatted}" class="w-full px-2 py-1 bg-slate-950 border border-slate-700 focus:border-sky-400 rounded text-sky-400 font-mono font-bold text-xs outline-none" />
            <span class="text-xs text-slate-400">m</span>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-1.5 mt-1 pt-1 border-t border-slate-800">
        <button id="lvl-inline-cancel" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded cursor-pointer">Cancelar</button>
        <button id="lvl-inline-save" class="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold rounded cursor-pointer">Guardar</button>
      </div>
    `;

    document.body.appendChild(container);
    this.activeContainer = container;

    const nameInput = container.querySelector('#lvl-inline-name') as HTMLInputElement;
    const elevInput = container.querySelector('#lvl-inline-elev') as HTMLInputElement;
    const saveBtn = container.querySelector('#lvl-inline-save') as HTMLButtonElement;
    const cancelBtn = container.querySelector('#lvl-inline-cancel') as HTMLButtonElement;

    nameInput.focus();
    nameInput.select();

    const commit = () => {
      if (this.isCommitting) return;
      this.isCommitting = true;

      const newNameRaw = nameInput.value.trim();
      const newElev = parseFloat(elevInput.value);

      if (!newNameRaw) {
        onValidationWarning?.('El nombre del nivel no puede estar vacío.');
        this.close();
        onCancel?.();
        return;
      }

      if (isNaN(newElev)) {
        onValidationWarning?.('La cota de elevación debe ser un número válido.');
        this.close();
        onCancel?.();
        return;
      }

      if (!isNameUnique(newNameRaw, level.id)) {
        onValidationWarning?.(`El nombre "${newNameRaw}" ya está en uso por otro nivel.`);
        nameInput.style.borderColor = '#ef4444';
        this.isCommitting = false;
        return;
      }

      const fullNewName = `${newNameRaw} (${LevelQuickGenerator.formatElevation(newElev)})`;
      this.close();
      onCommit(fullNewName, Number(newElev.toFixed(2)));
    };

    saveBtn.addEventListener('click', commit);
    cancelBtn.addEventListener('click', () => {
      this.close();
      onCancel?.();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        onCancel?.();
      }
    };

    nameInput.addEventListener('keydown', handleKeyDown);
    elevInput.addEventListener('keydown', handleKeyDown);

    // Cerrar al hacer clic fuera
    const handleOutsideClick = (e: MouseEvent) => {
      if (container && !container.contains(e.target as Node)) {
        window.removeEventListener('pointerdown', handleOutsideClick);
        commit();
      }
    };
    setTimeout(() => {
      window.addEventListener('pointerdown', handleOutsideClick);
    }, 50);
  }

  public close(): void {
    if (this.activeContainer) {
      this.activeContainer.remove();
      this.activeContainer = null;
    }
    this.isCommitting = false;
  }
}
