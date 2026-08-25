import createHeader from './layout/header.js';
import  createSearch  from "./layout/search-layout.js";
import  createFilters  from "./layout/filters.js";
import createMain from './layout/main.js';

function moveSearchButton(form) {
  const searchButton = form
    .querySelector('#form-zipcodesubmit')
    ?.closest('.field-wrapper');

  const searchSection = form.querySelector(
    '.locator-search',
  );

  const filterSection = form.querySelector(
    '.locator-filters',
  );

  if (
    !searchButton
    || !searchSection
    || !filterSection
  ) {
    return;
  }

  const isMobile = window.matchMedia(
    '(max-width: 988px)',
  ).matches;

  if (isMobile) {
    filterSection.append(searchButton);
  } else {
    searchSection.append(searchButton);
  }
}
function moveLegendsection(form) {
  const legendSection = document
    .querySelector('.locator-legend');

  const locatorMainSection = form.querySelector(
    '.locator-main',
  );

  const resultSection = form.querySelector(
    '.locator-results-wrap',
  );

  if (
    !legendSection
    || !locatorMainSection
    || !resultSection
  ) {
    return;
  }

  const isMobile = window.matchMedia(
    '(max-width: 988px)',
  ).matches;

  if (isMobile) {
    locatorMainSection.prepend(legendSection);
  } else {
    resultSection.prepend(legendSection);
  }
}

export default function createLayout(block) {
  const form = block.querySelector('form');

  if (!form) return;

  const inputFieldLabel = form?.querySelector('#form-networkonly-label');
  const inputField = form?.querySelector('#form-networkonly');
  

  // Header Section Creation
  const header = createHeader(form);

  // Search Section Creation
  const search = createSearch(block, form)



  // Filters
  const filters = createFilters(form, inputField, inputFieldLabel)
  moveSearchButton(form);

  // Main
  const mainLayout = createMain(form);

  // Append in order
  form.append(
    header,
    search,
    filters,
    mainLayout.main,
  );

  // Now both sections exist in the DOM
  moveSearchButton(form);
  moveLegendsection(form);

  // Move button when viewport changes
  const mobileQuery = window.matchMedia(
    '(max-width: 988px)',
  );

  mobileQuery.addEventListener('change', () => {
    moveSearchButton(form);
    moveLegendsection(form);
  });
}