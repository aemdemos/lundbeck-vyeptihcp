// ui.js
export default function getElements(block) {
  return {
    searchBtn: block.querySelector('#form-zipcodesubmit'),
    zipInput: block.querySelector('#form-zipcode'),
    resultsContainer: block.querySelector('.locator-results'),
    zipLabel: block.querySelector('label[for="form-zipcode"]'),
    mileBlock: block.querySelector('.mile-block'),
    filterBlock: block.querySelector('.filter-block'),
    errorLabel: block.querySelector('.error.select-hide'),
    infoIcon: block.querySelector('label .info-icon'),
    filterDescpOne: block.querySelector('.filter-descp-one'),
    filterDescpTwo: block.querySelector('.filter-descp-two'),
  };
}