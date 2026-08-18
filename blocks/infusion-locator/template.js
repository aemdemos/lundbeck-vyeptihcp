import { addMarker } from './map.js';
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
    document.createTextNode('Lundbeck does not recommend use of any specific infusion provider. Patients can receive their VYEPTI infusion from any infusion provider as appropriate. Patients may have payer-mandated or in-network infusion sites. This list is based on data available at the time of search; it may not be comprehensive. '),
  );

  // const redText = document.createElement('span');
  // redText.className = 'red-color';

  // const bold = document.createElement('b');
  // bold.textContent = 'red';

  // redText.append(bold);

  // disclaimer.append(
  //   redText,
  //   document.createTextNode(
  //     ' are part of the VYEPTI Infusion Network. VYEPTI infusions are not limited to this network—patients can choose to receive their VYEPTI infusion from any provider based on convenience or insurance coverage.',
  //   ),
  // );

  header.append(title, disclaimer);

  // Results list
  const list = document.createElement('ul');
  list.className = 'locator-results-list';



  results.forEach((result, index) => {
    const item = searchResult(result, index, settings);
    list.append(item);

    // Marker data
    const name =
      result.name ||
      result.facilityName ||
      `Location ${index + 1}`;

    const address =
      result.address ||
      result.streetAddress ||
      '';

    const city = result.city || '';
    const state = result.state || '';
    const zip = result.zip || result.zipCode || '';

    const fullAddress = [
      address,
      city,
      state,
      zip,
    ]
      .filter(Boolean)
      .join(', ');
  });

  resultsContainer.append(header, list);
}