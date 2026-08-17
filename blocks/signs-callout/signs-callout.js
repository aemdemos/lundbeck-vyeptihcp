/**
 * signs-callout — a standalone filled teal stat callout (e.g. the patient-profiles
 * "82%" survey figure) that follows the icon-feature cards.
 *
 * Authored as a single-cell block (block → row → cell → paragraphs), so EDS
 * recognises it as a block. The decorator hoists the cell's paragraphs up to be
 * direct children of the block, so the scoped styles in signs-callout.css apply.
 * All presentation is handled in CSS.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  // Unwrap the row/cell: move the innermost cell's children up to the block.
  const cell = block.querySelector(':scope > div > div') || block.querySelector(':scope > div');
  if (cell) {
    block.replaceChildren(...cell.childNodes);
  }
  block.setAttribute('role', 'note');
}
