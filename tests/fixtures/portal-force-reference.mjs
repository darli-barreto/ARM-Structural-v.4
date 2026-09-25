import assert from 'node:assert/strict';

// Test-only force-method oracle. No FEM matrices or production solver imports.
// A serial three-member portal is clamped at node 0; node 3 is released,
// then its three reactions are recovered from zero displacement compatibility.
// Coordinates: m; forces: kN; moments/rotations: counterclockwise positive.
export function portalForceReference(points, loads, rigidities) {
  assert.equal(points.length, 4);
  return treeForceReference(points, loads, [[0, 1], [1, 2], [2, 3]], 3, [], rigidities);
}

// Each split pairs a duplicate free beam tip with its physical column node.
// The released structure must be a rooted tree, with parent indices before children.
export function treeForceReference(points, loads, edges, rightBase, splits, { EA, EI, shear, memberRigidities }) {
  assert.equal(loads.length, points.length);
  assert.equal(edges.length, points.length - 1);
  const parent = Array(points.length).fill(-1);
  for (const [start, end] of edges) {
    assert.ok(start >= 0 && start < end && end < points.length && parent[end] === -1);
    parent[end] = start;
  }
  assert.ok(parent.slice(1).every(value => value >= 0));
  const descendants = edges.map(([, end]) => points.flatMap((_, node) => {
    let ancestor = node;
    while (ancestor > end) ancestor = parent[ancestor];
    return ancestor === end ? [node] : [];
  }));
  const sections = memberRigidities ?? edges.map(() => ({ EA, EI, shear }));
  assert.equal(sections.length, edges.length);
  for (const section of sections) {
    for (const value of [section.EA, section.EI, section.shear]) assert.ok(Number.isFinite(value) && value > 0);
  }
  const unit = (node, dof) => points.map((_, index) =>
    [0, 1, 2].map(component => Number(index === node && component === dof)));

  function internal(actions, member, fraction) {
    const start = points[edges[member][0]];
    const end = points[edges[member][1]];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    assert.ok(length > 0);
    const x = start[0] + fraction * dx;
    const y = start[1] + fraction * dy;
    let fx = 0, fy = 0, moment = 0;
    for (const node of descendants[member]) {
      const [px, py, couple] = actions[node];
      fx += px;
      fy += py;
      moment += (points[node][0] - x) * py - (points[node][1] - y) * px + couple;
    }
    return [(fx * dx + fy * dy) / length, (-fx * dy + fy * dx) / length, moment];
  }

  function work(first, second) {
    let value = 0;
    for (let member = 0; member < edges.length; member++) {
      const { EA, EI, shear } = sections[member];
      const [start, end] = edges[member];
      const length = Math.hypot(points[end][0] - points[start][0],
        points[end][1] - points[start][1]);
      // Two Gauss points integrate the quadratic moment product exactly.
      for (const fraction of [(1 - 1 / Math.sqrt(3)) / 2, (1 + 1 / Math.sqrt(3)) / 2]) {
        const a = internal(first, member, fraction);
        const b = internal(second, member, fraction);
        value += length / 2 * (a[0] * b[0] / EA + a[1] * b[1] / shear + a[2] * b[2] / EI);
      }
    }
    return value;
  }

  const units = [0, 1, 2].map(dof => unit(rightBase, dof));
  for (const [tip, column] of splits) {
    assert.deepEqual(points[tip], points[column]);
    for (let dof = 0; dof < 3; dof++) {
      const actions = unit(tip, dof);
      actions[column][dof] = -1;
      units.push(actions);
    }
  }
  const size = units.length;
  const flexibility = units.map(a => units.map(b => work(a, b)));
  const rhs = units.map(a => -work(a, loads));
  const rows = flexibility.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    assert.ok(Math.abs(rows[col][col]) > 1e-18, 'Oracle flexibility must be nonsingular');
    const divisor = rows[col][col];
    rows[col] = rows[col].map(value => value / divisor);
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      rows[row] = rows[row].map((value, j) => value - factor * rows[col][j]);
    }
  }
  const redundant = rows.map(row => row[size]);
  const right = redundant.slice(0, 3);
  const actions = loads.map(row => [...row]);
  units.forEach((pattern, index) => pattern.forEach((values, node) => values.forEach((value, dof) => {
    actions[node][dof] += value * redundant[index];
  })));
  const displacements = points.map((_, node) => [0, 1, 2].map(dof => work(unit(node, dof), actions)));
  units.forEach(pattern => assert.ok(Math.abs(work(pattern, actions)) < 1e-10, 'Oracle compatibility'));
  const memberForces = edges.map((_, member) => [
    ...internal(actions, member, 0).map(value => -value),
    ...internal(actions, member, 1),
  ]);
  const left = [0, 0, 0];
  actions.forEach(([fx, fy, mz], node) => {
    left[0] -= fx;
    left[1] -= fy;
    left[2] -= mz + (points[node][0] - points[0][0]) * fy - (points[node][1] - points[0][1]) * fx;
  });
  return { displacements, left, right, memberForces };
}
