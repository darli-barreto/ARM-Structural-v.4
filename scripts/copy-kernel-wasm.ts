import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const files = ['structural_kernel.js', 'structural_kernel_bg.wasm', 'structural_kernel.d.ts'];
const source = resolve('structural_kernel/pkg');
const destination = resolve('public/vendor/structural-kernel');
for (const file of files) {
  if (!existsSync(resolve(source, file))) throw new Error('Build structural_kernel with wasm-pack build --target web first');
}
mkdirSync(destination, { recursive: true });
for (const file of files) copyFileSync(resolve(source, file), resolve(destination, file));
