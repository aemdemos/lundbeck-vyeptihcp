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
 *
 * MULTI-TEMPLATE NOTE: This one file cleans every vyeptihcp template. The homepage-scoped
 * sticky-top spacer rule (article.home-page …) below only fires on the homepage — the efficacy
 * page has NO article.home-page wrapper (its main is <main class="container responsivegrid …">,
 * cleaned.html line 1084). The efficacy chrome that the homepage rule does NOT cover — the
 * back-to-top sticky image (#back-to-top) and the external-link interstitial modal
 * (div.interstitialmodal) — is removed by dedicated selectors added below. On the efficacy page
 * both sit as body-level siblings AFTER </main> (cleaned.html lines 3113 and 3129), in the same
 * trailing region as the martech iframes the existing rules already strip, so they are within the
 * importer's element scope. The header chrome from page-structure.json excludedRegions
 * (patient-link top strip #patient-link-header line 882, maintenance/header ribbon
 * div.header-ribbon line 944) all live INSIDE div.cmp-experiencefragment--header (line 878) and
 * are therefore already removed with that fragment — no extra selectors required.
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
      // Efficacy (and other non-homepage templates): back-to-top sticky decorative image.
      // Distinct from the homepage rule above — this is its own #back-to-top cmp-container that
      // sits as a body-level sibling AFTER </main> (cleaned.html line 3113), not inside an
      // article.home-page columncontainer. Site chrome, empty alt, not authorable.
      'div#back-to-top',
      // Efficacy external-link interstitial modal ("You are now leaving…" gate). Body-level
      // sibling after </main> (cleaned.html line 3129, div.interstitialmodal > #external-link-modal).
      // Injected by the site shell; an author never creates it, so remove it.
      'div.interstitialmodal',
      // ISI persistent fixed bottom bar (#isiFixedBottom). It is a sibling of the inline
      // ISI panel (#SafetyPanelInfo) inside the ISI experience fragment and carries a FULL
      // duplicate of the safety copy. The isi block (blocks/isi/isi.js) builds its own fixed
      // bar from the parsed block's abbreviated row, so this source bar is redundant — left
      // in place it renders the entire ISI a second time as raw default content just before
      // the isi block. Remove it so the ISI appears exactly once (as the isi block).
      'div#isiFixedBottom',
      // Empty ISI anchor stub (#isi.grey-bg) — the section boundary/background hook; carries
      // no content and would otherwise leave an empty grey div in the flow.
      'div#isi.grey-bg',
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

    // Placeholder skip-link the site shell injects just before the main content root
    // (cleaned.html: `<a href="#">___</a>` before div.root.container.responsivegrid).
    // It has no id/class to target via DOMUtils, so match by href="#" + underscore-only
    // (or empty) text. Author never creates it; drop it so it does not render at the top
    // of the page. Remove the wrapping <p> too if the anchor was its only content.
    element.querySelectorAll('a[href="#"]').forEach((a) => {
      if (/^_*$/.test(a.textContent.trim())) {
        const p = a.parentElement;
        a.remove();
        if (p && p.tagName === 'P' && !p.textContent.trim() && !p.querySelector('img, picture')) {
          p.remove();
        }
      }
    });
  }
}
