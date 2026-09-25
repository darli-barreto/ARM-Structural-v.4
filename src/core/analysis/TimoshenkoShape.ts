export interface TimoshenkoShapeInput {
  lengthM: number;
  axialRigidityN: number;
  bendingRigidityNm2: number;
  shearRigidityN: number;
  /** Local translations and counter-clockwise section rotations at both ends. */
  endDisplacements: readonly [number, number, number, number, number, number];
  axialLoadNPerM: number;
  transverseLoadNPerM: number;
}

/** Exact static Timoshenko field for a uniform line load and constant section. */
export function sampleTimoshenkoShape(
  input: TimoshenkoShapeInput,
  stationsM: readonly number[],
): { axialM: number[]; transverseM: number[] } {
  const { lengthM: length, axialRigidityN: ea, bendingRigidityNm2: ei,
    shearRigidityN: shear, endDisplacements: d, axialLoadNPerM: qx,
    transverseLoadNPerM: qy } = input;
  if (![length, ea, ei, shear].every(value => Number.isFinite(value) && value > 0)
      || ![...d, qx, qy].every(Number.isFinite) || d.length !== 6) {
    throw new Error('Datos no validos para recuperar la deformada Timoshenko.');
  }
  const phi = 12 * ei / (shear * length * length);
  if (!Number.isFinite(phi)) throw new Error('Rigidez de corte no valida.');
  const denominator = 1 + phi;
  const axialM: number[] = [];
  const transverseM: number[] = [];

  for (const x of stationsM) {
    if (!Number.isFinite(x) || x < 0 || x > length) {
      throw new Error('Estacion fuera del elemento.');
    }
    const r = x / length;
    const r2 = r * r;
    const r3 = r2 * r;
    const n1 = (1 - 3 * r2 + 2 * r3 + phi * (1 - r)) / denominator;
    const n2 = length * (r - 2 * r2 + r3 + phi * (r - r2) / 2) / denominator;
    const n3 = (3 * r2 - 2 * r3 + phi * r) / denominator;
    const n4 = length * (-r2 + r3 - phi * (r - r2) / 2) / denominator;
    const axial = (1 - r) * d[0] + r * d[3] + qx * x * (length - x) / (2 * ea);
    const transverse = n1 * d[1] + n2 * d[2] + n3 * d[4] + n4 * d[5]
      + qy * x * x * (length - x) * (length - x) / (24 * ei)
      + qy * x * (length - x) / (2 * shear);
    if (!Number.isFinite(axial) || !Number.isFinite(transverse)) {
      throw new Error('Deformada Timoshenko no finita.');
    }
    axialM.push(axial);
    transverseM.push(transverse);
  }
  return { axialM, transverseM };
}
