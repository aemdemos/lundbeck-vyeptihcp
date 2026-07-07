/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: vyeptihcp section boundaries + section metadata.
 *
 * Establishes EDS section breaks (<hr>) and Section Metadata blocks from
 * payload.template.sections. Each section entry's `selector` points at the
 * FIRST element of that section; the section runs until the next section's
 * first element. A single entry can therefore span multiple blocks (e.g. the
 * "light" section = promo cards + all three teaser-cta columns).
 *
 * Rules:
 *  - Insert an <hr> before each section's first element EXCEPT the first listed
 *    section, which begins the page (no leading section needed). <hr> serializes to
 *    a thematic break regardless of DOM nesting depth, so cross-parent starts work.
 *  - For every section with a `style`, place a Section Metadata block at the END
 *    of that section — i.e. immediately before the NEXT section's <hr> (or, for the
 *    last section, at the end of main). Section Metadata applies to its whole
 *    containing section, so one block covers a multi-block section.
 *  - Banner (hero) sections declare a `backgroundImage` selector. The image is
 *    LIFTED out of the inline flow into a `background-image` row of that section's
 *    metadata (scripts.js applySectionBackgroundDecorations renders it as a
 *    .bg-image layer). This replaces the retired `hero` block.
 *
 * All section selectors come from page-templates.json, derived from the captured
 * DOM in migration-work/cleaned.html.
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  // Run BEFORE block parsers: the section selectors point at the exact elements
  // that block parsers replaceWith() their block divs. Inserting <hr>/metadata
  // as siblings first means replaceWith preserves them; running afterTransform
  // would find nothing because the source elements are already gone.
  if (hookName !== TransformHook.beforeTransform) return;

  const sections = payload && payload.template && payload.template.sections;
  if (!Array.isArray(sections) || sections.length < 2) return;

  const doc = element.ownerDocument;

  // Resolve each section's first element in document order.
  const resolved = [];
  sections.forEach((section) => {
    if (!section || !section.selector) return;
    const el = element.querySelector(section.selector);
    if (el) resolved.push({ section, el });
  });

  // Pass 1: insert an <hr> before each section's first element EXCEPT the first
  // listed section (it begins the page). Reverse order so earlier element
  // references are not disturbed. Keep the hr for pass 2.
  for (let i = resolved.length - 1; i >= 1; i -= 1) {
    const hr = doc.createElement('hr');
    resolved[i].el.parentNode.insertBefore(hr, resolved[i].el);
    resolved[i].hr = hr;
  }

  // Pass 2: place each styled section's metadata at the END of its section — just
  // before the NEXT section's <hr>. The last section appends to the end of main.
  resolved.forEach(({ section }, i) => {
    // Resolve an optional background image to lift into this section's metadata.
    let bgImageEl = null;
    if (section.backgroundImage) {
      const bgSource = element.querySelector(section.backgroundImage);
      if (bgSource) {
        // Prefer <img> (readBlockConfig reads a single img src for background-image).
        bgImageEl = bgSource.matches('img') ? bgSource : bgSource.querySelector('img');
      }
    }

    // Nothing to author for a section with neither a style nor a background image.
    if (!section.style && !bgImageEl) return;

    // Build the Section Metadata table rows.
    const rows = [];
    if (section.style) rows.push(['Style', section.style]);
    if (bgImageEl) {
      // Move the image node out of the inline flow into the metadata cell so it is
      // not also rendered as inline content.
      rows.push(['background-image', bgImageEl]);
    }

    const meta = WebImporter.Blocks.createBlock(doc, {
      name: 'Section Metadata',
      cells: rows,
    });

    const next = resolved[i + 1];
    if (next && next.hr) {
      next.hr.parentNode.insertBefore(meta, next.hr);
    } else {
      element.appendChild(meta);
    }
  });
}
