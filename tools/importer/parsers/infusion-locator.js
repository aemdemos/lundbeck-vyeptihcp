/* eslint-disable */
/* global WebImporter */
/**
 * Parser for infusion-locator. Base: infusion-locator (blocks/infusion-locator).
 * Source: https://www.vyeptihcp.com/infusion-locator
 *
 * The locator is a Vue SPA wired by an AEM PICL clientlib + Google Maps JS API; it is neither
 * an iframe nor a self-registering custom element. The block reproduces the source config
 * markup + x-templates and loads the clientlibs/Maps API to mount the app. The parser only
 * needs to emit the block with the vendor origin (serves the clientlib + /api/picllocator)
 * and the Google Maps API key, captured from the source so they are not hard-coded downstream.
 *
 * Emits a 2-row, 1-column block: row 1 = origin, row 2 = Google Maps API key.
 */
export default function parse(element, { document, params }) {
  // Origin: from the page URL (the clientlib + /api/picllocator are same-origin).
  let origin = '';
  const pageUrl = (params && params.originalURL) || (document && document.baseURI) || '';
  try { origin = new URL(pageUrl).origin; } catch (e) { origin = ''; }

  // Google Maps key: from the source maps.googleapis.com script src, if present.
  let mapsKey = '';
  const mapsScript = [...document.querySelectorAll('script[src*="maps.googleapis.com"]')]
    .map((s) => s.getAttribute('src'))
    .find(Boolean);
  if (mapsScript) {
    const m = mapsScript.match(/[?&]key=([^&]+)/);
    if (m) mapsKey = decodeURIComponent(m[1]);
  }

  const originCell = document.createElement('div');
  originCell.textContent = origin;
  const keyCell = document.createElement('div');
  keyCell.textContent = mapsKey;

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'infusion-locator',
    cells: [[originCell], [keyCell]],
  });
  element.replaceWith(block);
}
