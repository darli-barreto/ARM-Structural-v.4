import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

console.log('Starting Chrome for analysis results verification.');
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30000, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('test-results', { recursive: true });

async function chooseExample(id, replace = false) {
  await page.evaluate(() => window.dispatchEvent(new Event('arm:examples:open')));
  await page.locator('#examples-modal').waitFor({ state: 'visible' });
  await page.locator(`input[name="example"][value="${id}"]`).check();
  if (replace) page.once('dialog', dialog => dialog.accept());
  await page.locator('#examples-analyze').click();
  await page.locator('#analysis-panel').waitFor({ state: 'visible' });
}

async function solve() {
  await page.locator('#analysis-solve').click();
  await page.waitForFunction(() => document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));
}

async function exportedMemory() {
  const downloadReady = page.waitForEvent('download');
  await page.locator('#analysis-report').click();
  const download = await downloadReady;
  assert.equal(download.suggestedFilename(), 'memoria-portico.html');
  const path = await download.path();
  assert.ok(path, 'report downloaded successfully');
  return readFile(path, 'utf8');
}

try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:3015/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#canvas-container canvas').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#status-message')?.textContent === 'Listo', null, { timeout: 60000 });
  console.log('Application ready; checking reference and exported memory.');
  await chooseExample('cantilever');
  await solve();
  assert.match(await page.locator('#analysis-table').textContent(), /Lectura técnica del cálculo/);
  assert.match(await page.locator('#analysis-table').textContent(), /Auditoría de reacciones/);
  assert.match(await page.locator('#analysis-table').textContent(), /Solución analítica independiente/);
  assert.equal(await page.locator('#analysis-table details').count(), 3);
  const nodes = page.locator('#analysis-table details').filter({ hasText: 'Desplazamientos y reacciones' });
  assert.equal(await nodes.getAttribute('open'), '');
  await nodes.locator('summary').click();
  assert.equal(await nodes.getAttribute('open'), null);
  await nodes.locator('summary').click();
  const unverifiedMemory = await exportedMemory();
  assert.match(unverifiedMemory, /Auditoría de reacciones/);
  assert.match(unverifiedMemory, /No se ejecuto el contraste Rust\/WASM/);
  assert.match(unverifiedMemory, /No acredita cumplimiento integral del RNE/);
  console.log('Checking Rust Worker and exported comparison.');
  await page.locator('#analysis-kernel-compare').click();
  await page.waitForFunction(() => document.querySelector('#analysis-table')?.textContent.includes('Deformada Timoshenko:'));
  assert.match(await page.locator('#analysis-table').textContent(), /Nudos y reacciones/);
  assert.match(await page.locator('#analysis-table').textContent(), /Diagramas a lo largo de cada barra/);
  const diagnostics = page.getByTestId('kernel-diagnostics');
  await diagnostics.locator('summary').click();
  assert.match(await diagnostics.textContent(), /Condicionamiento escalado estimado/);
  assert.match(await diagnostics.textContent(), /1\.359e\+1/);
  assert.match(await diagnostics.textContent(), /Puede subestimar/);
  const diagrams = page.locator('#analysis-table details').filter({ hasText: 'Diagramas a lo largo de cada barra' });
  assert.equal(await diagrams.locator('tbody tr').count(), 0, 'collapsed comparison does not render rows');
  await diagrams.locator('summary').click();
  await diagrams.locator('tbody tr').first().waitFor();
  assert.equal(await diagrams.locator('tbody tr').count(), 50);
  await diagrams.getByRole('button', { name: 'Página siguiente' }).click();
  assert.equal(await diagrams.locator('tbody tr').count(), 13);
  await diagrams.locator('summary').click();
  await diagrams.locator('tbody tr').first().waitFor({ state: 'detached' });
  assert.equal(await diagrams.locator('tbody tr').count(), 0);
  const comparedMemory = await exportedMemory();
  assert.match(comparedMemory, /Contraste ARM \/ Rust/);
  assert.match(comparedMemory, /Dentro de tolerancia/);
  assert.match(comparedMemory, /Condicionamiento escalado estimado/);
  assert.match(comparedMemory, /1\.359e\+1/);
  assert.match(comparedMemory, /No certifican seguridad estructural/);
  assert.doesNotMatch(comparedMemory, /No se ejecuto el contraste Rust\/WASM/);
  await page.locator('#analysis-panel').screenshot({ path: 'test-results/analysis-results-reference.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await diagnostics.scrollIntoViewIfNeeded();
  const diagnosticBounds = await diagnostics.boundingBox();
  assert.ok(diagnosticBounds && diagnosticBounds.x >= 0
    && diagnosticBounds.x + diagnosticBounds.width <= 391, 'diagnostics fit mobile viewport');
  assert.equal(await diagnostics.locator('dl').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 1);
  await diagnostics.screenshot({ path: 'test-results/analysis-diagnostics-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#analysis-close').click();

  console.log('Checking pagination on the 103-node building.');
  await chooseExample('office-8', true);
  await solve();
  const largeNodes = page.locator('#analysis-table details').filter({ hasText: 'Desplazamientos y reacciones' });
  await largeNodes.locator('summary').click();
  assert.match(await largeNodes.textContent(), /103 registros · página 1 de 3/);
  assert.equal(await largeNodes.locator('tbody tr').count(), 50);
  await largeNodes.getByRole('button', { name: 'Página siguiente' }).click();
  assert.match(await largeNodes.textContent(), /página 2 de 3/);
  await page.locator('#analysis-panel').screenshot({ path: 'test-results/analysis-results-large.png' });
  assert.deepEqual(errors, []);
  console.log('Analysis results browser passed: collapsible sections, Rust comparison, downloaded memory and paged large model.');
} finally {
  await browser.close();
}
