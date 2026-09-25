import { benchmarkChecks, benchmarkMatches, type BenchmarkId } from './Benchmarks';
import type { AnalysisModel, AnalysisResult } from './Model';
import type { KernelParityReport } from './KernelAdapter';
import { assembleFrameLoads } from './Loads';

export type AssessmentState = 'coherent' | 'review' | 'unverified';
export interface AssessmentItem {
  label: string;
  state: AssessmentState;
  explanation: string;
}

const displacementToleranceM = 1e-7;
const rotationToleranceRad = 1e-7;
const reactionToleranceKN = 1e-5;

export function assessAnalysisResult(
  model: AnalysisModel,
  result: AnalysisResult,
  factors: { dead: number; live: number; nodal: number },
  benchmark?: BenchmarkId,
  parity?: KernelParityReport | null,
): AssessmentItem[] {
  const items: AssessmentItem[] = [];
  const equilibriumOk = Number.isFinite(result.residual) && result.residual <= 1e-5;
  items.push({
    label: 'Equilibrio global',
    state: equilibriumOk ? 'coherent' : 'review',
    explanation: equilibriumOk
      ? `Residuo relativo ${result.residual.toExponential(2)}; fuerzas y momentos cierran dentro de 1e-5. Esto no verifica deformaciones ni resistencia.`
      : `Residuo relativo ${result.residual.toExponential(2)} fuera de 1e-5 o no finito. Revisar cargas, reacciones y unidades.`,
  });

  const inputNodes = new Map(model.nodes.map(node => [node.id, node]));
  const outputIds = new Set(result.nodes.map(node => node.id));
  try {
    const loads = assembleFrameLoads(model, factors);
    const { fx, fy, moment } = loads.totals;
    const sumFx = fx + result.nodes.reduce((sum, node) => sum + node.rx, 0);
    const sumFy = fy + result.nodes.reduce((sum, node) => sum + node.ry, 0);
    const sumMoment = moment + result.nodes.reduce((sum, node) => {
      const position = inputNodes.get(node.id);
      return position ? sum + node.rm + position.y * node.rx - position.x * node.ry : Number.NaN;
    }, 0);
    const relativeForce = Math.hypot(sumFx, sumFy) / Math.max(1, Math.hypot(fx, fy));
    const relativeMoment = Math.abs(sumMoment) / Math.max(1, Math.abs(moment));
    const complete = outputIds.size === model.nodes.length && result.nodes.length === model.nodes.length
      && model.nodes.every(node => outputIds.has(node.id));
    const balanced = complete && [relativeForce, relativeMoment].every(value => Number.isFinite(value) && value <= 1e-5);
    const sums = `ΣFx=${sumFx.toExponential(2)} kN, ΣFy=${sumFy.toExponential(2)} kN, ΣM=${sumMoment.toExponential(2)} kN·m.`;
    items.push({
      label: 'Auditoría de reacciones',
      state: balanced ? 'coherent' : 'review',
      explanation: `${sums} ${balanced
        ? 'Las cargas ensambladas y las reacciones devueltas cierran en fuerza y momento relativos (≤ 1e-5). No es una solución analítica independiente.'
        : 'Faltan nudos, hay valores no finitos o las sumas relativas exceden 1e-5; revisar reacciones, cargas y convención de signos.'}`,
    });
  } catch (error) {
    items.push({
      label: 'Auditoría de reacciones',
      state: 'review',
      explanation: `No se pudo auditar el balance de cargas: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const inputs = inputNodes;
  for (const node of result.nodes) {
    const input = inputs.get(node.id);
    if (!input) {
      items.push({ label: `Nudo ${node.id}`, state: 'review', explanation: 'El resultado no corresponde a un nudo del modelo.' });
      continue;
    }
    const restrainedX = input.support === 'fixed' || input.support === 'pinned';
    const restrainedY = input.support !== 'free';
    const restrainedRotation = input.support === 'fixed';
    const values = [node.ux, node.uy, node.rotation, node.rx, node.ry, node.rm];
    const finite = values.every(Number.isFinite);
    const invalid = !finite
      || (restrainedX ? Math.abs(node.ux) > displacementToleranceM : Math.abs(node.rx) > reactionToleranceKN)
      || (restrainedY ? Math.abs(node.uy) > displacementToleranceM : Math.abs(node.ry) > reactionToleranceKN)
      || (restrainedRotation ? Math.abs(node.rotation) > rotationToleranceRad : Math.abs(node.rm) > reactionToleranceKN);
    items.push({
      label: `Nudo ${node.id} / ${input.support}`,
      state: invalid ? 'review' : 'coherent',
      explanation: invalid
        ? 'Una traslación/giro restringido no es casi nulo, aparece reacción en un grado libre o hay valores no finitos. Revisar apoyo, unidades y conectividad.'
        : 'Las restricciones y reacciones por grado de libertad son numéricamente compatibles. El signo del desplazamiento indica dirección; su magnitud aún requiere un límite de servicio aplicable.',
    });
  }

  const nodes = new Map(result.nodes.map(node => [node.id, node]));
  const memberInputs = new Map(model.members.map(member => [member.id, member]));
  for (const member of result.members) {
    const input = memberInputs.get(member.id);
    const start = input && nodes.get(input.start);
    const end = input && nodes.get(input.end);
    const last = member.stations.length - 1;
    const compatible = !!input && !!start && !!end && last >= 1
      && member.deflectionX.length === member.stations.length
      && member.deflectionY.length === member.stations.length
      && [member.axial, member.shear, member.moment].every(values => values.length === member.stations.length)
      && [...member.endForces, ...member.axial, ...member.shear, ...member.moment, ...member.deflectionX, ...member.deflectionY].every(Number.isFinite)
      && Math.abs(member.deflectionX[0] - start.ux) <= displacementToleranceM
      && Math.abs(member.deflectionY[0] - start.uy) <= displacementToleranceM
      && Math.abs(member.deflectionX[last] - end.ux) <= displacementToleranceM
      && Math.abs(member.deflectionY[last] - end.uy) <= displacementToleranceM;
    items.push({
      label: `Barra ${input?.mark ?? member.id} (${member.id})`,
      state: compatible ? 'coherent' : 'review',
      explanation: compatible
        ? 'La deformada llega a los desplazamientos de ambos nudos y N/V/M son finitos. Sus máximos son demandas del caso, no capacidades ni diseño de armadura.'
        : 'La deformada no enlaza con los nudos, faltan estaciones o aparece una magnitud no finita. Revisar recuperación y conectividad.',
    });
  }

  if (benchmark && benchmarkMatches(benchmark, model, factors)) {
    const checks = benchmarkChecks(benchmark, result);
    const failures = checks.filter(check => !check.pass);
    items.push({
      label: 'Solución analítica independiente',
      state: failures.length ? 'review' : 'coherent',
      explanation: failures.length
        ? `${failures.length} de ${checks.length} magnitudes difieren de la fórmula cerrada. Revisar el caso de referencia antes de confiar en el solver.`
        : `${checks.length} magnitudes coinciden con fórmulas cerradas del caso de referencia. Solo valida este caso elástico 2D, no el proyecto completo.`,
    });
  } else {
    items.push({
      label: 'Solución analítica independiente',
      state: 'unverified',
      explanation: 'Este modelo no coincide con un caso de referencia cerrado; no hay una solución externa que confirme desplazamientos o esfuerzos.',
    });
  }

  items.push({
    label: 'Contraste Rust/WASM',
    state: !parity ? 'unverified' : parity.passed ? 'coherent' : 'review',
    explanation: !parity
      ? 'Aún no se ejecutó el motor Rust sobre esta revisión. Use Contrastar Rust para comparar ambos cálculos.'
      : parity.passed
        ? 'Ambos motores coinciden dentro de tolerancia en nudos, fuerzas, diagramas y deformadas. Un error común de modelado podría afectar a ambos.'
        : parity.deformationAvailable
          ? 'Hay magnitudes fuera de tolerancia; inspeccione las tablas comparativas antes de usar este resultado.'
          : 'Contraste incompleto: faltan deformadas del kernel; no se declara paridad total.',
  });
  return items;
}
