import renderDescription from "./regex.js";

export function createFilters(form, inputField, inputFieldLabel) {
  const filters = document.createElement('div');
  filters.className = 'locator-filters';

  appendFilterFields(form, filters);

createFilterDescription(form, inputField, inputFieldLabel);

  const error = createErrorMessage();

  filters.append(error);

  return filters;
}



function appendFilterFields(form, filters) {
  const fields = [
    form.querySelector('#form-networkonly')?.closest('.field-wrapper'),
    form.querySelector('#form-hidehospital')?.closest('.field-wrapper'),
  ];

  fields.forEach((field) => {
    if (field) {
      filters.append(field);
    }
  });
}

function createFilterDescription(form, inputField, inputFieldLabel) {

  const descriptionOne = form.querySelector('#form-filter-description');
  const descriptionTwo = form.querySelector('#form-child-info');

  if (
    !inputFieldLabel
    || !inputField
    || !descriptionOne
    || !descriptionTwo
  ) {
    return;
  }

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'labelWraper';

  const label = document.createElement('label');
  label.htmlFor = 'form-networkonly';

  label.innerHTML = renderDescription(
    inputFieldLabel.textContent.trim(),
  );

  const infoIcon = label.querySelector('img');

  if (infoIcon) {
    infoIcon.className = 'info-icon';
  }

  const filterDescriptionOne = document.createElement('div');
  filterDescriptionOne.className = 'filterDescpOne';
  filterDescriptionOne.innerHTML = renderDescription(
    descriptionOne.textContent.trim(),
  );

  const filterDescriptionTwo = document.createElement('div');
  filterDescriptionTwo.className = 'filterDescpTwo selectHide';
  filterDescriptionTwo.innerHTML = renderDescription(
    descriptionTwo.textContent.trim(),
  );

  inputFieldLabel.parentNode.insertBefore(
    labelWrapper,
    inputFieldLabel,
  );

  labelWrapper.append(
    label,
    filterDescriptionOne,
    filterDescriptionTwo,
  );

  inputFieldLabel.remove();
  descriptionOne.remove();
  descriptionTwo.remove();
}

function createErrorMessage() {
  const error = document.createElement('p');

  error.className = 'error selectHide';
  error.textContent = 'Please enter a valid city, state, or ZIP code, and try again.';

  return error;
}

