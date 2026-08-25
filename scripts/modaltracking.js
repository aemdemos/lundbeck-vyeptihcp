/**
 * Modal Click Tracking for Vyepti HCP (EDS port).
 * Tracks Cookie Consent banner interactions and pushes a modalClick event.
 * Uses pushModalClickEventToDataLayer from datalayer.js.
 *
 * The CookieInformation CMP (loaded in delayed.js) renders the same banner DOM
 * and exposes the same API in EDS as in AMS, so the banner selectors and the
 * getConsentGivenFor() categories are unchanged.
 *
 * NOTE: The AMS source also tracked social/download/external-link modals via
 * AMS-only DOM (#external-link-modal, .btn-continue, .logo-partner-wrapper).
 * Those need remapping to the EDS modal (.modal.exit dialog with .ok/.cancel)
 * and are intentionally not ported here.
 */

import { pushModalClickEventToDataLayer } from './datalayer.js';

/** Reads the three consent categories from the CookieInformation CMP. */
function getConsentValues() {
  const ci = window.CookieInformation;
  if (!ci || typeof ci.getConsentGivenFor !== 'function') return {};
  return {
    functional: ci.getConsentGivenFor('cookie_cat_functional'),
    statistical: ci.getConsentGivenFor('cookie_cat_statistic'),
    marketing: ci.getConsentGivenFor('cookie_cat_marketing'),
  };
}

/** Pushes a Cookie Consent modalClick event with the current consent state. */
function trackConsentInteraction(modalInteraction) {
  pushModalClickEventToDataLayer({
    modalName: 'Cookie consent banner',
    modalType: 'Cookie Consent',
    modalInteraction,
    modalValue: getConsentValues(),
  });
}

/**
 * Single delegated click listener for the CookieInformation banner.
 * - X close (banner base or bottom bar) → "X"
 * - Save Settings (update consent) → "Save Settings"
 */
export default function initModalTracking() {
  document.addEventListener('click', (e) => {
    // X close on the banner base section
    const base = e.target.closest('.coi-consent-banner__base');
    if (base && e.target.classList.contains('close-button')) {
      trackConsentInteraction('X');
      return;
    }

    // X close on the bottom section
    const bottom = e.target.closest('.coi-consent-banner__bottom');
    if (bottom && e.target.classList.contains('modal-close-button')) {
      trackConsentInteraction('X');
      return;
    }

    // Save Settings
    if (e.target.closest('.bottom-bar__update-consent')) {
      trackConsentInteraction('Save Settings');
    }
  });
}