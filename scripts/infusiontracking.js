/**
 * Bridge listener for the infusion locator search events (EDS port).
 *
 * The PICL Vue tool (loaded by blocks/infusion-locator/infusion-locator.js from
 * the vyeptihcp.com clientlib) cannot import app modules, so it dispatches a
 * `vyepti:infusion-search` CustomEvent on `window`. This module subscribes once,
 * normalises the payload, and pushes it to the Adobe Data Layer — keeping
 * analytics concerns out of the Vue component. Event names and payload shape are
 * kept identical to AMS so the existing AEP Tags rules match.
 */

import { pushToAdobeDataLayer, DATA_LAYER_CONFIG } from './datalayer.js';

/** Normalises a search-event detail and pushes the success/failure event. */
function pushInfusionSearchEventToDataLayer(data) {
  if (!data || !data.eventType) return;

  const isSuccess = data.eventType === DATA_LAYER_CONFIG.infusionEvents.SEARCH_SUCCESS;
  const eventName = isSuccess
    ? DATA_LAYER_CONFIG.infusionMeta.eventNameSuccess
    : DATA_LAYER_CONFIG.infusionMeta.eventNameFailure;

  const infusionInfo = {
    // zipCode: data.zipCode == null || data.zipCode === '' ? null : data.zipCode,
    zipCode: data.zipCode === null || data.zipCode === undefined || data.zipCode === '' ? null : data.zipCode,
    miles: data.miles !== null && data.miles !== undefined ? String(data.miles) : null,
    networkCheckBox: data.networkCheckBox === 'Yes' ? 'Yes' : 'No',
  };

  if (isSuccess) {
    infusionInfo.searchResultCount = data.searchResultCount !== null && data.searchResultCount !== undefined
      ? String(data.searchResultCount)
      : null;
  }

  pushToAdobeDataLayer({
    event: data.eventType,
    eventInfo: { eventName },
    infusionInfo,
  });
}

/** Subscribes to the PICL tool's window CustomEvent. Safe to call once. */
export default function initInfusionTracking() {
  window.addEventListener(DATA_LAYER_CONFIG.infusionMeta.customEventName, (event) => {
    if (!event || !event.detail) return;
    pushInfusionSearchEventToDataLayer(event.detail);
  });
}