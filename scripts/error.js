/**
 * Global error / validation event helpers for the Adobe Data Layer (EDS port).
 * Ported from AEM AMS error.js. Event name and payload shape (errorInfo with
 * validationErrorCode + errorMessage) are kept identical so existing AEP Tags
 * rules/data elements match.
 */

import { pushToAdobeDataLayer, DATA_LAYER_CONFIG } from './datalayer.js';

/**
 * Pushes a global error/validation event to the Adobe Data Layer.
 * @param {Object} params
 * @param {string} params.eventName - Description of the error occurrence.
 * @param {string|number} params.validationErrorCode - Error code.
 * @param {string} params.errorMessage - Human-readable error message.
 */
export function pushGlobalErrorEvent(params) {
  const eventName = params && params.eventName;
  const validationErrorCode = params && params.validationErrorCode;
  const errorMessage = params && params.errorMessage;
  pushToAdobeDataLayer({
    event: DATA_LAYER_CONFIG.errorEvents.ERROR,
    eventInfo: { eventName },
    errorInfo: {
      validationErrorCode: validationErrorCode !== null && validationErrorCode !== undefined
        ? String(validationErrorCode)
        : null,
      errorMessage: errorMessage !== null && errorMessage !== undefined ? errorMessage : null,
    },
  });
}

/**
 * Reads the page name from the body marker EDS sets in pageview.js
 * (document.body.dataset.pageName). Falls back to document.title so the
 * trigger still works on pages without the attribute.
 * @returns {string} The current page name, or an empty string.
 */
function getPageName() {
  const fromAttr = document.body && document.body.getAttribute('data-page-name');
  if (fromAttr) return fromAttr;
  return document.title || '';
}

/**
 * Fires the 404 error event when the current page is the 404 page.
 * Intended to be invoked from pushPageViewEvent immediately AFTER the
 * pageView push, so the error event lands right after pageView in the same
 * synchronous tick. No-op on any non-404 page (page-name guard).
 */
export function maybePushPageNotFoundError() {
  const cfg = DATA_LAYER_CONFIG.errorMeta.pageNotFound;
  if (getPageName() !== cfg.pageNameMatch) return;
  pushGlobalErrorEvent({
    eventName: cfg.eventName,
    validationErrorCode: cfg.validationErrorCode,
    errorMessage: cfg.errorMessage,
  });
}