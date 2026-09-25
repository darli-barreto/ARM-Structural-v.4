import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const tests = readdirSync(resolve('tests'), { recursive: true })
  .filter((path): path is string => typeof path === 'string' && /\.test\.tsx?$/.test(path))
  .map(path => resolve('tests', path)).sort();
if (!tests.length) throw new Error('No unit tests found');
const child = Bun.spawn([process.execPath, 'test', ...tests], { stdout: 'inherit', stderr: 'inherit' });
process.exit(await child.exited);
