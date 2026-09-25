import { assembleFrameLoads, type LoadFactors } from './Loads';
import { validateAnalysis, type AnalysisModel, type AnalysisResult } from './Model';
import { kernelForceN, kernelMomentNm, kernelStressPa } from '../../kernel/KernelContract';
import type { Frame2dModelInputV1, Frame2dResultV1 } from '../../kernel/worker/frame2d.protocol';

export interface KernelParityRow {
  nodeId: string;
  quantity: 'ux' | 'uy' | 'rotation' | 'rx' | 'ry' | 'rm';
  reference: number;
  kernel: number;
  absoluteError: number;
  tolerance: number;
  passed: boolean;
}

export interface KernelParityMemberRow {
  memberId: string;
  component: 'fxI' | 'fyI' | 'mzI' | 'fxJ' | 'fyJ' | 'mzJ';
  reference: number;
  kernel: number;
  absoluteError: number;
  tolerance: number;
  passed: boolean;
}

export interface KernelParityDiagramRow {
  memberId: string;
  quantity: 'axial' | 'shear' | 'moment';
  station: number;
  stationM: number;
  reference: number;
  kernel: number;
  absoluteError: number;
  tolerance: number;
  passed: boolean;
}

export interface KernelParityDeformationRow {
  memberId: string;
  quantity: 'deflectionX' | 'deflectionY';
  station: number;
  stationM: number;
  reference: number;
  kernel: number;
  absoluteError: number;
  tolerance: number;
  passed: boolean;
}

export interface KernelParityReport {
  diagnostics?: Frame2dResultV1['diagnostics'];
  passed: boolean;
  responsePassed: boolean;
  deformationPassed: boolean | null;
  rows: KernelParityRow[];
  memberRows: KernelParityMemberRow[];
  diagramRows: KernelParityDiagramRow[];
  deformationRows: KernelParityDeformationRow[];
  deformationAvailable: boolean;
  maximumAbsoluteError: number;
  maximumDeformationErrorM: number;
}

/** Converts the active analysis model and its canonical load ledger to SI kernel input. */
export function toFrame2dKernelInput(
  model: AnalysisModel,
  factors: LoadFactors,
): Frame2dModelInputV1 {
  validateAnalysis(model);
  const assembled = assembleFrameLoads(model, factors);
  const nodalLoads = new Map(assembled.nodes.map(load => [load.id, load]));
  const memberLoads = new Map(assembled.members.map(load => [load.id, load.lineLoad]));

  return {
    version: 1,
    nodes: model.nodes.map(node => {
      const load = nodalLoads.get(node.id);
      if (!load) throw new Error(`Carga nodal ausente para ${node.id}.`);
      return {
        id: node.id,
        position: { x: node.x, y: node.y },
        restraint: restraintsFor(node.support),
        load: {
          fx: kernelForceN(load.fx),
          fy: kernelForceN(load.fy),
          mz: opposite(kernelMomentNm(load.moment)),
        },
      };
    }),
    members: model.members.map(member => {
      const lineLoad = memberLoads.get(member.id);
      if (lineLoad === undefined) throw new Error(`Carga distribuida ausente para ${member.id}.`);
      const elasticModulusPa = kernelStressPa(member.elasticModulusMPa);
      return {
        id: member.id,
        startNode: member.start,
        endNode: member.end,
        material: {
          elasticModulusPa,
          shearModulusPa: elasticModulusPa / (2 * (1 + member.poisson)),
        },
        section: {
          areaM2: member.area,
          inertiaM4: member.inertia,
          shearCorrection: 5 / 6,
        },
        releases: {
          startRotation: member.releaseStart,
          endRotation: member.releaseEnd,
        },
        uniformLoad: { fxNPerM: 0, fyNPerM: opposite(kernelForceN(lineLoad)) },
      };
    }),
  };
}

