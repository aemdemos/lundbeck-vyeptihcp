// search.js
import { clearMarkers } from './map.js';
import { searchLocations } from './api.js';
import  renderResults  from './template.js';



export default async function handleSearch({
  block,
  ui,
  settings,
  apiInfo,
}) {
  const { searchBtn, zipInput, mileBlock, resultsContainer } = ui;

  const zip = zipInput.value.trim();
  if (!zip) {
    ui.errorLabel.classList.remove('selectHide');
    return;
  } 
    ui.errorLabel.classList.add('selectHide');

  searchBtn.textContent = 'SEARCHING...';
  searchBtn.disabled = true;

  clearMarkers();

  const filters = Array.from(
    block.querySelectorAll('.dropdown-items input:checked'),
  ).map((cb) => cb.value);

  const distance = mileBlock.dataset.value || '25';
  //alert(distance);
  try {
    const results = await searchLocations(
      zip,
      distance,
      settings,
      apiInfo,
      filters,
    );

    renderResults(results, resultsContainer, settings);
  } finally {
    searchBtn.textContent = 'SEARCH';
    searchBtn.disabled = false;
  }
}