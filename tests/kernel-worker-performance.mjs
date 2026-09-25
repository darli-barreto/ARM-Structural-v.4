import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const outputDir = resolve('test-results/kernel-worker-performance');
mkdirSync(outputDir, { recursive: true });
const build = await Bun.build({
  entrypoints: [resolve('src/kernel/worker/frame2d.worker.ts'),
    resolve('tests/fixtures/kernel-worker-performance-harness.ts')],
  outdir: outputDir, target: 'browser', naming: '[name].[ext]',
});
if (!build.success) throw new Error(`Kernel Worker benchmark bundle failed: ${build.logs.join('\n')}`);
const assets = new Map([
  ['/frame2d.worker.js', resolve(outputDir, 'frame2d.worker.js')],
  ['/kernel-worker-performance-harness.js', resolve(outputDir, 'kernel-worker-performance-harness.js')],
  ['/vendor/structural-kernel/structural_kernel.js', resolve('public/vendor/structural-kernel/structural_kernel.js')],
  ['/vendor/structural-kernel/structural_kernel_bg.wasm', resolve('public/vendor/structural-kernel/structural_kernel_bg.wasm')],
]);
for (const path of assets.values()) if (!(await Bun.file(path).exists())) throw new Error(`Missing asset: ${path}`);
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><title>Kernel Worker performance</title>'
  + '<pre id="result">Running</pre><script type="module" src="/kernel-worker-performance-harness.js"></script>'
  + '<script>const poll=setInterval(()=>{const r=window.kernelWorkerPerformance;if(r){document.querySelector(\'#result\').textContent=JSON.stringify(r);if(r.status!==\'running\')clearInterval(poll)}},50)</script></html>';
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const file = assets.get(path);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(Bun.file(file), { headers: { 'Content-Type': path.endsWith('.wasm')
    ? 'application/wasm' : 'text/javascript; charset=utf-8' } });
} });
try {
  const runner = Bun.spawn(['node', resolve('tests/kernel-worker-performance-playwright.mjs')], {
    env: { ...process.env, KERNEL_TEST_URL: `http://127.0.0.1:${server.port}/` },
    stdout: 'inherit', stderr: 'inherit',
  });
  const code = await runner.exited;
  if (code !== 0) process.exitCode = code;
} finally { server.stop(true); }
