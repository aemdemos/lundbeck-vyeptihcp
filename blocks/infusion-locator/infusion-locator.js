import { getSettings } from '../../scripts/config.js';
import  createLayout  from './layout.js';
// import { initializeAutocomplete, initializeMap } from './map.js'; 'THis should be in comment till wre get end point'
import { initializeMap } from './map.js';
import { getApiInfo } from './api.js';
import registerEvents from './events.js';
import { initCustomDropdown } from './dropdown.js';
import getElements from './ui.js';
import { loadPdfMake } from './layout/pdf.js';

async function renderForm(block) {
  const formModule = await import('../form/form.js');
  await formModule.default(block);
}

function initializeDropdowns(ui) {
  ui.distanceDropdown = initCustomDropdown(
    ui.mileBlock,
    'select',
  );
}

await loadPdfMake();

export default async function decorate(block) {
  await renderForm(block);

  const apiInfo = getApiInfo(block);
  const settings = getSettings(block, apiInfo);


  await renderForm(block);
  await createLayout(block);



  await initializeMap(apiInfo.apiKey);


  //  It will in commented until we get the Proper End points
  // const zipInput = block.querySelector('#form-zipcode');
  // const autocomplete = initializeAutocomplete(zipInput);


  const ui = getElements(block);

  initializeDropdowns(ui);

  registerEvents({
    block,
    ui,
    settings,
    apiInfo,
  });
}




