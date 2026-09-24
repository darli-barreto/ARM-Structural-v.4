import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { footerStatusStore } from '../src/features/footer-status/FooterStatusStore';

test('La barra de estado publica snapshots inmutables y omite cambios que no alteran lo visible', () => {
  const initial = footerStatusStore.getSnapshot();
  let notifications = 0;
  const unsubscribe = footerStatusStore.subscribe(() => notifications++);

  footerStatusStore.setMessage('Vista activa: Planta');
  assert.equal(notifications, 1);
  assert.equal(footerStatusStore.getSnapshot().message, 'Vista activa: Planta');

  footerStatusStore.setCoordinates(1.234, 5.678, 3.5);
  assert.equal(footerStatusStore.getSnapshot().coordinates, 'X: 1.23m  |  Z: 5.68m  |  Elev (Y): 3.50m');
  footerStatusStore.setCoordinates(1.233, 5.677, 3.5);
  assert.equal(notifications, 2);

  footerStatusStore.updateMetrics(4, 0.185, 1.236, 60);
  assert.deepEqual(
    [footerStatusStore.getSnapshot().count, footerStatusStore.getSnapshot().volume, footerStatusStore.getSnapshot().calcMs, footerStatusStore.getSnapshot().fps],
    [4, 0.185, 1.236, 60]
  );
  assert.equal(notifications, 3);
  assert.equal(initial.message, 'Listo');

  unsubscribe();
  footerStatusStore.setMessage(initial.message);
  footerStatusStore.setCoordinates(0, 0, 0);
  footerStatusStore.updateMetrics(0, 0, 0, 0);
});
