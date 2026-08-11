#!/usr/bin/env node
/*
 * Reproducible, non-destructive re-authoring of the Vyepti resources page.
 *
 * Converts ONLY the Guides / Forms / Letters resource links from stacked
 * <p><a> paragraphs into :download: icon-bullet lists (the syntax an author
 * would type). Leaves the hero, intro, webinar link, Contact-a-rep section,
 * ISI reference and metadata untouched.
 *
 * Usage: node tools/importer/reauthor-resources.js content/vyepti-resources.plain.html
 */
const fs = require('fs');

const path = process.argv[2];
if (!path) {
  console.error('Usage: node reauthor-resources.js <content-file>');
  process.exit(1);
}
let html = fs.readFileSync(path, 'utf8');

// Turn a run of `<p><a href="URL">TEXT</a></p>` into a :download: bullet list.
// TEXT never contains '<' for these resource links (verified), so [^<]+ is safe;
// the webinar <p> (which wraps a <picture>) never matches and is left alone.
function pLinksToBullets(seg, indent) {
  const pad = ' '.repeat(indent);
  return seg.replace(/(?:\s*<p><a href="[^"]+">[^<]+<\/a><\/p>)+/g, (run) => {
    const items = [...run.matchAll(/<p><a href="([^"]+)">([^<]+)<\/a><\/p>/g)]
      .map((m) => `${pad}  <li>:download: <a href="${m[1]}">${m[2]}</a></li>`)
      .join('\n');
    return `\n${pad}<ul>\n${items}\n${pad}</ul>`;
  });
}

// Guides: keep the two-column columns(resource-list) block; bullet-ise each cell.
html = html.replace(
  /(columns\(resource-list\)<\/td><\/tr>\s*<tr>)([\s\S]*?)(<\/tr>\s*<\/table>)/,
  (m, open, row, close) => {
    const newRow = row.replace(
      /<td>([\s\S]*?)<\/td>/g,
      (c, inner) => `<td>${pLinksToBullets(inner, 12)}\n          </td>`,
    );
    return open + newRow + close;
  },
);

// Forms + Letters: single flat lists.
html = html.replace(
  /(<h3>Forms<\/h3>)([\s\S]*?)(\s*<\/div>)/,
  (m, h, body, end) => h + pLinksToBullets(body, 6) + end,
);
html = html.replace(
  /(<h3>Letters<\/h3>)([\s\S]*?)(\s*<\/div>)/,
  (m, h, body, end) => h + pLinksToBullets(body, 6) + end,
);

fs.writeFileSync(path, html);
console.log('re-authored:', path);
