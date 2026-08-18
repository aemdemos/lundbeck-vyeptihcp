import renderDescription from "./regex.js";

export default function createMain(form) {
  const main = document.createElement('div');
  main.className = 'locator-main';

  const map = document.createElement('div');
  map.className = 'locator-map';

  const resultsWrap = document.createElement('div');
  resultsWrap.className = 'locator-results-wrap';

  const results = document.createElement('div');
  results.className = 'locator-results';


  // Legend
  const legend = document.createElement('div');
  legend.className = 'locator-legend';

  [
    form.querySelector('#form-infusion')?.closest('.field-wrapper'),
    form.querySelector('#form-home')?.closest('.field-wrapper'),
    form.querySelector('#form-network')?.closest('.field-wrapper'),
  ].forEach((el) => {
    if (el) {
      // eslint-disable-next-line browser-security/no-innerhtml
      el.innerHTML = renderDescription(el.textContent)
      legend.append(el);
    }
  });

  // Welcome message
  const resultTitle = document.createElement('h2');
  resultTitle.className = 'locator-welcome-title';
  resultTitle.textContent = 'Welcome';

  const text = document.createElement('p');
  text.className = 'locator-welcome-text';
  text.textContent = 'Please enter your information to begin your search.';

  results.append(
    resultTitle,
    text,
  );

  resultsWrap.append(
    legend,
    results,
  );

  main.append(
    map,
    resultsWrap,
  );

  return {
    main,
    map,
    resultsWrap,
    results,
    legend,
  };
}