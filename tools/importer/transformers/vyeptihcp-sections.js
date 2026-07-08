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
 *  - Banner (hero) sections declare a `backgroundImage` selector. ALL renditions of
 *    the source hero <picture> (every <source srcset> plus the <img> fallback) are
 *    extracted, de-duplicated, and stacked SMALLEST→LARGEST (mobile-first, one per
 *    line) into a `background-image` row of that section's metadata. The original
 *    source element is removed from inline flow. scripts.js
 *    applySectionBackgroundDecorations consumes the stacked renditions to build a
 *    responsive .bg-image layer. This replaces the retired `hero` block.
 *
 * All section selectors come from page-templates.json, derived from the captured
 * DOM in migration-work/cleaned.html.
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

/**
 * Parse a pixel width from a media condition (max-width/min-width/width). Returns
 * Infinity when there is no numeric width (e.g. the bare <img> fallback = largest).
 */
function mediaWidth(media) {
  if (!media) return Infinity;
  const m = media.match(/(?:max-width|min-width|width)\s*:\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : Infinity;
}

/**
 * Extract every unique image rendition from a source hero container (a <picture>
 * with <source srcset> variants + an <img> fallback, or a bare <img>). Returns an
 * array of fresh <img> elements ordered SMALLEST→LARGEST (mobile-first),
 * de-duplicated by URL (keeping the smallest width a URL appears at).
 */
function extractRenditionImgs(container, doc) {
  const picture = container.matches('picture') ? container : container.querySelector('picture');
  const fallbackImg = (picture && picture.querySelector('img'))
    || (container.matches('img') ? container : container.querySelector('img'));
  const alt = fallbackImg ? (fallbackImg.getAttribute('alt') || '') : '';

  // Collect { url, width } from each <source srcset> and the <img> fallback.
  const entries = [];
  const addEntry = (rawSrcset, media) => {
    if (!rawSrcset) return;
    // srcset may hold multiple candidates ("url 1x, url2 2x"); take each URL token.
    rawSrcset.split(',').forEach((candidate) => {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) entries.push({ url, width: mediaWidth(media) });
    });
  };

  if (picture) {
    picture.querySelectorAll('source').forEach((s) => addEntry(s.getAttribute('srcset'), s.getAttribute('media')));
    if (fallbackImg) entries.push({ url: fallbackImg.getAttribute('src'), width: Infinity });
  } else if (fallbackImg) {
    entries.push({ url: fallbackImg.getAttribute('src'), width: Infinity });
  }

  // De-duplicate by URL, keeping the smallest width each URL appears at.
  const byUrl = new Map();
  entries.forEach(({ url, width }) => {
    if (!url) return;
    if (!byUrl.has(url) || width < byUrl.get(url)) byUrl.set(url, width);
  });

  // Smallest width first (mobile-first). Build fresh <img> nodes.
  return [...byUrl.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([url]) => {
      const im = doc.createElement('img');
      im.setAttribute('src', url);
      if (alt) im.setAttribute('alt', alt);
      return im;
    });
}

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
    // Resolve optional background-image renditions to lift into this section's metadata.
    // We capture ALL renditions from the source <picture> (mobile→desktop), not just
    // the fallback, so the customer's full breakpoint set is preserved.
    let bgRenditions = [];
    if (section.backgroundImage) {
      const bgSource = element.querySelector(section.backgroundImage);
      if (bgSource) {
        bgRenditions = extractRenditionImgs(bgSource, doc);
        // Remove the original hero image from the inline flow — it now lives ONLY in
        // the section-metadata background-image cell (otherwise it would render both
        // at the top of the section AND as the background).
        bgSource.remove();
      }
    }

    // Nothing to author for a section with neither a style nor a background image.
    if (!section.style && bgRenditions.length === 0) return;

    // Build the Section Metadata table rows.
    const rows = [];
    if (section.style) rows.push(['Style', section.style]);
    if (bgRenditions.length > 0) {
      // Stack every rendition (smallest→largest) in the background-image cell, each
      // on its own line, so the smallest is first and the largest (desktop) is last.
      const cell = doc.createElement('div');
      bgRenditions.forEach((im) => {
        const p = doc.createElement('p');
        p.appendChild(im);
        cell.appendChild(p);
      });
      rows.push(['background-image', cell]);
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
