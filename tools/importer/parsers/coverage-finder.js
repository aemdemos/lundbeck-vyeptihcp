/* eslint-disable */
/* global WebImporter */
/**
 * Parser for coverage-finder. Base: coverage-finder (blocks/coverage-finder).
 * Source: https://www.vyeptihcp.com/coverage-finder
 *
 * The source renders the MMIT coverage tool as a self-registering web component:
 *   <coverage-finder id="coverageFinder" token="<JWT>"></coverage-finder>
 * defined by an AEM clientlib script. It has no iframe endpoint and the site blocks framing,
 * so we replicate the source by loading that vendor script and mounting the element (see
 * blocks/coverage-finder/coverage-finder.js).
 *
 * Emits a 2-row, 1-column block:
 *   Row 1: the vendor clientlib script URL (absolute)
 *   Row 2: the token attribute value from the source <coverage-finder> element
 */
const VENDOR_SCRIPT = 'https://www.vyeptihcp.com/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-coverage-finder.min.js';

export default function parse(element, { document }) {
  const el = element.querySelector('coverage-finder') || element.querySelector('[id="coverageFinder"]');
  const token = el ? (el.getAttribute('token') || '') : '';

  const scriptCell = document.createElement('div');
  scriptCell.textContent = VENDOR_SCRIPT;

  const tokenCell = document.createElement('div');
  tokenCell.textContent = token;

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'coverage-finder',
    cells: [[scriptCell], [tokenCell]],
  });
  element.replaceWith(block);
}
