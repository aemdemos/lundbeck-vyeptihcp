#!/usr/bin/env node
/*
 * Localize remote images in an imported content file to the DA media-da convention.
 *
 * For a given content/<page>.plain.html:
 *   1. Find every <img src> / <source srcset> pointing at an absolute http(s) URL.
 *   2. Skip known tracking/analytics pixels (bat.bing.com, doubleclick, demdex, etc.)
 *      and REMOVE their enclosing <picture> (or bare <img>) so no pixel ships.
 *   3. Download each real image into content/media-da/<page>/<slug>-<hash>.<ext>.
 *   4. Rewrite the reference to the local /media-da/<page>/... path.
 *
 * Filenames follow the existing repo convention: a slugified source basename plus an
 * 8-char hash (md5 of the source URL) for stability + de-duplication across re-imports.
 * Re-running is idempotent: already-local /media-da/ refs are left untouched, and a file
 * that already exists on disk is not re-downloaded.
 *
 * Usage:  node tools/importer/localize-images.js <page-slug>
 *   e.g.  node tools/importer/localize-images.js efficacy-and-patient-outcomes
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TRACKING_HOSTS = [
  'bat.bing.com', 'doubleclick.net', 'demdex.net', 'googleadservices.com',
  'px.deepintent.com', 'google-analytics.com', 'googletagmanager.com',
  'facebook.com/tr', 'adservice.google.com',
];

const page = process.argv[2];
if (!page) {
  console.error('Usage: node tools/importer/localize-images.js <page-slug>');
  process.exit(1);
}

const contentFile = path.resolve(`content/${page}.plain.html`);
if (!fs.existsSync(contentFile)) {
  console.error(`Content file not found: ${contentFile}`);
  process.exit(1);
}

const mediaDir = path.resolve(`content/media-da/${page}`);
fs.mkdirSync(mediaDir, { recursive: true });

let html = fs.readFileSync(contentFile, 'utf8');

const isTracking = (url) => TRACKING_HOSTS.some((h) => url.includes(h));

function slugify(basename) {
  return decodeURIComponent(basename)
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

function extOf(url) {
  const m = decodeURIComponent(url.split('?')[0]).match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : 'png';
}

// 1. Remove tracking pixels (whole <picture> wrapper, else bare <img>).
html = html.replace(/<picture>(?:(?!<\/picture>).)*?<\/picture>/gis, (block) => {
  const src = block.match(/(?:src|srcset)="([^"]+)"/i);
  return src && isTracking(src[1]) ? '' : block;
});
html = html.replace(/<img\b[^>]*?(?:src|srcset)="([^"]+)"[^>]*>/gi, (tag, url) => (isTracking(url) ? '' : tag));

// 2. Collect remote image URLs (absolute http[s], not already local, not tracking).
const urls = new Set();
for (const m of html.matchAll(/(?:src|srcset)="(https?:\/\/[^"]+)"/gi)) {
  const url = m[1].split(/\s+/)[0];
  if (!isTracking(url) && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url)) urls.add(url);
}
// Protocol-relative (//host/...) too.
for (const m of html.matchAll(/(?:src|srcset)="(\/\/[^"]+)"/gi)) {
  const url = `https:${m[1].split(/\s+/)[0]}`;
  if (!isTracking(url) && /\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url)) urls.add(url);
}

console.log(`Found ${urls.size} remote image(s) to localize for "${page}".`);

let localized = 0;
let downloaded = 0;
for (const url of urls) {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
  const base = slugify(path.basename(decodeURIComponent(url.split('?')[0])));
  const filename = `${base}-${hash}.${extOf(url)}`;
  const localPath = `/media-da/${page}/${filename}`;
  const diskPath = path.join(mediaDir, filename);

  if (!fs.existsSync(diskPath)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url);
      if (!res.ok) { console.warn(`  ✗ ${res.status} ${url}`); continue; }
      // eslint-disable-next-line no-await-in-loop
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(diskPath, buf);
      downloaded += 1;
    } catch (e) {
      console.warn(`  ✗ failed ${url}: ${e.message}`);
      continue;
    }
  }

  // Rewrite every occurrence of this URL (both https and protocol-relative forms).
  const variants = [url, url.replace(/^https:/, ''), url.replace(/^https:/, 'http:')];
  for (const v of variants) {
    html = html.split(`"${v}"`).join(`"${localPath}"`);
    html = html.split(`"${v} `).join(`"${localPath} `); // srcset with descriptor
  }
  localized += 1;
}

fs.writeFileSync(contentFile, html);
console.log(`✅ Localized ${localized} image(s) (${downloaded} downloaded) → content/media-da/${page}/`);
