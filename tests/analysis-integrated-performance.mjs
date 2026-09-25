import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.APP_URL || 'http://127.0.0.1:3036/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000,
  args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.__nativeWorkerPostMessage = NativeWorker.prototype.postMessage;
  const events = [];
  window.__analysisTiming = { events, phase: '' };
  window.Worker = class extends NativeWorker {
    constructor(source, options) {
      super(source, options);
      this.__source = source;
      this.__options = options;
      this.addEventListener('message', event => {
        if (this.__analysisKind === 'ts' || this.__analysisKind === 'rust') {
          events.push({ type: 'received', phase: window.__analysisTiming.phase,
            engine: this.__analysisKind, at: performance.now(), profile: event.data?.profile });
        }
      });
    }

    postMessage(message, transfer) {
      this.__analysisKind = message?.model?.version === 1 ? 'rust'
        : message?.model && message?.factors ? 'ts' : 'other';
      if (this.__analysisKind !== 'other') {
        events.push({ type: 'sent', phase: window.__analysisTiming.phase,
          engine: this.__analysisKind, at: performance.now(),
          nodes: message.model.nodes.length, members: message.model.members.length });
        if (this.__analysisKind === 'ts' && window.__analysisTiming.phase === 'ts-office-8') {
          window.__analysisTiming.officeRequest = message;
          window.__analysisTiming.tsWorkerUrl = this.__source;
          window.__analysisTiming.tsWorkerOptions = this.__options;
        }
        if (this.__analysisKind === 'rust' && window.__analysisTiming.phase === 'rust-office-8') {
          window.__analysisTiming.rustOfficeRequest = message;
          window.__analysisTiming.rustWorkerUrl = this.__source;
          window.__analysisTiming.rustWorkerOptions = this.__options;
        }
      }
      const request = this.__analysisKind === 'ts' ? { ...message, profile: true } : message;
      return transfer === undefined ? super.postMessage(request) : super.postMessage(request, transfer);
    }
  };
});

async function chooseExample(id, replace = false) {
  await page.evaluate(() => window.dispatchEvent(new Event('arm:examples:open')));
  await page.locator('#examples-modal').waitFor({ state: 'visible' });
  await page.locator(`input[name="example"][value="${id}"]`).check();
  if (replace) page.once('dialog', dialog => dialog.accept());
  await page.locator('#examples-analyze').click();
  await page.locator('#analysis-panel').waitFor({ state: 'visible' });
}

async function measure(phase, engine, button, textSelector, expectedText) {
  await page.evaluate(({ phase, button, textSelector, expectedText }) => {
    const timing = window.__analysisTiming;
    timing.phase = phase;
    const action = document.querySelector(button);
    if (!action) throw new Error(`Missing ${button}`);
    action.addEventListener('click', () => timing.events.push({ type: 'clicked', phase,
      engine: phase.startsWith('rust') ? 'rust' : 'ts', at: performance.now() }),
    { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (!timing.events.some(event => event.type === 'clicked' && event.phase === phase)) return;
      if (!document.querySelector(textSelector)?.textContent?.includes(expectedText)) return;
      timing.events.push({ type: 'rendered', phase, at: performance.now() });
      observer.disconnect();
      requestAnimationFrame(() => timing.events.push({ type: 'paint', phase, at: performance.now() }));
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }, { phase, button, textSelector, expectedText });
  await page.locator(button).click();
  await page.waitForFunction(phase => window.__analysisTiming.events.some(event =>
    event.type === 'paint' && event.phase === phase), phase, { timeout: 60_000 });
  const events = await page.evaluate(phase => window.__analysisTiming.events.filter(event => event.phase === phase), phase);
  const get = type => events.find(event => event.type === type);
  const click = get('clicked'), send = get('sent'), receive = get('received');
  const render = get('rendered'), paint = get('paint');
  assert.ok(click && send && receive && render && paint, `${phase}: missing timing marker: ${JSON.stringify(events)}`);
  assert.equal(send.engine, engine);
  assert.equal(receive.engine, engine);
  assert.ok(click.at <= send.at && send.at <= receive.at && receive.at <= render.at && render.at <= paint.at);
  return { phase, engine, nodes: send.nodes, members: send.members,
    clickToSendMs: send.at - click.at, workerRoundTripMs: receive.at - send.at,
    receiveToDomMs: render.at - receive.at, domToPaintMs: paint.at - render.at,
    clickToPaintMs: paint.at - click.at, profile: receive.profile ?? null,
    resultText: (await page.locator(textSelector).textContent())?.slice(0, 220) };
}

async function measureWarmWorker() {
  return page.evaluate(async () => {
    const { officeRequest, tsWorkerUrl, tsWorkerOptions } = window.__analysisTiming;
    if (!officeRequest || !tsWorkerUrl) throw new Error('Office Worker request was not captured');
    const worker = new Worker(tsWorkerUrl, tsWorkerOptions);
    const runs = [];
    let referenceResult;
    try {
      for (let index = 0; index < 8; index++) {
        const started = performance.now();
        const response = await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          worker.postMessage({ ...officeRequest, profile: true });
        });
        if (response.error || !response.profile) throw new Error(response.error || 'Missing Worker profile');
        referenceResult ??= response.result;
        runs.push({ roundTripMs: performance.now() - started, ...response.profile });
      }
      const ordinarySamples = [];
      for (let index = 0; index < 8; index++) {
        const started = performance.now();
        const ordinary = await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          window.__nativeWorkerPostMessage.call(worker, officeRequest);
        });
        ordinarySamples.push(performance.now() - started);
        if (ordinary.error || ordinary.profile !== undefined ||
            JSON.stringify(ordinary.result) !== JSON.stringify(referenceResult)) {
          throw new Error('Profiled Worker changed the ordinary analysis response');
        }
      }
      window.__analysisTiming.ordinaryWorkerSamples = ordinarySamples;
      return runs;
    } finally { worker.terminate(); }
  });
}

