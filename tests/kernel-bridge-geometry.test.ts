import { describe, expect, test } from 'bun:test';
import { WasmBridge } from '../src/kernel/WasmBridge';

function signedVolume(positions: Float32Array, indices: ArrayLike<number>): number {
  let volume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const points = [indices[index], indices[index + 1], indices[index + 2]].map(vertex => [
      positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2],
    ]);
    const [a, b, c] = points;
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1])
      + a[1] * (b[2] * c[0] - b[0] * c[2])
      + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return volume;
}

describe('Three.js bridge handedness', () => {
  test('arbitrary and vertical beam frames retain outward triangle winding', () => {
    const bridge = new WasmBridge();
    for (const end of [{ x: 3, y: 4, z: 12 }, { x: 0, y: 3, z: 0 }, { x: -5, y: 0, z: 0 }]) {
      const data = bridge.createArbitraryBeam({ x: 0, y: 0, z: 0 }, end, 0.3, 0.5);
      const positions = data.geometry.getAttribute('position').array as Float32Array;
      const indices = data.geometry.getIndex()!.array;
      expect(signedVolume(positions, indices)).toBeGreaterThan(0);
      expect(Math.abs(signedVolume(positions, indices) - data.volume)).toBeLessThan(1e-5);
      data.geometry.dispose();
    }
  });
});
