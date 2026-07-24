import { getBlockId } from '../../scripts/scripts.js';
import { loadScript } from '../../scripts/aem.js';

/**
 * Infusion Locator block — mounts the PICL (Provider/Infusion-Center Locator) tool.
 *
 * The source site renders this interactive, Google-Maps-based location finder as a Vue.js
 * single-page app. It is NOT an iframe (the site sends X-Frame-Options and exposes no
 * standalone embeddable widget URL) and it is NOT a self-registering custom element like
 * coverage-finder. Instead — like sign-up — it is static config markup (a config div with
 * data-* attributes + a Vue mount holder + <script type="text/x-template"> blocks) that an
 * AEM PICL clientlib wires up: the clientlib defines the Vue components, mounts the app into
 * `#picl-tool-vue-holder`, reads config from `.picl-tool-finder[data-*]`, and fetches
 * provider data from the `data-res-path` endpoint. So we replicate the source: inject that
 * config markup, then load the tool's dependencies (jQuery/Vue deps, axios, Google Maps JS
 * API) followed by the PICL clientlib.
 *
 * NOTE: the data endpoint (/api/picllocator) and Google Maps tiles are origin-bound to
 * vyeptihcp.com. The UI (search form, map load, autocomplete) renders wherever the scripts
 * load; a live provider-data fetch fully succeeds only on the production origin.
 *
 * Author-editable config is read from block content (never hard-coded here):
 *   Row 1 (optional): the origin that serves the PICL clientlib + data endpoint.
 *   Row 2 (optional): the Google Maps JS API key.
 * Sensible production defaults are used when a row is absent.
 */
const DEFAULT_ORIGIN = 'https://www.vyeptihcp.com';
const DEFAULT_MAPS_KEY = 'AIzaSyC9EwXy0QjV2u1LR0PrKNNR_lMJHr4dTGI';

const AXIOS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axios/0.20.0/axios.min.js';
const AXIOS_INTEGRITY = 'sha512-quHCp3WbBNkwLfYUMd+KwBAgpVukJu5MncuQaWXgCrfgcxCJAq/fo+oqrRKOj+UKEmyMCG3tb8RB63W+EmrOBg==';

const DEP_CLIENTLIB = '/etc.clientlibs/vyepti-hcp/clientlibs/clientlib-dependencies.min.js';
const PICL_CLIENTLIB = '/etc.clientlibs/vyepti-hcp/vyepti-picl-hcp/components/content/picllocater/clientlibs/clientlib-picltool-script.min.js';

