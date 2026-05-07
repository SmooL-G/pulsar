/**
 * Headless project generator for Bubblewrap.
 *
 * `bubblewrap init` is interactive and asks ~15 questions even when
 * twa-manifest.json contains every answer. This script invokes the
 * underlying library directly so CI can generate the Android project
 * without any prompts.
 */
import { TwaGenerator, TwaManifest } from '@bubblewrap/core';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;
const repoRoot = resolve(projectDir, '..');
const manifestPath = resolve(projectDir, 'twa-manifest.json');

// fetch-h2 (used by @bubblewrap/core) refuses file:// URLs, and the
// public PWA host can be unreachable from CI. So we serve the icons
// from a local Node http server on a random loopback port for the
// duration of project generation.
const iconsDir = resolve(repoRoot, 'apps/web/public/icons');
const allowedIcons = new Set([
  'icon-512.png',
  'icon-maskable-512.png',
  'icon-256.png',
  'icon-384.png',
  'icon-192.png',
  'icon-maskable-192.png',
]);

const server = createServer(async (req, res) => {
  try {
    const name = basename(new URL(req.url, 'http://x').pathname);
    if (!allowedIcons.has(name)) {
      res.writeHead(404).end('not found');
      return;
    }
    const buf = await fs.readFile(resolve(iconsDir, name));
    res.writeHead(200, { 'content-type': 'image/png', 'content-length': buf.length });
    res.end(buf);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`[gen] icon server listening on ${base}`);

try {
  console.log(`[gen] loading ${manifestPath}`);
  const manifest = await TwaManifest.fromFile(manifestPath);

  manifest.iconUrl = `${base}/icon-512.png`;
  manifest.maskableIconUrl = `${base}/icon-maskable-512.png`;
  manifest.monochromeIconUrl = `${base}/icon-512.png`;
  console.log(`[gen] icons sourced from ${iconsDir}`);

  console.log(`[gen] generating Android project into ${projectDir}`);
  const generator = new TwaGenerator();
  await generator.createTwaProject(projectDir, manifest, console);

  console.log('[gen] done — gradle project ready');
  // fetch-h2 (used by bubblewrap) holds idle HTTP/2 connections in a
  // pool, so server.close() blocks indefinitely waiting for them. Force
  // exit — there's nothing else to do at this point.
  process.exit(0);
} catch (err) {
  console.error('[gen] error:', err);
  process.exit(1);
}
