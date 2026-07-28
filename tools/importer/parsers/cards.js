/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards. Base: cards (blocks/cards).
 * Source: https://www.vyeptihcp.com/copay-support (downloadable-resources tiles).
 *
 * EDS `cards` convention: 2-column table, each ROW = one card — cell 1 = image/icon
 * (mandatory), cell 2 = text content (optional heading + description + call-to-action link).
 * blocks/card/card.js treats an image-only cell as the card image and the other as the body.
 * Source "resources" tiles = <img class="resources-icon"> + a cmp-button PDF download link
 * (sometimes with a heading/label). We emit one 2-cell row per tile: [icon][heading + link].
 */
export default function parse(element, { document }) {
  const icons = [...element.querySelectorAll('img.resources-icon, img[class*="resources-icon"]')];

  let tiles = [];
  if (icons.length) {
    tiles = icons.map((img) => img.closest('.aem-GridColumn, .cmp-container, div')).filter(Boolean);
  } else {
    tiles = [...element.querySelectorAll(':scope .cmp-button')]
      .map((a) => a.closest('.aem-GridColumn, div')).filter(Boolean);
  }
  const uniqueTiles = [...new Set(tiles)];

  const cells = [];
  uniqueTiles.forEach((tile) => {
    const img = tile.querySelector('img');
    const link = tile.querySelector('a[href]');
    const imageCell = [];
    if (img) imageCell.push(img.closest('picture') || img);
    const bodyCell = [];
    tile.querySelectorAll('h1,h2,h3,h4,h5,h6,p').forEach((n) => {
      if (n.textContent.trim() && !n.querySelector('img')) bodyCell.push(n.cloneNode(true));
    });
    if (link) {
      const a = document.createElement('a');
      a.setAttribute('href', link.getAttribute('href'));
      if (link.getAttribute('target')) a.setAttribute('target', link.getAttribute('target'));
      a.textContent = link.textContent.replace(/\s+/g, ' ').trim() || 'Download';
      bodyCell.push(a);
    }
    if (imageCell.length || bodyCell.length) {
      // Each cell is a plain array of nodes — createBlock accepts node / node[] / string per
      // cell. The `{ elems }` wrapper is only understood by buildBlock (it stringifies to
      // "[object Object]" through createBlock).
      cells.push([imageCell, bodyCell]);
    }
  });

  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards', cells });
  element.replaceWith(block);
}
