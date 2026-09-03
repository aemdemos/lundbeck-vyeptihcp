// add delayed functionality here
import { loadScript } from './aem.js';
import pushPageViewEvent from './pageview.js';
import initLinkTracking from './linktracking.js';
import initScrollDepthTracking from './observers.js';
import initModalTracking from './modaltracking.js'; 
import initInfusionTracking from './infusiontracking.js';
import initVideoTracking from './videotracking.js';

const LAUNCH_LIBS = {
  production: 'https://assets.adobedtm.com/e1f0958460fd/6eca0e8e6204/launch-c513561f2994.min.js',
  staging: 'https://assets.adobedtm.com/e1f0958460fd/6eca0e8e6204/launch-50a179f841ff-staging.min.js',
};

// CookieInformation consent management platform (same CMP as www.vyepti.com)
async function loadConsentManager() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('martech') === 'off') return;
  window.cookieInformationCustomConfig = {
    acceptFrequency: 365,
    declineFrequency: 365,
  };

  await loadScript('https://policy.app.cookieinformation.com/uc.js', {
    id: 'CookieConsent',
    'data-culture': 'EN',
    type: 'text/javascript',
  });
}

/** Maps the current host to an AEP Tags environment. */
function getLaunchLib() {
  const { hostname } = window.location;
  // Production: live tree + your production custom domain(s)
  if (hostname === 'www.vyeptihcp.com'
    || hostname === 'main--lundbeck-vyeptihcp--aemdemos.aem.live') {
    return LAUNCH_LIBS.production;
  }
  // Everything else (preview / branch / stage on *.aem.page) → staging
  return LAUNCH_LIBS.staging;
}

async function loadAdobeLaunch() {
  if (new URLSearchParams(window.location.search).get('martech') === 'off') return;
  await loadScript(getLaunchLib(), { async: '' });
}

loadConsentManager();
loadAdobeLaunch();
initModalTracking();
// Fire Page View once the page is idle and AEP Tags is ready.
pushPageViewEvent();
initLinkTracking();
initScrollDepthTracking();
initInfusionTracking();
initVideoTracking();
