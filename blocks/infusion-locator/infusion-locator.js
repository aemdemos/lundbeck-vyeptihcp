import { getSettings } from '../../scripts/config.js';
import { createLayout } from './layout.js';
import { initializeMap } from './map.js';
import { getApiInfo } from './api.js';
import  registerEvents  from './events.js';
import { initCustomDropdown } from './dropdown.js';
import  getElements  from './ui.js';

export default async function decorate(block) {
  await renderForm(block);

  const apiInfo = getApiInfo(block);

  console.log("API INFO :", apiInfo);
  const settings = getSettings(block, apiInfo);


  await renderForm(block);
  await createLayout(block);

  

  await initializeMap(apiInfo.apiKey);

  const ui = getElements(block);

  initializeDropdowns(ui);

  registerEvents({
    block,
    ui,
    settings,
    apiInfo,
  });
}

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