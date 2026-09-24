import { test, expect } from 'bun:test';
import { StructuralApplicationLifecycle } from '../src/features/application/StructuralApplicationLifecycle';

test('comparte un arranque concurrente y detiene el motor al liberar el último montaje', async () => {
  const lifecycle = new StructuralApplicationLifecycle();
  let calls = 0;
  let finish!: (dispose: () => void) => void;
  let disposed = 0;
  const start = () => {
    calls++;
    return new Promise<() => void>(resolve => { finish = resolve; });
  };

  const first = lifecycle.acquire(start);
  const second = lifecycle.acquire(start);
  expect(second.ready).toBe(first.ready);
  await Promise.resolve();
  expect(calls).toBe(1);
  finish(() => { disposed++; });
  await first.ready;
  first.release();
  expect(disposed).toBe(0);
  second.release();
  expect(disposed).toBe(1);

  const third = lifecycle.acquire(async () => { calls++; return () => { disposed++; }; });
  await third.ready;
  third.release();
  expect(calls).toBe(2);
  expect(disposed).toBe(2);
});

test('si todos los montajes se liberan antes de terminar el arranque, dispone la escena al completar', async () => {
  const lifecycle = new StructuralApplicationLifecycle();
  let calls = 0;
  let finish!: (dispose: () => void) => void;
  let disposed = 0;
  const lease = lifecycle.acquire(() => {
    calls++;
    return new Promise<() => void>(resolve => { finish = resolve; });
  });
  await Promise.resolve();
  lease.release();
  finish(() => { disposed++; });
  await lease.ready;
  expect(calls).toBe(1);
  expect(disposed).toBe(1);
});

test('un fallo de arranque no queda cacheado y permite reintentar', async () => {
  const lifecycle = new StructuralApplicationLifecycle();
  let calls = 0;
  const failed = lifecycle.acquire(async () => { calls++; throw new Error('WASM init failed'); });
  await expect(failed.ready).rejects.toThrow('WASM init failed');
  failed.release();
  const retry = lifecycle.acquire(async () => { calls++; return () => {}; });
  await retry.ready;
  retry.release();
  expect(calls).toBe(2);
});
