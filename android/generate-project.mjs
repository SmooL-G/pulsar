/**
 * Headless project generator for Bubblewrap.
 *
 * `bubblewrap init` is interactive. We invoke @bubblewrap/core directly,
 * but TwaGenerator still does a few HTTPS fetches against the manifest's
 * URL fields. The host (pulsar-chat.fun) is unreachable from GitHub
 * runners (RU↔Azure routing), so we serve everything bubblewrap might
 * fetch from a loopback HTTP server.
 */
import { TwaGenerator, TwaManifest } from '@bubblewrap/core';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import dns from 'node:dns';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;
const repoRoot = resolve(projectDir, '..');
const manifestPath = resolve(projectDir, 'twa-manifest.json');

// Diagnostic: log every DNS lookup so we can see what hostname is
// being resolved (= what's being fetched). Helps identify any URL we
// missed when overriding manifest fields.
const originalLookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  console.log(`[dns-lookup] ${hostname}`);
  return originalLookup.call(dns, hostname, ...args);
};

const iconsDir = resolve(repoRoot, 'apps/web/public/icons');
const webPublicDir = resolve(repoRoot, 'apps/web/public');

const server = createServer(async (req, res) => {
  console.log(`[icon-server] ${req.method} ${req.url}`);
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;

    // Icons live under /icons/<file>.png OR are addressed at /<file>.png
    // depending on how we built the URL. Handle both.
    const fileName = basename(path);

    if (path.startsWith('/icons/') || /^\/icon-\d+\.png$/.test(path) || path.includes('icon-maskable')) {
      const buf = await fs.readFile(resolve(iconsDir, fileName));
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': buf.length });
      res.end(buf);
      return;
    }

    // Mirror the live PWA manifest so bubblewrap can fetch it without
    // touching the prod host.
    if (path === '/manifest.webmanifest') {
      const buf = await fs.readFile(resolve(webPublicDir, 'manifest.webmanifest'));
      res.writeHead(200, { 'content-type': 'application/manifest+json', 'content-length': buf.length });
      res.end(buf);
      return;
    }

    if (path === '/.well-known/assetlinks.json') {
      const buf = await fs.readFile(resolve(webPublicDir, '.well-known/assetlinks.json'));
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': buf.length });
      res.end(buf);
      return;
    }

    res.writeHead(404).end('not found');
  } catch (err) {
    console.error(`[icon-server] error serving ${req.url}:`, err);
    res.writeHead(500).end(String(err));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`[gen] loopback server listening on ${base}`);

try {
  console.log(`[gen] loading ${manifestPath}`);
  const manifest = await TwaManifest.fromFile(manifestPath);

  manifest.iconUrl = `${base}/icons/icon-512.png`;
  manifest.maskableIconUrl = `${base}/icons/icon-maskable-512.png`;
  manifest.monochromeIconUrl = `${base}/icons/icon-512.png`;
  manifest.webManifestUrl = `${base}/manifest.webmanifest`;

  console.log('[gen] manifest URL fields after override:', {
    iconUrl: manifest.iconUrl,
    maskableIconUrl: manifest.maskableIconUrl,
    monochromeIconUrl: manifest.monochromeIconUrl,
    webManifestUrl: manifest.webManifestUrl,
    host: manifest.host,
    fullScopeUrl: manifest.fullScopeUrl,
    startUrl: manifest.startUrl,
  });

  console.log(`[gen] generating Android project into ${projectDir}`);
  const generator = new TwaGenerator();
  await generator.createTwaProject(projectDir, manifest, console);

  console.log('[gen] done — gradle project ready');
  process.exit(0);
} catch (err) {
  console.error('[gen] error:', err);
  process.exit(1);
}
