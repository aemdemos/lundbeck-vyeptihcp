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
  // Each teaser column exposes its CTA both as a description link and an
  // action-link (with a trailing arrow <img>). Take the action-link per teaser
  // and normalise it to a clean text link so no duplicate/arrow-image noise.
  const teasers = Array.from(element.querySelectorAll('.cmp-teaser'));
  const rowCells = [];
  teasers.forEach((teaser) => {
    const src = teaser.querySelector('.cmp-teaser__action-link, .cmp-teaser__description a, a[href]');
    if (!src) {
      rowCells.push('');
      return;
    }
    const link = document.createElement('a');
    link.href = src.getAttribute('href') || '#';
    if (src.getAttribute('target')) link.setAttribute('target', src.getAttribute('target'));
    link.textContent = src.textContent.replace(/\s+/g, ' ').trim();
    const p = document.createElement('p');
    p.append(link);
    rowCells.push([p]);
  });

  if (rowCells.length === 0 || rowCells.every((c) => c === '')) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [rowCells];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns (arrow-nav)', cells });
  element.replaceWith(block);
}

export default function parse(element, { document }) {
  // Branch on which instance this element is.
  const isArrowNav = !!(
    element.closest('.arrow-navigation')
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
