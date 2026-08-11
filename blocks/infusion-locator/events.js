import handleSearch  from './search.js';

export default function registerEvents({
  block,
  ui,
  settings,
}) {

  // Handle CSS class toggles on floating element input labels
  if (ui.zipInput && ui.zipLabel) {
    ui.zipInput.addEventListener('focus', () => ui.zipLabel.classList.add('focus'));

    ui.zipInput.addEventListener('blur', () => {
      if (!ui.zipInput.value.trim()) {
        ui.zipLabel.classList.remove('focus');
      }
    });

  }

  if(ui.infoIcon) {
    ui.infoIcon.addEventListener('click', () => { 
      ui.filterDescpTwo.classList.toggle('selectHide');
      ui.filterDescpOne.classList.toggle('selectHide');
    });
  }

  ui.searchBtn.addEventListener(
    'click',
    (el) => {
            el.preventDefault();
            handleSearch({
              block,
              ui,
              settings,
            });
        } 
  );

  ui.zipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSearch({
        block,
        ui,
        settings,
      });
    }
  });
}