/* eslint-disable */
/* global WebImporter */
/**
 * Parser for embed. Base: embed (blocks/embed).
 * Source: vyeptihcp 3rd-party interactive tools (coverage-finder, infusion-locator, sign-up).
 *
 * EDS `embed` convention: a 1-column block whose (single) content row holds one cell with a
 * URL to the external content. blocks/embed/embed.js reads that <a href> and wraps it in an
 * <iframe> (getDefaultEmbed) for non-video/social URLs.
 *
 * These vyepti tools are live JS/API web components (e.g. MMIT <coverage-finder>, a Google-Maps
 * infusion locator, a lead-capture form) that cannot be reconstructed as static EDS blocks, so
 * per the migration directive they are embedded via that iframe. The scraped DOM has no
 * standalone widget iframe URL (the tool is injected by script), so the embed target defaults
 * to the live tool page itself (params.originalURL).
 *
 * Emits exactly one cell containing the URL anchor (matches the "single cell with a URL" convention).
 * NOTE (flagged for the styling/polish pass): if a dedicated embeddable widget endpoint is
 * discovered, swap the href to it to avoid embedding full site chrome.
 */
export default function parse(element, { document, params }) {
  // Brightcove video: source renders a <video-js> with data-account/player/video-id that the
  // Brightcove loader turns into a player. players.brightcove.com IS frameable, so build its
  // embeddable player URL and let the embed block iframe it.
  const bc = element.querySelector('video-js[data-account], [data-account][data-video-id]');
  let brightcove = '';
  if (bc) {
    const account = bc.getAttribute('data-account');
    const player = bc.getAttribute('data-player') || 'default';
    const videoId = bc.getAttribute('data-video-id');
    const embed = bc.getAttribute('data-embed') || 'default';
    if (account && videoId) {
      brightcove = `https://players.brightcove.com/${account}/${player}_${embed}/index.html?videoId=${videoId}`;
    }
  }

  // Prefer Brightcove, then an explicit iframe/src, then the runtime page URL, then the
  // document's own URL (covers validation harnesses that don't pass params).
  const existingIframe = element.querySelector('iframe[src]');
  const pageUrl = (params && params.originalURL)
    || (document && document.location && document.location.href)
    || (document && document.baseURI)
    || '';
  const href = brightcove
    || (existingIframe && existingIframe.getAttribute('src'))
    || pageUrl;

  if (!href) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const a = document.createElement('a');
  a.setAttribute('href', href);
  a.textContent = href;

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'embed',
    cells: [[a]],
  });
  element.replaceWith(block);
}
