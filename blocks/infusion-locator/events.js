import handleSearch from './search.js';

export default function registerEvents({
  block,
  ui,
  settings,
  apiInfo,
  allLocations,
}) {
  /*
   * ZIP floating label.
   */
  if (ui.zipInput && ui.zipLabel) {
    ui.zipInput.addEventListener('focus', () => {
      ui.zipLabel.classList.add('focus');
    });

    ui.zipInput.addEventListener('blur', () => {
      if (!ui.zipInput.value.trim()) {
        ui.zipLabel.classList.remove('focus');
      }
    });
  }

  /*
   * Filter information toggle.
   */
  if (ui.infoIcon) {
    ui.infoIcon.addEventListener('click', (event) => {
      event.preventDefault();

      ui.filterDescpTwo.classList.toggle(
        'selectHide',
      );

      ui.filterDescpOne.classList.toggle(
        'selectHide',
      );
    });
  }

  /*
   * Search button.
   */
  ui.searchBtn.addEventListener('click', (event) => {
    event.preventDefault();

    handleSearch({
      block,
      ui,
      settings,
      apiInfo,
      allLocations,
    });
  });

  /*
   * Search using Enter.
   */
  ui.zipInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    handleSearch({
      block,
      ui,
      settings,
      apiInfo,
      allLocations,
    });
  });
}