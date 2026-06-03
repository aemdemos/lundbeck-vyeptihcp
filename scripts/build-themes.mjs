import {
  readdir, readFile, writeFile, unlink, stat,
} from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BLOCKS_DIR = join(ROOT, 'blocks');
const STYLES_DIR = join(ROOT, 'styles');
const SLUG_RE = /^[a-z0-9-]+$/;
const GIT_PATHS_MARKER = 'THEME_PATHS:';

/**
 * @param {string} file
 * @returns {{ site: string, block: string } | null}
 */
function parseThemeFileName(file) {
  if (!file.startsWith('th-') || !file.endsWith('.css')) return null;
  const base = file.slice(3, -4);
  const lastDash = base.lastIndexOf('-');
  if (lastDash <= 0) return null;
  const site = base.slice(0, lastDash).toLowerCase();
  const block = base.slice(lastDash + 1).toLowerCase();
  if (!SLUG_RE.test(site) || !SLUG_RE.test(block)) return null;
  return { site, block };
}

/**
 * @returns {Promise<Map<string, Array<{ block: string, path: string, content: string }>>>}
 */
async function collectThemeSources() {
  const bySite = new Map();
  let entries;
  try {
    entries = await readdir(BLOCKS_DIR, { withFileTypes: true });
  } catch {
    return bySite;
  }

  await Promise.all(entries.filter((e) => e.isDirectory()).map(async (dir) => {
    const blockName = dir.name;
    const blockPath = join(BLOCKS_DIR, blockName);
    const files = await readdir(blockPath);
    await Promise.all(files.map(async (file) => {
      const parsed = parseThemeFileName(file);
      if (!parsed) return;
      const { site, block: fileBlock } = parsed;
      if (fileBlock !== blockName.toLowerCase()) {
        // eslint-disable-next-line no-console
        console.warn(`Skipping ${relative(ROOT, join(blockPath, file))}: block name mismatch`);
        return;
      }
      const content = await readFile(join(blockPath, file), 'utf8');
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site).push({
        block: blockName,
        path: `blocks/${blockName}/${file}`,
        content: content.trimEnd(),
      });
    }));
  }));

  bySite.forEach((sources) => {
    sources.sort((a, b) => a.block.localeCompare(b.block));
  });
  return bySite;
}

/**
 * @param {string} site
 * @param {Array<{ block: string, path: string, content: string }>} sources
 */
function buildSiteCSS(site, sources) {
  const header = [
    `/* Theme overrides for ${site}. Auto-generated from block-level th-${site}-<blockname>.css sources — do not edit; regenerated on commit. */`,
    '',
  ].join('\n');

  if (sources.length === 0) return null;

  const sections = sources.map(({ path, content }) => [
    '',
    `/* Compiled from ${path} */`,
    '',
    content,
  ].join('\n'));

  return `${header}${sections.join('\n')}`;
}

/**
 * @param {string} site
 * @param {Array<{ block: string, path: string, content: string }>} sources
 * @returns {Promise<string|null>} git-relative path written or deleted
 */
async function buildSiteTheme(site, sources) {
  const outPath = join(STYLES_DIR, `th-${site}.css`);
  const gitPath = `styles/th-${site}.css`;

  if (sources.length === 0) {
    try {
      await stat(outPath);
      await unlink(outPath);
      return gitPath;
    } catch {
      return null;
    }
  }

  await writeFile(outPath, `${buildSiteCSS(site, sources)}\n`, 'utf8');
  return gitPath;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--silent');
  const allSources = await collectThemeSources();

  let targetSites;
  if (args.length > 0) {
    targetSites = args.map((s) => s.toLowerCase());
  } else {
    targetSites = [...allSources.keys()];
  }

  const touchedPaths = [];
  await Promise.all(targetSites.map(async (site) => {
    const sources = allSources.get(site) ?? [];
    const path = await buildSiteTheme(site, sources);
    if (path) touchedPaths.push(path);
  }));

  if (touchedPaths.length > 0) {
    const written = touchedPaths.filter((p) => {
      const site = p.replace('styles/th-', '').replace('.css', '');
      return (allSources.get(site) ?? []).length > 0;
    });
    const deleted = touchedPaths.filter((p) => !written.includes(p));
    written.forEach((p) => {
      // eslint-disable-next-line no-console
      console.log(`Wrote ${p}`);
    });
    deleted.forEach((p) => {
      // eslint-disable-next-line no-console
      console.log(`Deleted ${p}`);
    });
  }

  // Last line: space-separated git paths for pre-commit git add
  // eslint-disable-next-line no-console
  console.log(`${GIT_PATHS_MARKER}${touchedPaths.join(' ')}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
