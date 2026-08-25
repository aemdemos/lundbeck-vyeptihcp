export function createDropdown(block, mileBlock) {
// Custom Select dropdown start
  const radiusValues = [...block.querySelectorAll('#form-radius option')]
    .map((option) => option.value);

  
  mileBlock.className = 'locator-select-group mile-block';
  mileBlock.dataset.value = '25';

  const selected = document.createElement('div');
  selected.className = 'select';
  selected.append('25 miles ');

  const arrow = document.createElement('span');
  arrow.className = 'select-arrow';
  selected.append(arrow);

  const dropdown = document.createElement('div');
  dropdown.id = 'locator-distance';
  dropdown.className = 'dropdown-items selectHide';

  radiusValues.forEach((distance) => {
    const item = document.createElement('div');
    item.className = 'item';
    if (String(distance) === '25') {
      item.classList.add('selectedMiles');
    }
    item.dataset.value = distance;
    item.textContent = `${distance} miles`;
    dropdown.append(item);
  });

  mileBlock.append(selected, dropdown); 
}

export function initCustomDropdown(dropdownContainer, type = 'select', onSelectCallback = null) {
  if (!dropdownContainer) return null;

  const selectTrigger = dropdownContainer.querySelector('.select');
  const itemsContainer = dropdownContainer.querySelector('.dropdown-items');

  if (!selectTrigger || !itemsContainer) return null;

  // Click handler to open/close menu options panels
  selectTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    itemsContainer.classList.toggle('selectHide');
    selectTrigger.classList.toggle('active');
  });

  // Inner elements selection behavior routing logic
  itemsContainer.addEventListener('click', (e) => {
    e.stopPropagation();

    if (type === 'select') {
      const targetItem = e.target.closest('.item');
      if (!targetItem) return;

      itemsContainer.querySelectorAll('.item').forEach((item) => item.classList.remove('selectedMiles'));
      targetItem.classList.add('selectedMiles');

      const textValue = targetItem.textContent;
      const dataValue = targetItem.getAttribute('data-value');

      selectTrigger.textContent = '';

      selectTrigger.append(document.createTextNode(`${textValue} `));

      const arrow = document.createElement('span');
      arrow.className = 'select-arrow';

      selectTrigger.appendChild(arrow);
      dropdownContainer.setAttribute('data-value', dataValue);

      itemsContainer.classList.add('selectHide');
      selectTrigger.classList.remove('active');

      if (onSelectCallback) onSelectCallback(dataValue);
    }
    else if (type === 'checkbox') {
      const isCheckbox = e.target.matches('input[type="checkbox"]');
      const isLabel = e.target.matches('.label-text');

      if (!isCheckbox && !isLabel) return;

      const itemRow = e.target.closest('.item');
      const checkbox = itemRow?.querySelector('input[type="checkbox"]');

      if (isLabel && checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // Interface utility signature for cleaner execution closures
  return {
    close: () => {
      itemsContainer.classList.add('selectHide');
      selectTrigger.classList.remove('active');
    }
  };
}
