/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-teaser-cta. Base: columns.
 * Source: https://vyeptihcp-stage.d.lundbeckus.com/
 *
 * Homepage image + text call-to-action rows. Three instances with two DOM
 * shapes; this parser normalises BOTH into a consistent 2-column columns block:
 *   Single row: [ image cell ] [ text cell ]
 *   text cell = heading + paragraphs/list + CTA link + optional footnote.
 *
 * Shape A (instances 1 & 3): div.teaser.image-teaser-cta with
 *   .cmp-teaser__image, .cmp-teaser__description, .cmp-teaser__action-container.
 *   Instance 3 also carries a .cmp-teaser__description__secondary fine-print
 *   footnote nested in the action container.
 * Shape B (instance 2): .coverage-finder-section-two with a .coverage-finder-image
 *   (image + illustrative .cmp-image__title caption) and .coverage-finder-text
 *   (.cmp-teaser__description + .cmp-teaser__action-container).
 *
 * Image-left vs image-right: instances with the `toggle--right` class render the
 * image on the right. That order is preserved by emitting the text cell first and
 * the image cell second for those instances.
 */
export default function parse(element, { document }) {
  const imageRight = element.classList.contains('toggle--right');

  // ── Image cell ────────────────────────────────────────────────
  const imageCell = [];
  // Shape B keeps the image + caption in .coverage-finder-image; Shape A uses
  // .cmp-teaser__image. Fall back to any image within the element.
  const imageWrap = element.querySelector('.coverage-finder-image, .cmp-teaser__image');
  const img = (imageWrap || element).querySelector('img');
  if (img) imageCell.push(img);
  // Illustrative caption (Shape B only).
  const caption = element.querySelector('.cmp-image__title');
  if (caption) {
    const capP = document.createElement('p');
    capP.append(...caption.childNodes.length ? [...caption.childNodes] : [document.createTextNode(caption.textContent)]);
    imageCell.push(capP);
  }

  // ── Text cell ─────────────────────────────────────────────────
  const textCell = [];
  // Description block holds heading + intro paragraph(s) + optional list.
  const description = element.querySelector('.coverage-finder-text .cmp-teaser__description, .cmp-teaser__content .cmp-teaser__description, .cmp-teaser__description');
  if (description) {
    // Pull the meaningful children (headings, paragraphs, lists) but skip any
    // nested secondary footnote wrapper — handled separately below.
    Array.from(description.children).forEach((child) => {
      if (!child.classList.contains('cmp-teaser__description__secondary')) {
        textCell.push(child);
      }
    });
  }

  // Primary CTA (the action link, excluding the nested footnote block).
  const actionContainer = element.querySelector('.coverage-finder-text .cmp-teaser__action-container, .cmp-teaser__content .cmp-teaser__action-container, .cmp-teaser__action-container');
  let cta = null;
  if (actionContainer) {
    cta = actionContainer.querySelector(':scope > a.cmp-teaser__action-link, :scope > a');
  }
  if (!cta) {
    cta = element.querySelector('a.cmp-teaser__action-link');
  }
  if (cta) {
    // Wrap the CTA in <p><strong> so scripts.js decorateButtons() promotes it to a
    // primary (rose pill) button — matching the source's filled pill CTAs. The link
    // text is normalised (source appends stray whitespace/arrow markup).
    const ctaP = document.createElement('p');
    const strong = document.createElement('strong');
    const ctaLink = document.createElement('a');
    ctaLink.href = cta.getAttribute('href') || '#';
    if (cta.getAttribute('target')) ctaLink.setAttribute('target', cta.getAttribute('target'));
    ctaLink.textContent = cta.textContent.trim();
    strong.append(ctaLink);
    ctaP.append(strong);
    textCell.push(ctaP);
  }

  // Optional fine-print footnote (.cmp-teaser__description__secondary — instance 3).
  const footnote = element.querySelector('.cmp-teaser__description__secondary');
  if (footnote) {
    Array.from(footnote.children).forEach((child) => textCell.push(child));
  }

  // ── Empty-block guard ─────────────────────────────────────────
  if (imageCell.length === 0 && textCell.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // ── Assemble the single columns row in visual order ───────────
  // Place cells directly in the left→right order they render on the source:
  // image-right instances emit [text, image]; otherwise [image, text].
  // No toggle class — the authored table order IS the layout.
  const imgCellOut = imageCell.length ? imageCell : '';
  const txtCellOut = textCell.length ? textCell : '';
  const cells = [imageRight ? [txtCellOut, imgCellOut] : [imgCellOut, txtCellOut]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns (teaser-cta)', cells });
  element.replaceWith(block);
}
