import { exec } from "node:child_process";

const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  }
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// check if there are any model files staged (underscore-prefixed .json or ue/models/*.json)
const modifiedPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*\.json|^ue\/models\/.*\.json/));
if (modifiedPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

const THEME_PARTIAL = /^blocks\/[^/]+\/th-([a-z0-9-]+)-[a-z0-9-]+\.css$/i;
const modifiedThemePartials = modifiedFiles.filter((file) => file.match(THEME_PARTIAL));
if (modifiedThemePartials.length > 0) {
  const sites = [...new Set(
    modifiedThemePartials.map((file) => file.match(THEME_PARTIAL)[1].toLowerCase()),
  )];
  const output = await run(`npm run build:themes -- ${sites.join(' ')} --silent`);
  console.log(output);
  const pathsLine = output.trim().split('\n').find((line) => line.startsWith('THEME_PATHS:'));
  if (pathsLine) {
    const paths = pathsLine.replace('THEME_PATHS:', '').trim();
    if (paths) {
      await run(`git add ${paths}`);
    }
  }
}
