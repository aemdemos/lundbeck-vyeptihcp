/* eslint-disable */
/* global WebImporter */
/**
 * Parser for accordion. Base: accordion (blocks/accordion).
 * Source: https://www.vyeptihcp.com/efficacy-and-patient-outcomes
 *
 * Source is an AEM cmp-accordion. Each accordion item is:
 *   <div class="cmp-accordion__item">
 *     <h3 class="cmp-accordion__header">
 *       <button …><span class="cmp-accordion__title">TITLE</span>…</button>
 *     </h3>
 *     <div class="cmp-accordion__panel">…body content…</div>
 *   </div>
 *
 * Block table structure (per library-description.txt — 2 columns, N rows):
 *   Row 1: block name  ->  "accordion"
 *   Row N: [ title cell (the header label) ][ body cell (the panel content) ]
 *
 * The efficacy accordions nest further accordions inside a panel (e.g. an
 * "Inclusion & exclusion criteria" accordion inside the PROMISE-2 study-design
 * panel). Nested cmp-accordions are re-emitted INLINE as nested `accordion`
 * block tables so the accordion contract holds recursively; all other body
 * content (text, images, teasers) is preserved as-is (images untouched).
 *
 * The target efficacy accordion (#tabs-b3c889fa96 .cmp-accordion →
 * #promise-study-design) has two top-level items:
 *   1. "PROMISE-2 study design & full clinical publication"
 *   2. "EPISODIC MIGRAINE (PROMISE-1)"
 */

/**
 * Build the ordered list of body nodes for one accordion panel. Any nested
 * cmp-accordion is replaced by a nested `accordion` block table (recursively);
 * everything else is preserved in document order.
 * @param {Element} panel the .cmp-accordion__panel element
 * @param {Document} document
 * @returns {Node[]}
 */
function buildAccordionPanelBody(panel, document) {
  const body = [];
  // The panel usually wraps its content in a container grid; walk the whole
  // subtree collecting meaningful leaf/content nodes while intercepting any
  // nested accordions. We do this by scanning direct-ish descendants: pull the
  // deepest content container and iterate its children.
  const nestedAccordions = Array.from(panel.querySelectorAll('.cmp-accordion'));

  if (nestedAccordions.length === 0) {
    // No nested accordion — keep the panel's rendered content verbatim.
    const content = panel.querySelector('.cmp-container, .cmp-text, .cmp-experiencefragment') || panel;
    Array.from(content.childNodes).forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE || (n.textContent && n.textContent.trim())) {
        body.push(n.cloneNode(true));
      }
    });
    return body;
  }

  // There is at least one nested accordion. Emit the panel content up to the
  // (first) nested accordion, then the nested accordion as a nested block, then
  // any trailing content. We locate the top-most nested accordion wrapper.
  const topNested = nestedAccordions.find(
    (a) => !nestedAccordions.some((other) => other !== a && other.contains(a)),
  ) || nestedAccordions[0];

  // Grab the content BEFORE the nested accordion: the graph-callout / text /
  // teaser that lives alongside it inside the panel. We collect every element
  // that is NOT the nested accordion (or its ancestor wrapper) and NOT inside it.
  const nestedWrapper = topNested.closest('.accordion.panelcontainer') || topNested;
  const contentRoot = nestedWrapper.parentElement || panel;
  Array.from(contentRoot.children).forEach((child) => {
    if (child === nestedWrapper || child.contains(topNested)) return;
    if (child.querySelector && child.querySelector('.cmp-accordion')) return;
    if (child.textContent && child.textContent.trim() || child.querySelector('img, picture')) {
      body.push(child.cloneNode(true));
    }
  });

  // Now the nested accordion, emitted as its own accordion block table.
  const nestedBlock = buildAccordionBlock(topNested, document);
  if (nestedBlock) body.push(nestedBlock);

  return body;
}

/**
 * Build a WebImporter accordion block table element from a cmp-accordion.
 * Processes only the accordion's DIRECT item children (deeper nesting is
 * handled recursively via buildAccordionPanelBody).
 * @param {Element} accordion the .cmp-accordion element
 * @param {Document} document
 * @returns {Element|null} a block table element, or null if no items
 */
function buildAccordionBlock(accordion, document) {
  // Direct item children only: an item nested deeper belongs to a nested
  // accordion and is emitted from within that accordion's own recursion.
  const items = Array.from(accordion.children).filter((c) => c.classList && c.classList.contains('cmp-accordion__item'));
  if (items.length === 0) return null;

  const cells = [];
  items.forEach((item) => {
    // ── Title cell ──
    const titleEl = item.querySelector('.cmp-accordion__title, .cmp-accordion__header, button');
    const titleP = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = (titleEl ? titleEl.textContent : '').replace(/\s+/g, ' ').trim();
    titleP.append(strong);

    // ── Body cell ──
    const panel = item.querySelector('.cmp-accordion__panel');
    const bodyNodes = panel ? buildAccordionPanelBody(panel, document) : [];

    cells.push([[titleP], bodyNodes.length ? bodyNodes : ['']]);
  });

  return WebImporter.Blocks.createBlock(document, { name: 'accordion', cells });
}

export default function parse(element, { document }) {
  // Empty-block guard.
  const hasItems = element.querySelector('.cmp-accordion__item');
  if (!hasItems) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = buildAccordionBlock(element, document);
  if (!block) {
    element.replaceWith(...element.childNodes);
    return;
  }
  element.replaceWith(block);
}
