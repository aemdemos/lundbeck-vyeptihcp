// ui.js

export default function getElements(block) {
  return {
    searchBtn: block.querySelector('.submit-wrapper .button'),
    zipInput: block.querySelector('#form-zipcode'),
    resultsContainer: block.querySelector('.locator-results'),
    zipLabel: block.querySelector('label[for="form-zipcode"]'),
    mileBlock: block.querySelector('.mile-block'),
    filterBlock: block.querySelector('.filter-block'),
    errorLabel: block.querySelector('.error.selectHide'),
    infoIcon: block.querySelector('label .info-icon'),
    filterDescpOne: block.querySelector('.filterDescpOne'),
    filterDescpTwo: block.querySelector('.filterDescpTwo'),
  };
}