function toolMarkup(origin) {
  return `
<div class="picllocater">
  <div class="container">
    <div class="picl-tool-finder"
      data-res-path="/api/picllocator"
      data-showIC="true"
      data-showHCPData="false"
      data-learnMorePdfPath="/content/dam/lundbeck/vyepti/vyeptihcp/pdf/physician-home-infusion-flashcard.pdf"
      data-getStartedPdfPath="https://info.orsinispecialtypharmacy.com/hubfs/VYEPTI%20Referral%20Form.pdf?hsLang=en"
      data-showHICard="true">
      <h2>VYEPTI Infusion Locator</h2>
      <h3><strong>Find infusion options near your patients.</strong></h3>
      <div id="picl-tool-vue-holder"></div>
      <div class="locator-i18n-config" hidden
        data-pdf-title="Infusion Service Providers in your area"
        data-pdf-note="*See website for insurance plans accepted, or contact the infusion center directly with your specific insurance information to verify coverage."
        data-pdf-disclaimer-text="The VYEPTI Infusion Locator is provided for informational purposes only. This database includes infusion service providers compiled by Lundbeck that are known to have experience with VYEPTI. The results shown may not be inclusive of all providers who may have experience with VYEPTI in your area. Lundbeck does not guarantee the accuracy or completeness of any information provided herein. Users should contact providers directly with all medication, insurance coverage, facility, and other site-specific inquiries. No fees or other remuneration have been or will be exchanged for an infusion service provider's inclusion in this database. Unless otherwise stated, Lundbeck is not affiliated with, and inclusion in this list does not represent an endorsement of or referral to the providers contained in this database; nor does it represent an endorsement of any Lundbeck product by any provider listed. Users are responsible for compliance with state and federal laws regulating physician referrals, including state professional practice restrictions. Lundbeck and its affiliates hereby disclaim any liability arising from your use of and/or reliance on the information contained in this VYEPTI Infusion Locator."
        data-pdf-copyright-text="© 2023 Lundbeck. All rights reserved. VYEPTI and VYEPTI GO are registered trademarks, and VYEPTI CONNECT and Migraine Victors Program are trademarks of Lundbeck Seattle BioPharmaceuticals, Inc. EPT-B-100298v8"></div>

      <script type="text/x-template" id="loader-template"><div>
        <div id="loader"><img src="${origin}/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/images/spinner.gif" class="spinner-img"/></div>
        <div class="overlay"></div>
      </div></script>

      <script type="text/x-template" id="search-template"><div class="search-block">
        <p class="required-information">*Required field</p>
        <form id="searchForm" class="form-container" @submit="submitFilter" method="post" novalidate="true">
          <div class="form-group row multi-field-group">
            <div class="col col-12 col-lg-7">
              <div class="address-block">
                <label for="searchAddress" class="form-label col-form-label col" :class="{ 'focus': addressHasFocus }">From patient's city, state, or ZIP code*</label>
                <input id="inputLocation" ref="autocomplete" type="text" placeholder="" class="form-control form-text search-location" v-model="addressValue" @focusout="addressFocus(false)" @focusin="addressFocus(true)"/>
              </div>
            </div>
            <div class="col col-12 col-lg-2">
              <mileDropdown v-if="conditionToLoadMileDropdown" ref="mile-field"></mileDropdown>
            </div>
            <div class="col col-12 col-lg-9 filter-mob">
              <filterDropdown v-if="conditionToLoadFilterDropdown" ref="filter-field-mob"></filterDropdown>
            </div>
            <div class="col col-12 col-lg-3">
              <div class="d-none d-lg-block"><button type="submit" class="button button-primary">SEARCH</button></div>
              <div class="d-block d-lg-none"><button type="submit" class="button button-primary">SEARCH</button></div>
            </div>
          </div>
          <div class="col col-12 col-lg-9 filter-desk">
            <filterDropdown v-if="conditionToLoadFilterDropdown" ref="filter-field-desk"></filterDropdown>
          </div>
        </form>
        <p v-if="networkError || $root.networkError" class="error">An error occurred. Please refresh your page and try again later.</p>
        <p v-else-if="addressFieldError" class="error">Please enter a valid city, state, or ZIP code, and try again.</p>
      </div></script>

      <script type="text/x-template" id="google-map-template"><div class="google-map" id="map"></div></script>

      <script type="text/x-template" id="working-days-template"><div class="tb">
        <div class="tbrow"><div class="tbcell-day">Mon</div><div class="tbcell">{{days.mon}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Tues</div><div class="tbcell">{{days.tue}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Wed</div><div class="tbcell">{{days.wed}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Thurs</div><div class="tbcell">{{days.thu}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Fri</div><div class="tbcell">{{days.fri}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Sat</div><div class="tbcell">{{days.sat}}</div></div>
        <div class="tbrow"><div class="tbcell-day">Sun</div><div class="tbcell">{{days.sun}}</div></div>
      </div></script>

      <script type="text/x-template" id="center-list-template"><div class="center-list-block" :class="{welcomeNoteBlock:!conditionToLoadCenterlist}">
        <div class="map-header-desk section-powder-blue-bg-desktop">
          <div class="col col-12 col-lg-4 section-infusion-center"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-hospital-40px.png"/><span>Infusion center location</span></div>
          <div class="col col-12 col-lg-4"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-home-infusion-40px.png"/><span>Provider may offer Home Infusion</span></div>
          <div class="col col-12 col-lg-4"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-pin-legend-red.png"/><span>VYEPTI Infusion Network</span></div>
        </div>
        <div class="welcomeNote" v-if="welcomeNote"><h1>Welcome</h1><h2>Please enter your information above to begin your search.</h2></div>
        <div class="welcomeNote" v-if="$root.noResults" :class="{noResults:$root.noResults}">
          <img src="${origin}/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/icons/search-plus.png" class="noResults-icon-img"/>
          <h1>No results found</h1>
          <h2>There are no results available at this time. Please edit your search filters or check back often, as more locations are periodically added.</h2>
        </div>
        <div v-if="conditionToLoadCenterlist" class="center-listitem-block">
          <div class="print-result-btn"><a href="javascript:void(0);" class="float-md-right" @click.prevent="printResult" v-if="filterRecord()!==0">Print results</a></div>
          <h4>Results ({{filterRecord()}} total results)</h4>
          <p class="result-disclaimer">Lundbeck does not recommend use of any specific infusion provider. Patients can receive their VYEPTI infusion from any infusion provider as appropriate. Patients may have payer-mandated or in-network infusion sites. This list is based on data available at the time of search; it may not be comprehensive.</p>
          <centerCard v-for="(items, index) in $filteredCenterList" :items='items' :index='index' :key="index"></centerCard>
        </div>
      </div></script>

      <script type="text/x-template" id="picl-tool-template"><div class="picl-tool-vue-wrap">
        <loading-screen v-if="isLoading"></loading-screen>
        <template v-if="initialized">
          <div class="wrapper">
            <div class="row"><div class="col-lg-12"><search v-if="conditionToLoadSearch" :markerIndex="markerIndex"></search></div></div>
            <div class="row map-area">
              <div class="map-header-mob">
                <div class="section-powder-blue-bg-desktop">
                  <div class="col col-12 col-lg-4 section-infusion-center"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-hospital-40px.png"/><span>Infusion center location</span></div>
                  <div class="col col-12 col-lg-4"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-home-infusion-40px.png"/><span>Provider may offer Home Infusion</span></div>
                  <div class="col col-12 col-lg-4"><img src="${origin}/content/dam/lundbeck/vyepti/vyeptihcpbreakfree/images/icon-pin-legend-red.png"/><span>VYEPTI Infusion Network</span></div>
                </div>
              </div>
              <div class="col-lg-6"><googleMap v-if="conditionToLoadGoogleMap"></googleMap></div>
              <div class="col-lg-6"><centerList @centerCardClicked="updateMarkerIndex"></centerList></div>
            </div>
          </div>
        </template>
      </div></script>
    </div>
  </div>
</div>`;
}

