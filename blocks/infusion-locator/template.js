import { searchResult, noResult } from './layout/searchresult.js';


export default function renderResults(results, resultsContainer, settings) {
  resultsContainer.replaceChildren();

  if (!results || results.length === 0) {
    noResult(resultsContainer);
    return;
  }

  // Header
  const header = document.createElement('div');
  header.className = 'locator-title-wrap';


  const title = document.createElement('h2');
  title.className = 'locator-title';
  title.textContent = `Results (${results.length} total results)`;

  const disclaimer = document.createElement('p');
  disclaimer.className = 'locator-result-disclaimer';

  disclaimer.append(
    // eslint-disable-next-line max-len
    document.createTextNode('Lundbeck does not recommend use of any specific infusion provider. Patients can receive their VYEPTI infusion from any infusion provider as appropriate. Patients may have payer-mandated or in-network infusion sites. This list is based on data available at the time of search; it may not be comprehensive. '),
  );

  header.append(title, disclaimer);

  // Results list
  const list = document.createElement('ul');
  list.className = 'locator-results-list';



  results.forEach((result, index) => {
    const item = searchResult(result, index, settings);
    list.append(item);
  });

  resultsContainer.append(header, list);
}