export default function createHeader(form) {
  const header = document.createElement('div');
  header.className = 'locator-header';

  const fields = [
    '#form-title',
    '#form-subtitle',
    '#form-requiredtext',
  ];

  fields.forEach((selector) => {
    const field = form.querySelector(selector)?.closest('.field-wrapper');

    if (field) {
      header.append(field);
    }
  });

  return header;
}