/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns. Base: columns (blocks/columns).
 * Source: https://www.vyeptihcp.com/efficacy-and-patient-outcomes
 *
 * EDS "columns" convention: 2+ column table; row 1 = block name (+ variant);
 * subsequent rows each have the same column count; cells map left→right to the
 * rendered columns and hold text/images/inline elements. This parser follows it,
 * emitting a single 2-cell row per instance.
 *
 * Handles the TWO efficacy columns instances (single element in, branch by class):
 *
 * (a) Product dose callout  — `.teaser.dose-100mg .cmp-teaser`
 *     image left (VYEPTI packaging <img>) + dose text right (with <sup>1</sup>).
 *     Emitted as base "Columns": one row, two cells [ image ][ text ].
 *
 * (b) Arrow-navigation CTA band — `div.arrow-navigation #container-9fd6cb2014`
 *     two arrow links: "See how VYEPTI works" (/why-iv-infusion) and
 *     "Review safety & tolerability" (/safety-and-tolerability). Each teaser
 *     column carries a duplicated description link + an action-link with an arrow
 *     <img>; we keep one clean link per column. Emitted as the "arrow-nav" variant:
 *     one row, two cells [ link ][ link ].
 */

/**
 * Build the product dose callout (instance a) as a 2-column columns row.
 * @param {Element} element the .cmp-teaser element
 * @param {Document} document
 */
function parseDoseCallout(element, document) {
  // ── Image cell ──
  const imageCell = [];
  const imageWrap = element.querySelector('.cmp-teaser__image');
  const figure = (imageWrap || element).querySelector('picture, img');
  if (figure) imageCell.push(figure);

  // ── Text cell ──
  const textCell = [];
  const description = element.querySelector('.cmp-teaser__description');
  if (description) {
    Array.from(description.children).forEach((child) => {
      if (child.textContent && child.textContent.trim()) textCell.push(child.cloneNode(true));
    });
    if (textCell.length === 0 && description.textContent.trim()) {
      textCell.push(description.cloneNode(true));
    }
  }

  if (imageCell.length === 0 && textCell.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [[
    imageCell.length ? imageCell : '',
    textCell.length ? textCell : '',
  ]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', cells });
  element.replaceWith(block);
}

/**
 * Build the arrow-navigation CTA band (instance b) as a 2-column columns row
 * with the "arrow-nav" variant.
 * @param {Element} element the #container-9fd6cb2014 element
 * @param {Document} document
 */
function parseArrowNav(element, document) {
  // Collect the teaser "columns". Two source shapes:
  //  - two-teaser band (efficacy, safety): a `.arrow-navigation` wrapper containing
  //    `.arrow-navigation__left-section` + `__right-section` (each a .cmp-teaser).
  //  - single-teaser band (coverage-finder, infusion-locator): the mapped element IS the
  //    `.arrow-navigation__right-section` teaser itself.
  // Prefer the explicit section teasers; only if none exist fall back to .cmp-teaser, then
  // to the element itself (single-teaser pages where the element IS the teaser). Matching
  // both section + inner .cmp-teaser at once would double-count columns, so try in order.
  let teasers = Array.from(element.querySelectorAll(
    '.arrow-navigation__left-section, .arrow-navigation__right-section',
  ));
  if (teasers.length === 0) teasers = Array.from(element.querySelectorAll('.cmp-teaser'));
  if (teasers.length === 0) teasers = [element];

  const rowCells = [];
  teasers.forEach((teaser) => {
    // A cell is a plain array of nodes (matching parseDoseCallout's imageCell/textCell shape).
    const cellNodes = [];
    // CTA prompt heading, if any.
    const heading = teaser.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.textContent.trim()) cellNodes.push(heading.cloneNode(true));
    // The CTA link: prefer action-link, then description link, then ANY link in the teaser.
    const src = teaser.querySelector('.cmp-teaser__action-link')
      || teaser.querySelector('.cmp-teaser__description a[href]')
      || teaser.querySelector('a[href]');
    if (src) {
      const link = document.createElement('a');
      link.href = src.getAttribute('href') || '#';
      if (src.getAttribute('target')) link.setAttribute('target', src.getAttribute('target'));
      link.textContent = src.textContent.replace(/\s+/g, ' ').trim();
      const p = document.createElement('p');
      p.append(link);
      cellNodes.push(p);
    }
    if (cellNodes.length) rowCells.push(cellNodes);
  });

  if (rowCells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [rowCells];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns (arrow-nav)', cells });
  element.replaceWith(block);
}

export default function parse(element, { document }) {
  // Branch on which instance this element is. True when the element is (or is inside) an
  // arrow-navigation band, or is itself an arrow-navigation section teaser.
  const isArrowNav = !!(
    element.closest('.arrow-navigation, .coverage-footer-navigation')
    || element.matches('.arrow-navigation__left-section, .arrow-navigation__right-section')
    || element.querySelector('.arrow-navigation__left-section, .arrow-navigation__right-section')
    || (element.id && element.id === 'container-9fd6cb2014')
  );

  if (isArrowNav) {
    parseArrowNav(element, document);
    return;
  }

  // Default / dose-100mg product callout.
  parseDoseCallout(element, document);
}
