import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.KERNEL_TEST_URL;
if (!url) throw new Error('KERNEL_TEST_URL is required');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  timeout: 30_000,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  const loaded = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => loaded.add(new URL(request.url()).pathname));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => ['done', 'error'].includes(window.kernelWorkerProbe?.status),
    null, { timeout: 30_000 });
  const probe = await page.evaluate(() => window.kernelWorkerProbe);
  assert.equal(probe.status, 'done', probe.error);
  assert.ok(loaded.has('/frame2d.worker.js'), 'actual Worker script was requested');
  assert.ok(loaded.has('/vendor/structural-kernel/structural_kernel.js'), 'WASM adapter was requested');
  assert.ok(loaded.has('/vendor/structural-kernel/structural_kernel_bg.wasm'), 'WASM binary was requested');
  assert.equal(probe.cantilever.stations, 21);
  assert.equal(probe.supported.stations, 21);
  assert.ok(Math.abs(probe.cantilever.reactionN - 10_000) < 1e-7);
  const cantileverMid = -10_000 * 1.5 ** 2 * (3 * 3 - 1.5) / (6 * 30e9 * 0.00045)
    - 10_000 * 1.5 / ((5 / 6) * 12.5e9 * 0.06);
  const cantileverTip = -10_000 * 3 ** 3 / (3 * 30e9 * 0.00045)
    - 10_000 * 3 / ((5 / 6) * 12.5e9 * 0.06);
  assert.ok(Math.abs(probe.cantilever.midpointM - cantileverMid) < 1e-10);
  assert.ok(Math.abs(probe.cantilever.tipM - cantileverTip) < 1e-10);
  const supportedMid = -5 * 10_000 * 6 ** 4 / (384 * 25e9 * 0.003125)
    - 10_000 * 6 ** 2 / (8 * (5 / 6) * (25e9 / 2.4) * 0.15);
  assert.ok(Math.abs(probe.supported.midpointM - supportedMid) < 1e-10);
  assert.ok(probe.supported.reactionsN.every(value => Math.abs(value - 30_000) < 1e-7));
    assert.equal(probe.singularCode, 'KERNEL_SINGULAR_SYSTEM');
    assert.equal(probe.diagnostics.freeDofs, 3);
    assert.ok(Number.isFinite(probe.diagnostics.scaledConditionEstimate)
      && probe.diagnostics.scaledConditionEstimate >= 1);
    assert.ok(Number.isFinite(probe.diagnostics.maxComponentwiseBackwardError)
      && probe.diagnostics.maxComponentwiseBackwardError <= 1e-10);
    assert.ok(Number.isFinite(probe.diagnostics.maxResidualToleranceRatio)
      && probe.diagnostics.maxResidualToleranceRatio <= 1);
  assert.equal(probe.cancellationCode, 'KERNEL_CANCELLED');
  assert.deepEqual(errors, []);
  console.log('Browser Worker passed: real Chrome Worker, WASM, 2D analytic curves, reactions, errors and cancellation.');
} finally {
  await browser.close();
}
