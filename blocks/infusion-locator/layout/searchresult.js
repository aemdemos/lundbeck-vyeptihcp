import { centerMapOnMarker } from "../map.js";



function getFacilityIcon(result) {
  const combinedImage = 'https://www.vyepti.com/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/icons/Combined-Image.svg';
  const iconHome = 'https://www.vyepti.com/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/icons/icon_home_40px.svg';
  const iconHospital = 'https://www.vyepti.com/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/icons/icon_hospital_40px.svg';

  if (
    result.preferredIc === 'TRUE' &&
    result.homeInfusionFlag === 'TRUE' &&
    result.chairsFlag === 'TRUE'
  ) {
    return combinedImage;
  }
  if (
    result.preferredIc === 'TRUE' &&
    result.homeInfusionFlag === 'TRUE' &&
    result.chairsFlag === 'FALSE'
  ) {
    return iconHome;
  }
  return iconHospital;
}


export function noResult(resultsContainer) {
  const noResultsImg = document.createElement('img');
  noResultsImg.src = 'https://www.vyeptihcp.com/etc.clientlibs/vyepti-picl/clientlibs/clientlib-site/resources/icons/search-plus.png';
 noResultsImg.className ='noResults-icon-img';

  const title = document.createElement('h2');
  title.className = 'locator-no-results';
  title.textContent = 'No results found';

  const message = document.createElement('p');
  message.textContent =
    'There are no results available at this time. Please edit your search filters or check back often, as more locations are periodically added.';

  resultsContainer.append(noResultsImg, title, message);
}

export function searchResult(result, index, settings) {
  const name = result.name || result.facilityName || `Location ${index + 1}`;
  const address = result.address || result.streetAddress || '';
  const city = result.city || '';
  const state = result.state || '';
  const zip = result.zip || result.zipCode || '';
  const phone = result.phone || result.phoneNumber || '';
  const website = result.website || '';
  const typeText = result.type || '';
  const fullAddress = [address, city, state, zip]
    .filter(Boolean)
    .join(', ');

  //  PreferredIC means which is true Vyepti infussion locator
  const gradientClass =
    result.preferredIc === 'TRUE' ? 'gradientBorder' : '';

  const listItem = document.createElement('li');
  listItem.className = `locator-result-item ${gradientClass}`.trim();

  const itemInner = document.createElement('div');
  itemInner.className = 'locator-result-item-inner';

  const left = document.createElement('div');
  left.className = 'locator-result-left';

  const indexSpan = document.createElement('span');
  indexSpan.className = 'indexNo';
  indexSpan.textContent = index + 1;

  left.append(indexSpan);

  const right = document.createElement('div');
  right.className = 'locator-result-right';

  // Title
  const title = document.createElement('div');
  title.className = 'locator-result-title';

  const heading = document.createElement('h3');
  heading.textContent = name;

  const icon = document.createElement('img');
  icon.src = getFacilityIcon(result);
  icon.alt = 'Facility icon';

  title.append(heading, icon);
  right.append(title);

  // Network badge
  if (settings.showHcpData && result.inNetwork) {
    const badge = document.createElement('span');
    badge.className = 'locator-network-badge';
    badge.textContent = 'VYEPTI Infusion Network';
    right.append(badge);
  }

  // Type
  const type = document.createElement('p');
  type.className = 'typeText';
  type.textContent = typeText;

  // Miles
const miles = document.createElement('p');
miles.className = 'milesText';

if (result.miles !== null && result.miles !== undefined) {
  miles.textContent = `${result.miles} miles away`;
}

  // Address
  const addressP = document.createElement('p');
  addressP.className = 'locator-result-address';
  addressP.textContent = fullAddress;

  // Contact wrapper
  const contactWrap = document.createElement('div');
  contactWrap.className = 'locate-result-phone-wrap';

  if (phone) {
    const phoneP = document.createElement('p');
    phoneP.className = 'locator-result-phone';

    const phoneLink = document.createElement('a');
    phoneLink.href = `tel:${phone}`;

    const tel = document.createElement('span');
    tel.textContent = 'Tel: ';

    phoneLink.append(tel, document.createTextNode(phone));
    phoneP.append(phoneLink);
    contactWrap.append(phoneP);
  }

  if (website) {
    const websiteLink = document.createElement('a');
    websiteLink.href = website;
    websiteLink.target = '_blank';
    websiteLink.rel = 'noopener noreferrer';
    websiteLink.className = 'weblink';
    websiteLink.textContent = 'Visit website';

    contactWrap.append(websiteLink);
  }

  right.append(type, miles, addressP, contactWrap);
  itemInner.append(left, right);
  listItem.append(itemInner);


  // Event handler for the focus on specific card
  listItem.addEventListener('click', () => {
  centerMapOnMarker(index);
});

  

  return listItem;
}