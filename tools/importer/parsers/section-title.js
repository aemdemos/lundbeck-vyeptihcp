/* eslint-disable */
/* global WebImporter */
/**
 * Parser for section-title. Base: section-title (blocks/section-title).
 * Source: https://www.vyeptihcp.com/efficacy-and-patient-outcomes
 *
 * Source is an AEM cmp-title: a single centered heading
 *   <div class="cmp-title"><h2 class="cmp-title__text">VYEPTI pivotal trial data</h2></div>
 *
 * The section-title block (blocks/section-title/section-title.js) reads its title
 * from the heading found in the first row's value column (readTitleFromRows →
 * getHeadingFromCell). So the authored contract here is the simplest form:
 *   Row 1: block name  ->  "section-title"
 *   Row 2: a single cell holding the heading element (h2).
 * The block preserves the heading tag/level and text; no size/alignment/subtitle
 * rows are emitted (styling is handled by the block + section defaults).
 */
export default function parse(element, { document }) {
  // The heading is the cmp-title text; fall back to any heading within the element.
  // The mapped selector may resolve to the wrapper (#title-…) OR directly to the
  // heading (h2.cmp-title__text) — handle both.
  let heading = element.querySelector('.cmp-title__text, h1, h2, h3, h4, h5, h6');
  if (!heading && /^h[1-6]$/i.test(element.tagName)) {
    heading = element;
  }

  // Empty-block guard.
  if (!heading) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Clone the heading: the mapped selector may resolve directly to the heading
  // (element === heading), in which case placing `heading` inside the new block and
  // then element.replaceWith(block) would insert element into its own descendant
  // ("new child contains the parent"). Cloning breaks that cycle and is safe for the
  // wrapper case too.
  const headingClone = heading.cloneNode(true);

  // Single-column block: one row, one cell holding the heading.
  const cells = [[[headingClone]]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'section-title', cells });
  element.replaceWith(block);
}
