import handleSearch from './search.js';

export default function registerEvents({
  block,
  ui,
  settings,
  loadAllLocations,
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
        'select-hide',
      );

      ui.filterDescpOne.classList.toggle(
        'select-hide',
      );
    });
  }

  /*
   * Search button.
   */
 if (ui.searchBtn) {
  ui.searchBtn.addEventListener('click', async (event) => {
    event.preventDefault();

    const allLocations = await loadAllLocations();

    handleSearch({
      block,
      ui,
      settings,
      allLocations,
    });
  });
}

  /*
   * Search using Enter.
   */
  const ENTER_KEYS = new Set(['Enter']);
  ui.zipInput.addEventListener('keydown', async (event) => {
  const { key } = event;

  if (ENTER_KEYS.has(key)) {
    event.preventDefault();

    const allLocations = await loadAllLocations();

    handleSearch({
      block,
      ui,
      settings,
      allLocations,
    });
  }
});
}