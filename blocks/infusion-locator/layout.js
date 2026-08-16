import { createDropdown } from "./dropdown.js";
// import { renderDescription } from "./filter-text.js";
import  createHeader  from './layout/header.js';
import { createSearch } from "./layout/search-layout.js";
import { createFilters } from "./layout/filters.js";
import createMain from './layout/main.js';

export function createLayout(block) {
  const form = block.querySelector('form');
  const inputFieldLabel = form?.querySelector('#form-networkonly-label');
  const inputField = form?.querySelector('#form-networkonly');
  
  if (!form) return;

  // Header
  const header = createHeader(form);
  //form.append(header);

  // Search
  const search = createSearch(block, form)

  // Filters
  const filters = createFilters(form, inputField, inputFieldLabel)

  // Main
  const mainLayout = createMain(form);
  
  // Append in order
  form.append(
    header,
    search,
    filters,
    mainLayout.main,
  );

  return {
    form,
    header,
    search,
    filters,
    main: mainLayout.main,
    map: mainLayout.map,
    results: mainLayout.results, 
  };
}