import { resolve } from 'node:path';
import '../scripts/copy-kernel-wasm.ts';

const outputDir = resolve('test-results/kernel-worker');
const build = await Bun.build({
  entrypoints: [
    resolve('src/kernel/worker/frame2d.worker.ts'),
    resolve('tests/fixtures/kernel-worker-harness.ts'),
  ],
  outdir: outputDir,
  target: 'browser',
  naming: '[name].[ext]',
});
if (!build.success) throw new Error(`Kernel Worker bundle failed: ${build.logs.join('\n')}`);

const assets = new Map([
  ['/frame2d.worker.js', resolve(outputDir, 'frame2d.worker.js')],
  ['/kernel-worker-harness.js', resolve(outputDir, 'kernel-worker-harness.js')],
  ['/vendor/structural-kernel/structural_kernel.js', resolve('public/vendor/structural-kernel/structural_kernel.js')],
  ['/vendor/structural-kernel/structural_kernel_bg.wasm', resolve('public/vendor/structural-kernel/structural_kernel_bg.wasm')],
]);
for (const asset of assets.values()) {
  if (!(await Bun.file(asset).exists())) throw new Error(`Missing browser asset: ${asset}`);
}

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Structural Kernel Worker</title>
<pre id="result">Iniciando Worker...</pre><script type="module" src="/kernel-worker-harness.js"></script>
<script>const timer=setInterval(()=>{const probe=window.kernelWorkerProbe;if(probe){document.querySelector('#result').textContent=JSON.stringify(probe,null,2);if(probe.status!=='running')clearInterval(timer)}},50)</script></html>`;
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    const asset = assets.get(path);
    if (!asset) return new Response('Not found', { status: 404 });
    const type = path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8';
    return new Response(Bun.file(asset), { headers: { 'Content-Type': type } });
  },
});
const url = `http://127.0.0.1:${server.port}/`;

if (process.argv.includes('--serve-only')) {
  console.log(`Kernel Worker browser fixture: ${url}`);
  await new Promise(() => {});
} else {
  try {
    const runner = Bun.spawn(['node', resolve('tests/kernel-worker-playwright.mjs')], {
      env: { ...process.env, KERNEL_TEST_URL: url },
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const exitCode = await runner.exited;
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    server.stop(true);
  }
}
