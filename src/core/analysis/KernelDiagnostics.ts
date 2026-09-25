import type { Frame2dResultV1 } from '../../kernel/worker/frame2d.protocol';

export const kernelDiagnosticsScope = 'Indicadores numericos de Rust, no del motor ARM activo. No certifican seguridad estructural ni cumplimiento normativo.';
export const kernelDiagnosticsUnavailable = 'No disponible: este resultado Rust no incluye diagnosticos numericos. No equivale a una comprobacion aprobada.';

export interface KernelDiagnosticRow {
  label: string;
  value: string;
  explanation: string;
}

/** Shared wording for the interactive results and exported calculation report. */
export function kernelDiagnosticRows(diagnostics: Frame2dResultV1['diagnostics']): KernelDiagnosticRow[] {
  if (!diagnostics) return [];
  const { freeDofs, scaledConditionEstimate: condition, maxComponentwiseBackwardError: backward,
    maxResidualToleranceRatio: residualRatio } = diagnostics;
  return [
    { label: 'Grados de libertad resueltos', value: String(freeDofs),
      explanation: freeDofs === 0 ? 'Sin ecuaciones libres. Los ceros de residuo no verifican un sistema de desplazamientos libres.'
        : 'Numero de ecuaciones libres incluidas en la resolucion.' },
    { label: 'Condicionamiento escalado estimado',
      value: condition == null ? condition === null ? 'No aplica' : 'No disponible' : condition.toExponential(3),
      explanation: condition === null ? 'Sin ecuaciones libres; no se calcula condicionamiento.'
        : condition === undefined ? 'La version del kernel no entrego esta estimacion.'
          : 'Adimensional, sobre la matriz con escalado diagonal. Un valor mayor indica mayor sensibilidad numerica potencial. Puede subestimar; no es una cota del error ni un diagnostico de estabilidad fisica.' },
    { label: 'Error relativo por ecuacion', value: backward.toExponential(3),
      explanation: 'Error hacia atras: residuo dividido por la escala de cada ecuacion. Puede ser sensible al redondeo en ecuaciones casi nulas. Un valor pequeno no garantiza desplazamientos precisos.' },
    { label: 'Residuo / tolerancia', value: residualRatio.toExponential(3),
      explanation: freeDofs === 0 ? 'No aplica como prueba de ecuaciones libres: todas estan restringidas o excluidas.'
        : residualRatio <= 1 ? 'Dentro del criterio numerico del solver (limite 1). No es un limite de deriva, resistencia ni servicio.'
          : 'Fuera del criterio numerico del solver (limite 1). Revisar; no aceptar este resultado.' },
  ];
}
