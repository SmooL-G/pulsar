/**
 * Headless project generator for Bubblewrap.
 *
 * `bubblewrap init` is interactive and asks ~15 questions even when
 * twa-manifest.json contains every answer. This script invokes the
 * underlying library directly so CI can generate the Android project
 * without any prompts.
 */
import { TwaGenerator, TwaManifest } from '@bubblewrap/core';
import { promises as fs } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;
const repoRoot = resolve(projectDir, '..');
const manifestPath = resolve(projectDir, 'twa-manifest.json');

console.log(`[gen] loading ${manifestPath}`);
const manifest = await TwaManifest.fromFile(manifestPath);

// Override icon URLs to use the icons checked into the repo. The
// twa-manifest.json points at github raw URLs for documentation, but
// the repo is private so anonymous fetch returns 404 in CI. Resolving
// to file:// against the local checkout sidesteps the network entirely.
const iconsDir = resolve(repoRoot, 'apps/web/public/icons');
const localIcon = (name) => pathToFileURL(resolve(iconsDir, name)).toString();
manifest.iconUrl = localIcon('icon-512.png');
manifest.maskableIconUrl = localIcon('icon-maskable-512.png');
manifest.monochromeIconUrl = localIcon('icon-512.png');
console.log(`[gen] using local icons from ${iconsDir}`);

console.log(`[gen] generating Android project into ${projectDir}`);
const generator = new TwaGenerator();
await generator.createTwaProject(projectDir, manifest, console);

console.log('[gen] done — gradle project ready, run `bubblewrap build` next');
