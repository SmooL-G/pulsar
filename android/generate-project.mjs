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
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;
const manifestPath = resolve(projectDir, 'twa-manifest.json');

console.log(`[gen] loading ${manifestPath}`);
const manifest = await TwaManifest.fromFile(manifestPath);

console.log(`[gen] generating Android project into ${projectDir}`);
const generator = new TwaGenerator();
await generator.createTwaProject(projectDir, manifest, console);

console.log('[gen] done — gradle project ready, run `bubblewrap build` next');
