/* eslint-disable */
/* global WebImporter */
/**
 * Parser for quote-kol. Base: quote-kol (blocks/quote-kol).
 * Source: https://www.vyeptihcp.com/efficacy-and-patient-outcomes
 *
 * Source is an AEM cmp-teaser holding a KOL (key opinion leader) quote:
 *   .cmp-teaser__image  -> physician headshot <picture>/<img>
 *   .cmp-teaser__title  -> the pull quotation (h2)
 *   .cmp-teaser__description -> <p><strong>Name</strong></p>
 *                              <p><em>Role | </em>affiliation…</p>
 *
 * The quote-kol block (blocks/quote-kol/quote-kol.js) authors rows in order:
 *   Row 1: [image]        (optional headshot)
 *   Row 2: [quotation]    (the pull quote)
 *   Row 3: [attribution]  (name in <strong>, role in <em> → block converts <em> to <cite>)
 * Single-column block: one cell per row.
 */
export default function parse(element, { document }) {
  const cells = [];

  // ── Row 1: headshot image (optional) ──
  const imageWrap = element.querySelector('.cmp-teaser__image');
  const figure = (imageWrap || element).querySelector('picture, img');
  if (figure) cells.push([[figure]]);

  // ── Row 2: the pull quotation ──
  const quoteEl = element.querySelector('.cmp-teaser__title');
  let quotation = null;
  if (quoteEl) {
    // Preserve as a paragraph so the block styles it as the quote body. Strip any
    // curly/straight quotation marks that wrap the source text — the quote-kol block
    // renders its own quote marks via CSS ::before/::after, so leaving the source
    // marks in place produces doubled quotes (““…””).
    quotation = document.createElement('p');
    quotation.textContent = quoteEl.textContent
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["“”]+/, '')
      .replace(/["“”]+$/, '')
      .trim();
  }
  if (quotation) cells.push([[quotation]]);

  // ── Row 3: attribution (name + em-wrapped role) ──
  const description = element.querySelector('.cmp-teaser__description');
  const attributionNodes = [];
  if (description) {
    Array.from(description.children).forEach((child) => {
      if (/^(P|DIV|SPAN)$/i.test(child.tagName) && child.textContent.trim()) {
        attributionNodes.push(child.cloneNode(true));
      }
    });
  }
  if (attributionNodes.length) cells.push([attributionNodes]);

  // ── Empty-block guard ──
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'quote-kol', cells });
  element.replaceWith(block);
}
