import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.APP_URL || 'http://127.0.0.1:3036/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000,
  args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);
const repeatCount = Number(process.env.PROFILE_RUNS || 8);
assert.ok(Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 100);

await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(source, options) {
      super(source, options);
      this.profileSource = source;
      this.profileOptions = options;
    }
    postMessage(message, transfer) {
      if (message?.model?.nodes && message?.factors) {
        window.__analysisProfileInput = {
          source: this.profileSource, options: this.profileOptions, message,
        };
      }
      return transfer === undefined ? super.postMessage(message) : super.postMessage(message, transfer);
    }
  };
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#canvas-container canvas').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#status-message')?.textContent === 'Listo');
  await page.evaluate(() => window.dispatchEvent(new Event('arm:examples:open')));
  await page.locator('#examples-modal').waitFor({ state: 'visible' });
  await page.locator('input[name="example"][value="office-8"]').check();
  await page.locator('#examples-analyze').click();
  await page.locator('#analysis-solve').click();
  await page.locator('#analysis-status').getByText('Equilibrio relativo').waitFor();
  console.log('Office analysis captured');

  const input = await page.evaluate(() => window.__analysisProfileInput);
  assert.ok(input?.source && input?.message);
  await page.evaluate(({ source, options }) => {
    window.__profileWorker = new Worker(source, options);
  }, input);

  const cdp = await browser.newBrowserCDPSession();
  let target;
  let targetInfos;
  for (let attempt = 0; attempt < 100 && !target; attempt++) {
    ({ targetInfos } = await cdp.send('Target.getTargets'));
    target = targetInfos.find(item => item.type === 'worker' &&
      item.url.includes(new URL(input.source, url).pathname));
    if (!target) await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(target, `Worker target not found: ${JSON.stringify(targetInfos.map(x => ({ type: x.type, url: x.url })))}`);
  console.log('Worker target found');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  console.log('Worker target attached');
  let commandId = 0;
  const pending = new Map();
  cdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const response = JSON.parse(event.message);
    if (response.id === undefined) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.error) entry.reject(new Error(response.error.message));
    else entry.resolve(response.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP ${method} timed out`));
    }, 10_000);
    pending.set(id, {
      resolve: result => { clearTimeout(timer); resolve(result); },
      reject: error => { clearTimeout(timer); reject(error); },
    });
    cdp.send('Target.sendMessageToTarget', {
      sessionId, message: JSON.stringify({ id, method, params }),
    }).catch(error => { pending.delete(id); reject(error); });
  });

  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', { interval: 100 });
  await send('Profiler.start');
  await page.exposeFunction('__recordWorkerHeap', () => send('Runtime.getHeapUsage'));
  const runs = await page.evaluate(async ({ message, repeatCount }) => {
    const samples = [];
    for (let i = 0; i < repeatCount; i++) {
      const started = performance.now();
      const result = await new Promise((resolve, reject) => {
        window.__profileWorker.onmessage = event => resolve(event.data);
        window.__profileWorker.onerror = event => reject(new Error(event.message));
        window.__profileWorker.postMessage(message);
      });
      if (result.error) throw new Error(result.error);
      const roundTripMs = performance.now() - started;
      const heap = await window.__recordWorkerHeap();
      samples.push({ roundTripMs, usedHeapBytes: heap.usedSize, totalHeapBytes: heap.totalSize });
    }
    return samples;
  }, { message: input.message, repeatCount });
  const { profile } = await send('Profiler.stop');
  await send('Profiler.disable');
  await cdp.send('Target.detachFromTarget', { sessionId });
  await page.evaluate(() => window.__profileWorker.terminate());

  const byId = new Map(profile.nodes.map(node => [node.id, node]));
  const functions = new Map();
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const frame = byId.get(profile.samples[i])?.callFrame;
    if (!frame) continue;
    const name = `${frame.functionName || '(anonymous)'} @ ${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
    functions.set(name, (functions.get(name) ?? 0) + (profile.timeDeltas?.[i] ?? 0));
  }
  const topSelfTime = [...functions].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([functionName, microseconds]) => ({ functionName, milliseconds: microseconds / 1000 }));
  const report = { generatedAt: new Date().toISOString(), url, browser: await page.evaluate(() => navigator.userAgent),
    nodes: input.message.model.nodes.length, members: input.message.model.members.length,
    runs, samples: profile.samples?.length ?? 0, topSelfTime,
    scope: 'Chrome CPU sampling of repeated solves in the production TypeScript analysis Worker. CDP heap usage is captured after, outside each round-trip timing. Used heap is not a peak or leak proof. Self-time samples are statistical and include cold start/JIT; they are not wall-clock attribution or a numerical validation.' };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/analysis-worker-cpu-profile.json', JSON.stringify(report, null, 2) + '\n');
  await writeFile('test-results/analysis-worker-cpu-profile.raw.json', JSON.stringify(profile) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
