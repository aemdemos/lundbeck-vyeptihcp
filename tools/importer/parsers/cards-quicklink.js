/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-quicklink. Base: cards.
 * Source: https://vyeptihcp-stage.d.lundbeckus.com/
 *
 * Homepage hero quick-link strip: 4 cards, each an icon image (linked) + a
 * linked heading (h5) + an arrow link. The arrow repeats the card destination,
 * so it is folded away (not duplicated) — the heading link carries the link.
 *
 * Emits the 2-column cards structure:
 *   Row per card: [ image cell ] [ body cell: linked heading ]
 */
export default function parse(element, { document }) {
  // Cards are nested: banner-content > columncontainer > container > row > col-* > .teaser.
  // Select every teaser that carries a card body (excludes the heading RTE column).
  const cards = Array.from(element.querySelectorAll('.teaser')).filter(
    (t) => t.querySelector('.cmp-teaser__description') || t.querySelector('.cmp-teaser__image'),
  );

  const cells = [];
  cards.forEach((card) => {
    // Image cell: the icon (unwrap its anchor so the card image is a plain image).
    const img = card.querySelector('.cmp-teaser__image img, img');
    const imageCell = img || '';

    // Body cell: the heading (contains the linked title).
    const heading = card.querySelector('.cmp-teaser__description h1, .cmp-teaser__description h2, .cmp-teaser__description h3, .cmp-teaser__description h4, .cmp-teaser__description h5, .cmp-teaser__description h6, h1, h2, h3, h4, h5, h6');

    const bodyCell = [];
    if (heading) bodyCell.push(heading);

    // Only emit a row if it has real content.
    if (img || bodyCell.length) {
      cells.push([imageCell, bodyCell.length ? bodyCell : '']);
    }
  });

  // Empty-block guard.
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards (quicklink)', cells });
  element.replaceWith(block);
}
