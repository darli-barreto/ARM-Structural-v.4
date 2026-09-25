import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.KERNEL_TEST_URL;
if (!url) throw new Error('KERNEL_TEST_URL is required');
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000,
  args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const navigationStart = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => ['done', 'error'].includes(window.kernelWorkerPerformance?.status),
    null, { timeout: 120_000 });
  const probe = await page.evaluate(() => window.kernelWorkerPerformance);
  assert.equal(probe.status, 'done', probe.error);
  assert.deepEqual(errors, []);
  assert.equal(probe.result.cases.length, 4);
  for (const result of probe.result.cases) {
    assert.equal(result.warmRoundTripsMs.length, 6);
    assert.ok(result.outputBytes > result.inputBytes);
    assert.ok(result.diagnostics.maxResidualToleranceRatio <= 1);
  }
  assert.equal(probe.result.soak.requestCount, 60);
  assert.equal(probe.result.soak.deterministic, true);
  const report = { generatedAt: new Date().toISOString(), browser: probe.result.userAgent,
    pageElapsedMs: Date.now() - navigationStart, cases: probe.result.cases, soak: probe.result.soak,
    frameMetric: probe.result.frameMetric,
    scope: 'Includes browser input serialization/validation, postMessage structured clone, Worker startup and WASM loading on first request, WASM solve/JSON output, response clone, client response validation and Promise delivery. Warm requests reuse the same Worker. Does not isolate solver time or measure worker-private memory.' };
  writeFileSync(new URL('../test-results/frame2d-worker-performance.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
