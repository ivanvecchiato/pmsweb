import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = process.env.MBAR_SERVER_ROOT || path.resolve(root, '../../node/mbar-server');
const destination = path.join(root, 'src/generated/beach');
mkdirSync(destination, { recursive: true });
copyFileSync(path.join(serverRoot, 'beach/pricing.js'), path.join(destination, 'pricing.js'));
