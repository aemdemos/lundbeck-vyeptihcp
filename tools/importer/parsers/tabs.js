/* eslint-disable */
/* global WebImporter */
/**
 * Parser for tabs. Base: tabs (blocks/tabs).
 * Source: https://www.vyeptihcp.com/efficacy-and-patient-outcomes
 *
 * EDS "tabs" convention: 2-column table; row 1 = block name; each subsequent row
 * = one tab as [ Tab Label cell ][ Tab Content cell ]. This parser follows it.
 *
 * Source is an AEM cmp-tabs:
 *   <ol class="cmp-tabs__tablist"><li class="cmp-tabs__tab">LABEL</li>…</ol>
 *   <div class="cmp-tabs__tabpanel">…panel content…</div> (one per tab, in order)
 *
 * The efficacy tabs component has 4 tabs (labels verbatim):
 *   PRIMARY ENDPOINT / 75% FEWER MIGRAINE DAYS / FAST ONSET / REDUCTION IN ACUTE MED USE
 * Each panel contains one or more graph-callout sections (subhead, subtitle,
 * color legend, body copy, footnotes, composed chart <img>, brand callout)
 * interleaved with nested accordion(s) carrying study-design detail.
 *
 * Tabs have no aria-controls in source; tab[i] maps to panel[i] by DOM order.
 * Nested cmp-accordions within a panel are re-emitted INLINE as nested `accordion`
 * block tables (same structure as accordion.js) so the accordion contract holds;
 * this is required because the standalone `accordion` parser can never run on this
 * page (the tabs parser replaces #tabs-… before the accordion selector resolves).
 * All chart <img> and text are preserved; nothing is fabricated.
 */

/**
 * Build the ordered list of body nodes for one cmp-accordion panel. Nested
 * cmp-accordions are re-emitted as nested `accordion` block tables (recursively);
 * everything else is preserved in document order. Mirrors accordion.js.
 * @param {Element} panel the .cmp-accordion__panel element
 * @param {Document} document
 * @returns {Node[]}
 */
function buildAccordionPanelBody(panel, document) {
  const body = [];
  const nestedAccordions = Array.from(panel.querySelectorAll('.cmp-accordion'));

  if (nestedAccordions.length === 0) {
    const content = panel.querySelector('.cmp-container, .cmp-text, .cmp-experiencefragment') || panel;
    Array.from(content.childNodes).forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE || (n.textContent && n.textContent.trim())) {
        body.push(n.cloneNode(true));
      }
    });
    return body;
  }

  const topNested = nestedAccordions.find(
    (a) => !nestedAccordions.some((other) => other !== a && other.contains(a)),
  ) || nestedAccordions[0];

  const nestedWrapper = topNested.closest('.accordion.panelcontainer') || topNested;
  const contentRoot = nestedWrapper.parentElement || panel;
  Array.from(contentRoot.children).forEach((child) => {
    if (child === nestedWrapper || child.contains(topNested)) return;
    if (child.querySelector && child.querySelector('.cmp-accordion')) return;
    if ((child.textContent && child.textContent.trim()) || child.querySelector('img, picture')) {
      body.push(child.cloneNode(true));
    }
  });

  const nestedBlock = buildAccordionBlock(topNested, document);
  if (nestedBlock) body.push(nestedBlock);

  return body;
}

/**
 * Build a WebImporter accordion block table element from a cmp-accordion,
 * processing only DIRECT item children (deeper nesting handled recursively).
 * Mirrors accordion.js.
 * @param {Element} accordion the .cmp-accordion element
 * @param {Document} document
 * @returns {Element|null}
 */
function buildAccordionBlock(accordion, document) {
  const items = Array.from(accordion.children).filter((c) => c.classList && c.classList.contains('cmp-accordion__item'));
  if (items.length === 0) return null;

  const cells = [];
  items.forEach((item) => {
    const titleEl = item.querySelector('.cmp-accordion__title, .cmp-accordion__header, button');
    const titleP = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = (titleEl ? titleEl.textContent : '').replace(/\s+/g, ' ').trim();
    titleP.append(strong);

    const panel = item.querySelector('.cmp-accordion__panel');
    const bodyNodes = panel ? buildAccordionPanelBody(panel, document) : [];

    cells.push([[titleP], bodyNodes.length ? bodyNodes : ['']]);
  });

  return WebImporter.Blocks.createBlock(document, { name: 'accordion', cells });
}

/**
 * Build the content cell for one tab panel: walk the panel's grid columns in
 * document order, cloning graph-callouts / text / teasers verbatim and replacing
 * each top-level accordion column with a nested `accordion` block table.
 * @param {Element} panel the .cmp-tabs__tabpanel element
 * @param {Document} document
 * @returns {Node[]}
 */
function buildTabPanelCell(panel, document) {
  const cell = [];
  // The panel's content lives in the first inner cmp-container grid. Iterate its
  // direct GridColumn children so document order (graph-callout ↔ accordion) is
  // preserved.
  const grid = panel.querySelector('.cmp-container > .aem-Grid') || panel;
  const columns = Array.from(grid.children).filter(
    (c) => c.nodeType === Node.ELEMENT_NODE && c.classList.contains('aem-GridColumn'),
  );
  const iter = columns.length ? columns : Array.from(grid.children);

  iter.forEach((col) => {
    // A top-level accordion column → emit a nested accordion block table.
    const accordion = col.classList && col.classList.contains('accordion')
      ? col.querySelector(':scope > .cmp-accordion, .cmp-accordion')
      : null;
    if (accordion) {
      const block = buildAccordionBlock(accordion, document);
      if (block) cell.push(block);
      return;
    }
    // Any other column (graph-callout, text, teaser, experiencefragment) with
    // real content → clone verbatim to preserve headings, images, sup/em, links.
    if ((col.textContent && col.textContent.trim()) || col.querySelector('img, picture')) {
      cell.push(col.cloneNode(true));
    }
  });

  return cell;
}

export default function parse(element, { document }) {
  // Tab labels (in order).
  const tabs = Array.from(element.querySelectorAll('.cmp-tabs__tablist > .cmp-tabs__tab, ol.cmp-tabs__tablist li'));
  // Panels (in order) — mapped to tabs by DOM order (source has no aria-controls).
  const panels = Array.from(element.querySelectorAll(':scope > .cmp-tabs__tabpanel, .cmp-tabs__tabpanel'));

  // Empty-block guard.
  if (tabs.length === 0 || panels.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];
  tabs.forEach((tab, i) => {
    const label = (tab.textContent || '').replace(/\s+/g, ' ').trim();
    const panel = panels[i];
    const panelCell = panel ? buildTabPanelCell(panel, document) : [];
    cells.push([label, panelCell.length ? panelCell : ['']]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'tabs', cells });
  element.replaceWith(block);
}
