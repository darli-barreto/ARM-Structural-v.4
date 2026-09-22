export type VisualStyle = 'hidden_line' | 'wireframe' | 'consistent_colors' | 'shaded';

export const THEME = {
  // 1. ENTORNO Y VISOR
  viewport: {
    background: 0x0f172a, // Fondo por defecto para modo sombreado
  },

  // 2. ILUMINACIÓN
  lights: {
    ambient: 0xffffff,
    hemiSky: 0xffffff,
    hemiGround: 0x64748b,
    directional: 0xffffff,
  },

  // 3. GRILLAS
  grids: {
    baseCenter: 0x000000,
    baseLines: 0x334155,
    levelCenter: 0x64748b,
    levelLines: 0x334155,
    opacity: 0.25,
  },
  snapping: {
    ring: 0x38bdf8,
    ringCss: '#38bdf8',
  },

  // 3.1 REJILLAS Y EJES BIM (Grid System)
  grid: {
    bubbleRadius: 1.2,
    bubbleColor: 0x0284c7,
    textColor: 0xffffff,
    lineDefault: 0x475569,
    lineDefaultLight: 0x94a3b8,
    lineActive: 0x0284c7,
    lineHover: 0x00e5ff,
    alignmentGuide: 0x38bdf8,
    gripRing: 0x0284c7,
    gripInner: 0x38bdf8,
    elbowGripRing: 0x9333ea,
    elbowGripInner: 0xc084fc,
    elbowLeader: 0x0284c7,
    hitbox: 0x000000,
    bubble: {
      fill: '#ffffff',
      fillSelected: '#0284c7',
      fillHover: '#f0f9ff',
      borderDefault: '#1e293b',
      borderSelected: '#38bdf8',
      borderHover: '#0284c7',
      textDefault: '#0f172a',
      textSelected: '#ffffff',
      textHover: '#0284c7',
    },
    checkbox: {
      fillChecked: '#0284c7',
      fillUnchecked: '#ffffff',
      borderChecked: '#0369a1',
      borderUnchecked: '#475569',
      checkmark: '#ffffff',
    },
    elbowIcon: {
      bg: '#ffffff',
      strokeActive: '#0284c7',
      strokeInactive: '#9333ea',
    },
    lockIcon: {
      text: '#0f172a',
    },
    editor: {
      background: '#ffffff',
      text: '#0f172a',
      border: '#0284c7',
      borderError: '#ef4444',
      shadow: '0 4px 20px rgba(2, 132, 199, 0.5), 0 0 0 4px rgba(56, 189, 248, 0.35)',
      shadowError: '0 4px 16px rgba(239, 68, 68, 0.5)',
    },
  },

  // 3.2 NIVELES Y DATUMS
  levels: {
    contourLine: 0x38bdf8,
    datumPlane: 0x0284c7,
    headCircle: '#0284c7',
    headQuadrant: '#ffffff',
    headStroke: '#0284c7',
    headLine: '#38bdf8',
    headTitleText: '#f8fafc',
    headElevText: '#38bdf8',
  },

  // 3.3 PREVISUALIZACIÓN Y DIBUJO
  preview: {
    ghostSurface: 0x38bdf8,
    ghostEdge: 0x0284c7,
    drawingLine: 0x0284c7,
    referenceLine: 0x94a3b8,
    dimensionBackground: '#0f172a',
    dimensionBorder: '#38bdf8',
    dimensionText: '#38bdf8',
  },

  // 3.4 SELECCIÓN Y RESALTADO
  selection: {
    hoverBox: 0x38bdf8,
    selectionBox: 0x00ffff,
  },

  // 4. ELEMENTOS ESTRUCTURALES (Modo Sombreado)
  elements: {
    footing: { surface: 0x9A9A92, edge: 0x000000 },
    column:  { surface: 0x9A9A92, edge: 0x000000 },
    beam:    { surface: 0x9A9A92, edge: 0x000000 },
    slab:    { surface: 0x3d85c6, edge: 0x000000 },
  },

  // 5. PRESETS PARA ESTILOS VISUALES REVIT
  styles: {
    hidden_line: {
      background: 0xffffff, // Fondo blanco papel
      surface: 0xffffff,    // Caras blancas opacas que tapan lo que hay detrás
      edge: 0x000000,       // Aristas negras nítidas de tinta
      gridCenter: 0x94a3b8, // Grilla tenue en plano blanco
      gridLines: 0xe2e8f0,
    },
    wireframe: {
      background: 0xffffff, // Fondo blanco
      edge: 0x000000,       // Todas las aristas visibles a través del modelo
    },
    consistent_colors: {
      background: 0xffffff, // Fondo claro
      edge: 0x000000,       // Aristas negras delimitadoras
    },
    shaded: {
      background: 0x0f172a, // Fondo oscuro CAD
    }
  }
} as const;

export type ThemeConfig = typeof THEME;
