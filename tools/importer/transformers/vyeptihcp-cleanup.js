/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: vyeptihcp site-wide cleanup.
 *
 * Removes non-authorable site chrome from the Vyepti HCP (AEM Sites) source DOM so
 * the import contains only page-level authorable content (main article + references + ISI).
 *
 * ALL selectors below were verified against migration-work/cleaned.html.
 *
 * IMPORTANT: The ISI (#isi) and the references RTE (div.rte .reference-section) live INSIDE
 * the "marster" experience fragment (div.cmp-experiencefragment--marster). We must NOT remove
 * that XF. Only the HEADER and FOOTER experience fragments are removed, targeted by their
 * specific --header / --footer classes (never the bare .experiencefragment / .cmp-experiencefragment).
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Overlays / modals / widgets that block or pollute block parsing.
    WebImporter.DOMUtils.remove(element, [
      // Cookie banner (cleaned.html line 2) — includes its internal .modal-close-button / .close-button.
      '#cookie-information-template-wrapper',
      // LuMi AI chatbot: launcher nav item (line 498), css clientlib link (line 512),
      // and the full chat widget + backdrop injected after the footer XF (lines 1054, 1056).
      'li.desktop-lumi-nav-item',
      '#lumi-assistant-btn',
      'div.lumi-chat-backdrop',
      'div.lumi-assistant-widget',
    ]);
  }

  if (hookName === TransformHook.afterTransform) {
    WebImporter.DOMUtils.remove(element, [
      // Header experience fragment (cleaned.html line 284). Also carries the HCP interstitial
      // "This website is intended for US healthcare professionals only" gate / CONTINUE link (line 293+).
      'div.cmp-experiencefragment--header',
      // Footer experience fragment (line 1006).
      'div.cmp-experiencefragment--footer',
      // Trailing empty AEM spacer columncontainer (page-structure section 6 = "omit"):
      // an empty wide column + a sticky-top decorative image with empty alt (line 871/884).
      // Targeted by its distinguishing .sticky-top child (NOT :last-of-type, which is
      // fragile: after the cards-quicklink parser replaces banner-content's teaser
      // columncontainer, the banner H5 columncontainer would wrongly become last-of-type).
      'article.home-page div.columncontainer:has(> div.container > div.row > div.sticky-top)',
      // Tracking pixels / martech iframes injected near end of body (lines 1050-1053, 1217, 1223).
      'iframe#destination_publishing_iframe_lundbeck_0',
      'iframe[src*="demdex.net"]',
      'iframe[src*="doubleclick.net"]',
      'iframe#lumi-avatar-iframe',
      'img[src*="googleadservices.com"]',
      'img[src*="px.deepintent.com"]',
      // Residual head-injected refs the scraper left behind.
      'script',
      'style',
      'noscript',
      'link',
    ]);
  }
}
