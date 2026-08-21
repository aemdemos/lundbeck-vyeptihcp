import {
  clearMarkers,
  geocodeZip,
  centerMap,
  renderMarkers,
  centerMapOnMarker
} from './map.js';

// import { searchLocations } from './api.js';

import  getMiles  from './distance.js';

import renderResults from './template.js';

import { downloadResultsPdf } from './layout/pdf.js';

/**
 * Apply the same filtering behaviour as the live site.
 */
function applyFilters(results, filters) {
  let filteredResults = [...results];

  /*
   * Network Only
   */
  if (filters.networkOnly) {
    filteredResults = filteredResults.filter(
      (facility) =>
        String(facility.preferredIc)
          .trim()
          .toUpperCase() === 'TRUE',
    );
  }

  /*
   * Hide Hospital Based Locations
   */
  if (filters.hideHospital) {
    filteredResults = filteredResults.filter(
      (facility) =>
        String(facility.locationType)
          .trim()
          .toUpperCase() !== 'HOSPITAL',
    );
  }

  return filteredResults;
}

/**
 * Get currently selected filters.
 */
function getFilters(block) {
  return {
    networkOnly:
      block.querySelector(
        '#form-networkonly',
      )?.checked ?? false,

    hideHospital:
      block.querySelector(
        '#form-hidehospital',
      )?.checked ?? false,
  };
}


function addPrintResults(filteredResults) {
  const existingPrint =
    document.querySelector(
      '.print-result-btn',
    );

  existingPrint?.remove();

  const printElement =
    document.createElement('div');

  printElement.className =
    'print-result-btn';

  const printTag =
    document.createElement('a');

  printTag.className =
    'print-results';

  printTag.textContent =
    'Print Results';

  printTag.href = '#';

  printElement.append(
    printTag,
  );

  const headerElement =
    document.querySelector(
      '.locator-title-wrap',
    );

  if (headerElement) {
    headerElement.prepend(
      printElement,
    );
  }

  printTag.addEventListener(
    'click',
    async (event) => {
      event.preventDefault();

      await downloadResultsPdf(
        filteredResults,
        {
          pdfTitle:
            'Infusion Service Providers in your area',

          // Keep your existing disclaimerText
          // copyrightText etc. here.
        },
      );
    },
  );
}

export default async function handleSearch({
  block,
  ui,
  settings,
  apiInfo,
  allLocations,
}) {
  const {
    searchBtn,
    zipInput,
    mileBlock,
    resultsContainer,
  } = ui;

  const zip = zipInput.value.trim();

  if (!zip) {
    ui.errorLabel.classList.remove(
      'selectHide',
    );

    return;
  }

  ui.errorLabel.classList.add(
    'selectHide',
  );

  searchBtn.textContent = 'SEARCHING...';
  searchBtn.disabled = true;

  clearMarkers();

  const filters = getFilters(block);

  const radius = Number(
    mileBlock.dataset.value || 25,
  );



  try {
    /*
     * 1. ZIP → coordinates.
     */
    const userLocation = await geocodeZip(zip);


    /*
     * 2. Use API data loaded on page load.
     */
    const results = Array.isArray(allLocations)
      ? allLocations
      : [];

    /*
     * 3. Calculate distance.
     */
    const resultsWithMiles = results
      .map((facility) => ({
        ...facility,

        miles: getMiles(
          userLocation.lat,
          userLocation.lng,
          Number(facility.latitude),
          Number(facility.longitude),
        ),
      }))
      .filter(
        (facility) =>
          facility.miles !== null
          && facility.miles <= radius,
      );

    /*
     * 4. Apply filters.
     */
    const filteredResults = applyFilters(
      resultsWithMiles,
      filters,
    );

    /*
     * 5. Sort by distance.
     */
    filteredResults.sort(
      (a, b) => a.miles - b.miles,
    );

    /*
     * 6. Render markers.
     */
    renderMarkers(filteredResults);

    /*
     * 7. Center map.
     */
    centerMap(userLocation);

    /*
     * 8. Render cards.
     */
    renderResults(
      filteredResults,
      resultsContainer,
      settings,
    );

    /*
     * 9. Card → map marker.
     */
    resultsContainer.addEventListener(
      'click',
      (event) => {
        const card = event.target.closest(
          '.result-card',
        );

        if (!card) return;

        const index = Number(
          card.dataset.index,
        );

        centerMapOnMarker(index);
      },
    );

    /*
     * 10. Print results.
     */
    addPrintResults(
      filteredResults,
    );
  } catch (error) {
    console.error(
      'Search failed:',
      error,
    );
  } finally {
    /*
     * Always re-enable Search.
     */
    searchBtn.textContent = 'SEARCH';
    searchBtn.disabled = false;
  }
}

