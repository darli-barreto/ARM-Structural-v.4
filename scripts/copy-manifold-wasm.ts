import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'node_modules', 'manifold-3d', 'manifold.wasm');
const directory = path.join(process.cwd(), 'public', 'vendor');

mkdirSync(directory, { recursive: true });
copyFileSync(source, path.join(directory, 'manifold.wasm'));