export default async function decorate(block) {
  const blockId = getBlockId('infusion-locator');
  block.setAttribute('id', blockId);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'VYEPTI Infusion Locator');

  const rows = [...block.children];
  const cellText = (row) => (row ? row.textContent.trim() : '');
  const firstLink = (row) => (row ? row.querySelector('a[href]') : null);

  // Row 1 (optional): origin that serves the PICL clientlib + data endpoint. Defaults to prod HCP.
  const originRaw = (firstLink(rows[0]) && firstLink(rows[0]).getAttribute('href')) || cellText(rows[0]);
  const origin = (originRaw && /^https?:\/\//.test(originRaw))
    ? originRaw.replace(/\/$/, '')
    : DEFAULT_ORIGIN;

  // Row 2 (optional): Google Maps JS API key (public, client-side).
  const mapsKey = cellText(rows[1]) || DEFAULT_MAPS_KEY;

  block.innerHTML = toolMarkup(origin);

  // Load deps first (jQuery/Vue runtime), then axios + Google Maps, then the PICL clientlib
  // which mounts the Vue app into #picl-tool-vue-holder. loadScript is idempotent per URL.
  try {
    await loadScript(`${origin}${DEP_CLIENTLIB}`);
  } catch (e) {
    // Fail securely: the clientlib may retry / be CDN-cached; leave markup in place.
  }
  try {
    await loadScript(AXIOS_URL, { integrity: AXIOS_INTEGRITY, crossorigin: 'anonymous' });
  } catch (e) { /* non-fatal */ }
  try {
    await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&sensor=false&libraries=places`);
  } catch (e) { /* non-fatal */ }
  try {
    await loadScript(`${origin}${PICL_CLIENTLIB}`);
  } catch (e) { /* non-fatal */ }
}