/** Compares the shared nodal response in application units; rotations/moments are sign-mapped. */
export function compareFrame2dResults(
  model: AnalysisModel,
  factors: LoadFactors,
  reference: AnalysisResult,
  kernel: Frame2dResultV1,
  relativeTolerance = 1e-6,
  absoluteTolerance = 1e-8,
): KernelParityReport {
  validateAnalysis(model);
  if (reference.revision !== model.revision || kernel.revision !== model.revision) {
    throw new Error('No se pueden comparar resultados de revisiones distintas.');
  }
  const referenceNodes = new Map(reference.nodes.map(node => [node.id, node]));
  const kernelNodes = new Map(kernel.nodes.map(node => [node.id, node]));
  const referenceMembers = new Map(reference.members.map(member => [member.id, member]));
  const kernelMembers = new Map(kernel.members.map(member => [member.id, member]));
  const nodesById = new Map(model.nodes.map(node => [node.id, node]));
  const lineLoads = new Map(assembleFrameLoads(model, factors).members.map(load => [load.id, load.lineLoad]));
  if (referenceNodes.size !== model.nodes.length || kernelNodes.size !== model.nodes.length
      || referenceMembers.size !== model.members.length || kernelMembers.size !== model.members.length) {
    throw new Error('Los motores devolvieron conjuntos de nudos o barras distintos.');
  }

  const rows: KernelParityRow[] = [];
  for (const node of model.nodes) {
    const expected = referenceNodes.get(node.id);
    const actual = kernelNodes.get(node.id);
    if (!expected || !actual) throw new Error(`Falta el resultado nodal ${node.id}.`);
    const values: Array<[KernelParityRow['quantity'], number, number]> = [
      ['ux', expected.ux, actual.uxM],
      ['uy', expected.uy, actual.uyM],
      ['rotation', expected.rotation, opposite(actual.rzRad)],
      ['rx', expected.rx, actual.reactionFxN / 1_000],
      ['ry', expected.ry, actual.reactionFyN / 1_000],
      ['rm', expected.rm, opposite(actual.reactionMzNm / 1_000)],
    ];
    for (const [quantity, referenceValue, kernelValue] of values) {
      const absoluteError = Math.abs(referenceValue - kernelValue);
      const tolerance = absoluteTolerance + relativeTolerance * Math.abs(referenceValue);
      rows.push({
        nodeId: node.id,
        quantity,
        reference: referenceValue,
        kernel: kernelValue,
        absoluteError,
        tolerance,
        passed: Number.isFinite(absoluteError) && absoluteError <= tolerance,
      });
    }
  }

  const memberRows: KernelParityMemberRow[] = [];
  const diagramRows: KernelParityDiagramRow[] = [];
  const deformationRows: KernelParityDeformationRow[] = [];
  let deformationAvailable = true;
  for (const member of model.members) {
    const expected = referenceMembers.get(member.id);
    const actual = kernelMembers.get(member.id);
    if (!expected || !actual || expected.endForces.length !== 6 || actual.localEndForces.length !== 6) {
      throw new Error(`Faltan fuerzas de extremo compatibles para la barra ${member.id}.`);
    }
    const components: KernelParityMemberRow['component'][] = ['fxI', 'fyI', 'mzI', 'fxJ', 'fyJ', 'mzJ'];
    for (let index = 0; index < components.length; index++) {
      const referenceValue = expected.endForces[index];
      const rawKernelValue = actual.localEndForces[index] / 1_000;
      const kernelValue = index === 2 || index === 5 ? opposite(rawKernelValue) : rawKernelValue;
      const absoluteError = Math.abs(referenceValue - kernelValue);
      const tolerance = absoluteTolerance + relativeTolerance * Math.abs(referenceValue);
      memberRows.push({
        memberId: member.id,
        component: components[index],
        reference: referenceValue,
        kernel: kernelValue,
        absoluteError,
        tolerance,
        passed: Number.isFinite(absoluteError) && absoluteError <= tolerance,
      });
    }

    const shape = actual.deformedShape;
    if (!shape) {
      deformationAvailable = false;
    } else {
      if (shape.stationsM.length !== expected.stations.length
          || shape.globalDxM.length !== expected.stations.length
          || shape.globalDyM.length !== expected.stations.length
          || expected.deflectionX.length !== expected.stations.length
          || expected.deflectionY.length !== expected.stations.length) {
        throw new Error(`El resultado de deformada de ${member.id} tiene estaciones incompatibles.`);
      }
      expected.stations.forEach((stationM, station) => {
        if (!Number.isFinite(shape.stationsM[station])
            || Math.abs(shape.stationsM[station] - stationM) > 1e-9 * Math.max(1, stationM)) {
          throw new Error(`Las estaciones de deformada de ${member.id} no coinciden con el resultado FEM.`);
        }
        for (const [quantity, referenceValue, kernelValue] of [
          ['deflectionX', expected.deflectionX[station], shape.globalDxM[station]],
          ['deflectionY', expected.deflectionY[station], shape.globalDyM[station]],
        ] as const) {
          const absoluteError = Math.abs(referenceValue - kernelValue);
          const tolerance = absoluteTolerance + relativeTolerance * Math.abs(referenceValue);
          deformationRows.push({
            memberId: member.id,
            quantity,
            station,
            stationM,
            reference: referenceValue,
            kernel: kernelValue,
            absoluteError,
            tolerance,
            passed: Number.isFinite(absoluteError) && absoluteError <= tolerance,
          });
        }
      });
    }

    const start = nodesById.get(member.start)!;
    const end = nodesById.get(member.end)!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const q = lineLoads.get(member.id);
    if (q === undefined) throw new Error(`Falta la carga distribuida de la barra ${member.id}.`);
    if (expected.stations.length === 0 || [expected.axial, expected.shear, expected.moment].some(values => values.length !== expected.stations.length)) {
      throw new Error(`El resultado por estaciones de ${member.id} tiene longitudes incompatibles.`);
    }
    const localQx = -q * dy / length;
    const localQy = -q * dx / length;
    const fxI = actual.localEndForces[0] / 1_000;
    const fyI = actual.localEndForces[1] / 1_000;
    const mzI = opposite(actual.localEndForces[2] / 1_000);
    const diagramValues = expected.stations.map((stationM, station) => {
      if (!Number.isFinite(stationM) || stationM < -1e-9 || stationM > length + 1e-9) {
        throw new Error(`Estación fuera del tramo ${member.id}.`);
      }
      const x = Math.min(length, Math.max(0, stationM));
      return [
        ['axial', expected.axial[station], -fxI - localQx * x],
        ['shear', expected.shear[station], -fyI - localQy * x],
        ['moment', expected.moment[station], -mzI - fyI * x - localQy * x * x / 2],
      ] as const;
    });
    for (let station = 0; station < diagramValues.length; station++) {
      for (const [quantity, referenceValue, kernelValue] of diagramValues[station]) {
        const absoluteError = Math.abs(referenceValue - kernelValue);
        const tolerance = absoluteTolerance + relativeTolerance * Math.abs(referenceValue);
        diagramRows.push({
          memberId: member.id,
          quantity,
          station,
          stationM: expected.stations[station],
          reference: referenceValue,
          kernel: kernelValue,
          absoluteError,
          tolerance,
          passed: Number.isFinite(absoluteError) && absoluteError <= tolerance,
        });
      }
    }
  }

  const allRows = [...rows, ...memberRows, ...diagramRows];
  const responsePassed = allRows.every(row => row.passed);
  const deformationPassed = deformationAvailable
    ? deformationRows.every(row => row.passed)
    : null;
  return {
    passed: responsePassed && deformationPassed === true,
    diagnostics: kernel.diagnostics ? { ...kernel.diagnostics } : undefined,
    responsePassed,
    deformationPassed,
    maximumAbsoluteError: allRows.reduce((maximum, row) => Math.max(maximum, row.absoluteError), 0),
    maximumDeformationErrorM: deformationRows.reduce((maximum, row) => Math.max(maximum, row.absoluteError), 0),
    rows,
    memberRows,
    diagramRows,
    deformationRows,
    deformationAvailable,
  };
}

function restraintsFor(support: AnalysisModel['nodes'][number]['support']) {
  switch (support) {
    case 'fixed': return { ux: true, uy: true, rz: true };
    case 'pinned': return { ux: true, uy: true, rz: false };
    case 'roller': return { ux: false, uy: true, rz: false };
    case 'free': return { ux: false, uy: false, rz: false };
  }
}

function opposite(value: number): number {
  return value === 0 ? 0 : -value;
}