async function measurePlainWorker() {
  return page.evaluate(async () => {
    const { officeRequest, tsWorkerUrl, tsWorkerOptions } = window.__analysisTiming;
    const worker = new Worker(tsWorkerUrl, tsWorkerOptions);
    const samples = [];
    let fingerprint;
    try {
      for (let index = 0; index < 16; index++) {
        const started = performance.now();
        const response = await new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
          window.__nativeWorkerPostMessage.call(worker, officeRequest);
        });
        samples.push(performance.now() - started);
        if (response.error || response.profile !== undefined || !response.result) {
          throw new Error('Plain Worker returned an unexpected response');
        }
        const current = JSON.stringify(response.result);
        if (fingerprint && fingerprint !== current) throw new Error('Plain Worker result changed');
        fingerprint = current;
      }
      return samples;
    } finally { worker.terminate(); }
  });
}

async function measurePairedWorkers() {
  return page.evaluate(async () => {
    const timing = window.__analysisTiming;
    const pairs = [
      { engine: 'ts', source: timing.tsWorkerUrl, options: timing.tsWorkerOptions, request: timing.officeRequest },
      { engine: 'rust', source: timing.rustWorkerUrl, options: timing.rustWorkerOptions, request: timing.rustOfficeRequest },
    ];
    if (pairs.some(pair => !pair.source || !pair.request)) throw new Error('Missing paired Worker request');
    const workers = pairs.map(pair => new Worker(pair.source, pair.options));
    const samples = { ts: [], rust: [] };
    const fingerprints = {};
    const call = async index => {
      const worker = workers[index], pair = pairs[index];
      const started = performance.now();
      const response = await new Promise((resolve, reject) => {
        worker.onmessage = event => resolve(event.data);
        worker.onerror = event => reject(new Error(event.message));
        window.__nativeWorkerPostMessage.call(worker, pair.request);
      });
      const duration = performance.now() - started;
      if (response.error || response.ok === false || !response.result) {
        throw new Error(`${pair.engine}: ${response.error || response.code || 'missing result'}`);
      }
      const fingerprint = JSON.stringify(response.result);
      if (fingerprints[pair.engine] && fingerprints[pair.engine] !== fingerprint) {
        throw new Error(`${pair.engine}: nondeterministic response`);
      }
      fingerprints[pair.engine] = fingerprint;
      return duration;
    };
    try {
      for (let index = 0; index < 5; index++) {
        await call(0);
        await call(1);
      }
      for (let index = 0; index < 16; index++) {
        const order = index % 2 === 0 ? [0, 1] : [1, 0];
        for (const engineIndex of order) {
          samples[pairs[engineIndex].engine].push(await call(engineIndex));
        }
      }
      return { samples, resultBytes: { ts: fingerprints.ts.length, rust: fingerprints.rust.length } };
    } finally { workers.forEach(worker => worker.terminate()); }
  });
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('#canvas-container canvas').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#status-message')?.textContent === 'Listo');
  const measurements = [];
  await chooseExample('cantilever');
  measurements.push(await measure('ts-cantilever', 'ts', '#analysis-solve', '#analysis-status', 'Equilibrio relativo'));
  measurements.push(await measure('rust-cantilever', 'rust', '#analysis-kernel-compare', '#analysis-table', 'Deformada Timoshenko:'));
  await page.locator('#analysis-close').click();
  await chooseExample('office-8', true);
  measurements.push(await measure('ts-office-8', 'ts', '#analysis-solve', '#analysis-status', 'Equilibrio relativo'));
  measurements.push(await measure('rust-office-8', 'rust', '#analysis-kernel-compare', '#analysis-table', 'Deformada Timoshenko:'));
  const plainWorkerSamples = await measurePlainWorker();
  const warmWorker = await measureWarmWorker();
  const pairedWorkers = await measurePairedWorkers();
  assert.deepEqual(errors, []);
  const report = { generatedAt: new Date().toISOString(), url, browser: await page.evaluate(() => navigator.userAgent),
    measurements, plainWorkerSamples, warmWorker,
    ordinaryWorkerSamples: await page.evaluate(() => window.__analysisTiming.ordinaryWorkerSamples),
    pairedWorkers,
    scope: 'ARM-Structural production UI and real examples. Timings mark click capture, Worker messages, DOM mutation and next animation frame. Plain and profiled TS series use separate diagnostic Workers; paired series uses one TS and one Rust Worker with five warmups and sixteen alternating calls per engine. Inputs represent the same physical office model but result formats and internal algorithms differ. Persistent diagnostic Workers do not represent the current one-shot UI policy. Browser automation latency is excluded.' };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/analysis-integrated-performance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
