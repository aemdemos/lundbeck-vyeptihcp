/* eslint-disable */
/* global WebImporter */
/**
 * Parser for signup-form. Base: signup-form (blocks/signup-form).
 * Source: https://www.vyeptihcp.com/sign-up
 *
 * The lead-capture form's DOM + behavior are reproduced by the block itself (it injects the
 * source form markup and loads the vendor site clientlibs). The parser therefore only needs
 * to emit the block with an optional origin row (the origin that serves the clientlibs +
 * registration API). We capture it from the source form's data-submit host so it is not
 * hard-coded downstream; the block falls back to the prod HCP origin if omitted.
 *
 * Emits a 1-row, 1-column block whose single cell is the origin (e.g. https://www.vyeptihcp.com).
 */
export default function parse(element, { document }) {
  const form = element.querySelector('form[data-submit], #signupForm');
  let origin = '';
  const submit = form && form.getAttribute('data-submit');
  if (submit) {
    try { origin = new URL(submit).origin; } catch (e) { origin = ''; }
  }

  const cell = document.createElement('div');
  cell.textContent = origin;

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'signup-form',
    cells: [[cell]],
  });
  element.replaceWith(block);
}
