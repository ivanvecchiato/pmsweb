import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.resolve(process.env.DIST_DIR || path.join(projectRoot, 'dist'));
const targetHtdocs = path.resolve(
  process.env.MBAR_HTDOCS || 'C:\\work\\node\\mbar-server\\htdocs',
);

console.log(`[deploy] Dist dir: ${distDir}`);
console.log(`[deploy] Target htdocs: ${targetHtdocs}`);

if (!existsSync(distDir)) {
  console.error(`[deploy] ERRORE: cartella dist non trovata: ${distDir}`);
  process.exit(1);
}

if (!existsSync(targetHtdocs)) {
  console.error(`[deploy] ERRORE: cartella target non trovata: ${targetHtdocs}`);
  process.exit(1);
}

const hasValidBuildOutput = () => {
  const indexPath = path.join(distDir, 'index.html');
  const assetsPath = path.join(distDir, 'assets');
  return existsSync(indexPath) && existsSync(assetsPath);
};

if (!hasValidBuildOutput()) {
  console.log('[deploy] Dist incompleta, eseguo build...');

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!hasValidBuildOutput()) {
  console.error(`[deploy] ERRORE: build non valida. Attesi index.html e assets in: ${distDir}`);
  process.exit(1);
}

const targetAssetsDir = path.join(targetHtdocs, 'assets');
rmSync(targetAssetsDir, { recursive: true, force: true });
mkdirSync(targetAssetsDir, { recursive: true });
cpSync(path.join(distDir, 'assets'), targetAssetsDir, { recursive: true });

const indexPath = path.join(distDir, 'index.html');
if (existsSync(indexPath)) {
  cpSync(indexPath, path.join(targetHtdocs, 'index.html'));
} else {
  console.error('[deploy] ERRORE: index.html non trovato in dist');
  process.exit(1);
}

const faviconPath = path.join(distDir, 'favicon.ico');
if (existsSync(faviconPath)) {
  cpSync(faviconPath, path.join(targetHtdocs, 'favicon.ico'));
}

for (const name of readdirSync(distDir, { withFileTypes: true }).map((entry) => entry.name)) {
  const sourcePath = path.join(distDir, name);

  if (name === 'assets' || name === 'index.html' || name === 'favicon.ico') {
    continue;
  }

  cpSync(sourcePath, path.join(targetHtdocs, name), { recursive: true });
}

console.log('[deploy] Deploy completato con successo.');