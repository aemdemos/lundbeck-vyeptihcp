/**
 * Modal Click Tracking for Vyepti HCP (EDS port).
 * Tracks Cookie Consent banner interactions and exit-link modal interactions,
 * pushing modalClick events via pushModalClickEventToDataLayer from datalayer.js.
 *
 * AMS→EDS remap: EDS routes ALL external-exit links through one modal
 * (openModal('/modals/exit', href) in scripts.js), built by blocks/modal/modal.js
 * as `.modal.exit` with a close-button (X) and Continue/Cancel anchors. AMS's
 * per-modal DOM (#external-link-modal, .btn-continue, .logo-partner-wrapper,
 * .cmp-link__screen-reader-only) does not exist in EDS. The outgoing URL is taken
 * from the triggering link captured at click time (reliable regardless of the
 * modal's button labels), and the interaction is the clicked control's text.
 */

import { pushModalClickEventToDataLayer } from './datalayer.js';

/** Maps a social platform href to its display name (empty if not social). */
function getSocialModalName(href) {
  if (!href) return '';
  const normalized = href.trim().toLowerCase();
  if (/^(javascript|data|vbscript):/.test(normalized)) return '';
  try {
    const { hostname } = new URL(href, window.location.origin);
    const host = hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) return 'Facebook';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'Instagram';
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'YouTube';
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'TikTok';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'LinkedIn';
  } catch {
    return '';
  }
  return '';
}

/** Domain name before ".com" (fallback modal name for download/exit popups). */
function getDomainName(href) {
  try {
    const { hostname } = new URL(href, window.location.origin);
    const host = hostname.replace(/^www\./, '');
    const comIndex = host.indexOf('.com');
    return comIndex > -1 ? host.substring(0, comIndex) : host;
  } catch {
    return '';
  }
}

/** Trimmed visible text of an element (prefers a nested <u>, like AMS). */
function getLinkName(anchor) {
  const uTag = anchor.querySelector('u');
  const source = uTag || anchor;
  return (source.innerText || source.textContent || '').trim();
}

// ---- Cookie consent banner -------------------------------------------

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

/** Handles clicks on the CookieInformation banner (X close / Save Settings). */
function handleConsentClick(e) {
  const base = e.target.closest('.coi-consent-banner__base');
  if (base && e.target.classList.contains('close-button')) {
    trackConsentInteraction('X');
    return;
  }
  const bottom = e.target.closest('.coi-consent-banner__bottom');
  if (bottom && e.target.classList.contains('modal-close-button')) {
    trackConsentInteraction('X');
    return;
  }
  if (e.target.closest('.bottom-bar__update-consent')) {
    trackConsentInteraction('Save Settings');
  }
}

// ---- Exit-link modals ---------------------------------------------

// Context of the link that triggered the exit modal, captured at click time.
let pendingTrigger = {};

/** Records the triggering link's context before the exit modal opens. */
function captureExitTrigger(e) {
  const anchor = e.target.closest('a[href]');
  if (!anchor || anchor.closest('.modal')) return;
  pendingTrigger = {
    href: anchor.getAttribute('href') || '',
    linkName: getLinkName(anchor),
    infusion: !!anchor.closest('.infusion-locator'),
  };
}

/** Resolves the interaction label for a clicked exit-modal control. */
function getExitInteraction(target, modal) {
  if (target.closest('.close-button')) return 'X';
  const anchor = target.closest('.modal-content a');
  if (anchor && modal.contains(anchor)) {
    return (anchor.innerText || anchor.textContent || '').trim();
  }
  return '';
}

/** Handles Continue / Cancel / X clicks inside the EDS exit modal. */
function handleExitModalClick(e) {
  const modal = e.target.closest('.modal.exit');
  if (!modal) return;

  const modalInteraction = getExitInteraction(e.target, modal);
  if (!modalInteraction) return;

  const outgoingHref = pendingTrigger.href || '';

  const social = getSocialModalName(outgoingHref);
  let modalType;
  let modalName;
  if (social) {
    modalType = 'Social Exit Popup';
    modalName = social;
  } else if (pendingTrigger.infusion) {
    modalType = 'Infusion Exit Popup';
    modalName = pendingTrigger.linkName || getDomainName(outgoingHref);
  } else {
    modalType = 'Download Popup';
    modalName = pendingTrigger.linkName || getDomainName(outgoingHref);
  }

  if (modalName) {
    pushModalClickEventToDataLayer({ modalType, modalName, modalInteraction });
  }
  pendingTrigger = {};
}

/**
 * Wires all modal-click tracking. Capture phase (true) for the exit modal so it
 * fires before the modal's own close handler removes the dialog.
 */
export default function initModalTracking() {
  document.addEventListener('click', handleConsentClick);
  document.addEventListener('click', captureExitTrigger, true);
  document.addEventListener('click', handleExitModalClick, true);
}