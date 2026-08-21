import { getSettings } from '../../scripts/config.js';
import createLayout from './layout.js';
import {
  initializeMap,
  initializeAutocomplete,
} from './map.js';
import {
  getApiInfo,
  loadLocations,
} from './api.js';
import registerEvents from './events.js';
import { initCustomDropdown } from './dropdown.js';
import getElements from './ui.js';
import { loadPdfMake } from './layout/pdf.js';

async function renderForm(block) {
  const formModule = await import('../form/form.js');
  await formModule.default(block);
}

/**
 * Read settings that belong to the document.
 *
 * These values must be read before form.js
 * replaces the block contents.
 */
function getDocumentSettings(block) {
  const rows = block.querySelectorAll(':scope > div');
  const config = {};

  rows.forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');

    if (cells.length < 2) return;

    const key = cells[0].textContent
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    config[key] = cells[1].textContent.trim();
  });

  return {
    apiEndpoint: config['api-end-point'] || '',

    showInfusionCenters: /^(true|yes|1|on)$/i.test(
      config['show-infusion-centers'] || '',
    ),

    showHcpData: /^(true|yes|1|on)$/i.test(
      config['show-hcp-data'] || '',
    ),
  };
}

function initializeDropdowns(ui) {
  ui.distanceDropdown = initCustomDropdown(
    ui.mileBlock,
    'select',
  );
}

await loadPdfMake();

export default async function decorate(block) {
  /*
   * 1. Read document configuration first.
   */
  const documentSettings = getDocumentSettings(block);

  /*
   * 2. Render form.
   */
  await renderForm(block);

  /*
   * 3. Get form/API information.
   */
  const apiInfo = getApiInfo(
    block,
    documentSettings,
  );

  if (!apiInfo) {
    console.error('API configuration is missing');
    return;
  }

  /*
   * 4. Get sheet configuration.
   */
  const settings = {
    ...getSettings(block),
    ...documentSettings,
  };

  /*
   * 5. Load all facility data.
   */
  const allLocations = await loadLocations(
    apiInfo,
    settings,
  );

  /*
   * 6. Create locator layout.
   */
  await createLayout(block);

  /*
   * 7. Initialize map.
   */
  await initializeMap(apiInfo.apiKey);

  /*
   * 8. Initialize ZIP autocomplete.
   */
  const zipInput = block.querySelector(
    '#form-zipcode',
  );

  initializeAutocomplete(zipInput);

  /*
   * 9. Get UI elements.
   */
  const ui = getElements(block);

  /*
   * 10. Initialize dropdown.
   */
  initializeDropdowns(ui);

  /*
   * 11. Register events.
   */
  registerEvents({
    block,
    ui,
    settings,
    apiInfo,
    allLocations,
  });
}