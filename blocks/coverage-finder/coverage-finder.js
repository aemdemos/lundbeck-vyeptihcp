import { getBlockId } from '../../scripts/scripts.js';
import { loadScript } from '../../scripts/aem.js';
import {
  pushCoverageFinderEventToDataLayer,
  pushCoveragePlanCheckEventToDataLayer,
} from '../../scripts/datalayer.js';

/**
 * Attaches the "zip search" analytics listener to the vendor shadow DOM.
 * Fires COVERAGE_FINDER_START when the user searches a non-empty location.
 * @param {ShadowRoot} shadowRoot
 */
function watchSearchButton(shadowRoot) {
  shadowRoot.addEventListener('click', (e) => {
    if (!e.target.closest('.norstella-cf-searchButton')) return;
    const input = shadowRoot.querySelector(
      '#norstella-cf-geoSearch .norstella-cf-searchText #geoSearch.norstella-cf-MuiInputBase-input',
    );
    const zipCode = input ? input.value.trim() : '';
    if (zipCode) pushCoverageFinderEventToDataLayer({ zipCode });
  });
}

/**
 * Reads plan name/type from a desktop table row.
 * @param {Element} row
 * @returns {{ planName: string, planType: string }}
 */
function readPlanFromRow(row) {
  const tc0 = row.querySelector('.norstella-cf-tc0');
  const tc1 = row.querySelector('.norstella-cf-tc1');
  return {
    planName: tc0 ? tc0.textContent.trim() : '',
    planType: tc1 ? tc1.textContent.trim() : '',
  };
}

/**
 * Reads plan name/type from a mobile/tablet card.
 * @param {Element} card
 * @returns {{ planName: string, planType: string }}
 */
function readPlanFromCard(card) {
  const planNameEl = card.querySelector('.norstella-cf-mobilePlanHeader');
  const planName = planNameEl ? planNameEl.textContent.trim() : '';

  const detailDivs = [...card.querySelectorAll('.norstella-cf-mobilePlanDetails')];
  const planTypeDiv = detailDivs.find((div) => {
    const lbl = div.querySelector('label');
    return lbl && lbl.textContent.trim().toLowerCase() === 'plan type';
  });

  let planType = '';
  if (planTypeDiv) {
    const planTypeLbl = planTypeDiv.querySelector('label');
    planType = planTypeDiv.textContent.trim()
      .replace(planTypeLbl.textContent.trim(), '')
      .replace(/^:\s*/, '')
      .trim();
  }
  return { planName, planType };
}

/**
 * Attaches the "show details" analytics listener to the vendor shadow DOM.
 * Fires COVERAGE_PLAN_CHECK with the plan name, type, and active benefit type.
 * Handles both the desktop table layout and the mobile/tablet card layout.
 * @param {ShadowRoot} shadowRoot
 */
function watchShowDetailsButton(shadowRoot) {
  shadowRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('.norstella-cf-note-button');
    if (!btn) return;

    const row = btn.closest('tr');
    const card = btn.closest('.norstella-cf-card');
    let planName = '';
    let planType = '';
    if (row) {
      ({ planName, planType } = readPlanFromRow(row));
    } else if (card) {
      ({ planName, planType } = readPlanFromCard(card));
    }

    const benefitTypeBtn = shadowRoot.querySelector(
      '.norstella-cf-benefitTypeButtonGroup .norstella-cf-MuiToggleButton-root[aria-pressed="true"]',
    );
    const benefitType = benefitTypeBtn ? benefitTypeBtn.getAttribute('value') || '' : '';

    if (planName) {
      pushCoveragePlanCheckEventToDataLayer({ benefitType, planName, planType });
    }
  });
}

/**
 * Waits for the vendor custom element to build its shadow DOM, then attaches
 * the analytics listeners exactly once. The vendor clientlib self-registers
 * `<coverage-finder>` and populates its shadowRoot asynchronously after the
 * script loads, so we observe the mount until the shadowRoot appears.
 * @param {Element} mount The `<coverage-finder>` element
 */
function trackShadowDomEvents(mount) {
  let attached = false;
  const attach = () => {
    if (attached || !mount.shadowRoot) return false;
    attached = true;
    watchSearchButton(mount.shadowRoot);
    watchShowDetailsButton(mount.shadowRoot);
    return true;
  };

  if (attach()) return;

  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(mount, { childList: true, subtree: true, attributes: true });
}

/**
 * Coverage Finder block — mounts the MMIT `<coverage-finder>` web component.
 *
 * The source site renders this interactive coverage-lookup tool by loading a vendor
 * clientlib that self-registers a custom element (`customElements.define('coverage-finder', …)`),
 * then placing `<coverage-finder token="…">`. It CANNOT be an iframe: the vendor exposes no
 * standalone embeddable URL and the source page sets X-Frame-Options. So we replicate the
 * source: load the vendor script, then mount the element with its authored token.
 *
 * Authored content (rows, each a single cell):
 *   Row 1: the vendor script URL (a link or plain text)
 *   Row 2: the JWT token string for this product/client (public client-side config)
 * Both are read from the block DOM — never hard-coded here — so authors can update them.
 */
export default async function decorate(block) {
  const blockId = getBlockId('coverage-finder');
  block.setAttribute('id', blockId);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Coverage Finder');

  const rows = [...block.children];
  const cellText = (row) => (row ? row.textContent.trim() : '');
  const firstLink = (row) => (row ? row.querySelector('a[href]') : null);

  // Row 1: vendor script URL (prefer an anchor href, else the trimmed text).
  const scriptRow = rows[0];
  const scriptUrl = (firstLink(scriptRow) && firstLink(scriptRow).getAttribute('href'))
    || cellText(scriptRow);

  // Row 2: token (JWT config for this product/client).
  const token = cellText(rows[1]);

  block.textContent = '';

  if (!scriptUrl) return;

  const mount = document.createElement('coverage-finder');
  if (token) mount.setAttribute('token', token);
  block.append(mount);

  // Attach analytics listeners once the vendor builds the shadow DOM.
  trackShadowDomEvents(mount);

  // loadScript is idempotent per URL in scripts.js; the clientlib self-registers the element.
  try {
    await loadScript(scriptUrl, { async: '' });
  } catch {
    // Fail securely: leave the mount element in place; the vendor script may retry/CDN-cache.
  }
}
