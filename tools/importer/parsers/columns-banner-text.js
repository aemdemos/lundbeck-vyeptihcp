/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-banner-text. Base: columns.
 * Source: https://vyeptihcp-stage.d.lundbeckus.com/
 *
 * Hero banner sub-text: the small definition/footnote heading that sits in the
 * banner section (e.g. the H5 "*The vicious cycle is defined as..."). Wrapping it
 * in a single-cell Columns (banner-text) block — instead of leaving it as bare
 * default content — gives authors a styled container with more layout/typography
 * options for hero sub-copy across pages.
 *
 * Block table structure (matches the Columns convention):
 *   Row 1: block name + variant  ->  "Columns (banner-text)"
 *   Row 2: a single cell holding the heading (+ any sibling copy).
 */
export default function parse(element, { document }) {
  // Collect the meaningful content of the banner text column: the heading plus any
  // sibling paragraphs/lists. Fall back to the element's paragraph content.
  const cell = [];
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    const rte = heading.closest('.rteComponent, .rte') || heading.parentElement;
    const nodes = rte ? Array.from(rte.children) : [heading];
    nodes.forEach((n) => {
      if (/^(H[1-6]|P|UL|OL)$/.test(n.tagName)) cell.push(n);
    });
    if (cell.length === 0) cell.push(heading);
  } else {
    Array.from(element.querySelectorAll('p')).forEach((p) => cell.push(p));
  }

  // Empty-block guard.
  if (cell.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // One row, one cell => a single-column columns block.
  const block = WebImporter.Blocks.createBlock(document, {
    name: 'Columns (banner-text)',
    cells: [[cell]],
  });
  element.replaceWith(block);
}
