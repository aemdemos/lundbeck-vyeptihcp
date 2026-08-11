import { getSettings } from '../../scripts/config.js';
import { createLayout } from './layout.js';
import { initializeMap } from './map.js';
import { getApiKey } from './api.js';
import  registerEvents  from './events.js';
import { initCustomDropdown } from './dropdown.js';
import  getElements  from './ui.js';

export default async function decorate(block) {
  const settings = getSettings(block);

  await renderForm(block);
  await createLayout(block);

  const apiKey = getApiKey(block);

  await initializeMap(apiKey);

  const ui = getElements(block);

  initializeDropdowns(ui);

  registerEvents({
    block,
    ui,
    settings,
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