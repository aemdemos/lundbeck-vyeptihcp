import { createDropdown } from "../dropdown.js";

export function createSearch(block, form) {
    const search = document.createElement('div');
    search.className = 'locator-search';

    const mileBlock = document.createElement('div');

    createDropdown(block, mileBlock);

    removeRadiusField(form);

    const searchFields = [
        form.querySelector('#form-zipcode')?.closest('.field-wrapper'),
        mileBlock,
        form.querySelector('.submit-wrapper'),
    ];

    searchFields.forEach((field) => {
        if (field) {
            search.append(field);
        }
    });

    return search;
}

function removeRadiusField(form) {
    form.querySelector('#form-radius')?.remove();
    form.querySelector('#form-radius-label')?.remove();
}