// Code Starts for locator block configuration

export const DEFAULT_DISTANCES = ['5', '10', '25', '50','100', '200', '400'];
export const FACILITY_TYPES = [
  { key: 'infusionNetwork', label: 'VYEPTI Infusion Network', description: 'Filter by providers in the VYEPTI Infusion Network. These providers have partnered with Lundbeck to enhance the VYEPTI infusion experience by providing patient support, educational information, and coverage assistance.' },
  { key: 'nonHospital', label: 'Non–hospital-based locations', description: 'Remove hospital-based locations from search results. These locations can also include facilities associated with a hospital but located off-site.' },
  { key: 'homeInfusion', label: 'Home Infusion', description: 'A service provider who can facilitate infusions outside of the clinic, such as home or work.' },
];
export function getSettings(locator) {
  const config = readConfig(locator);

  const facilityCards = [];
  let index = 1; 

   while (config[`icon-${index}`]) {
    facilityCards.push({
      icon: config[`icon-${index}`],
      description: config[`icon-${index}-description`] || '',
      enabled: parseBool(config[`icon-${index}-enable`], true),
    });

    index++;
  }


  return {
    apiKey: config['google-maps-api-key'],
    apiEndpoint: config['api-endpoint'],
    heading: config.heading,
    facilityCards,
    showInfusionCenters: parseBool(config['show-infusion-centers'], true),
    showHcpData: parseBool(config['show-hcp-data'], false),
    showFilters: parseBool(config['show-filters'], false),
    distances: config.distances
      ? config.distances.split(',').map((d) => d.trim())
      : DEFAULT_DISTANCES,
  };
}


 
/**
* Parses a table/div-based DOM structure into a configuration object.
*/
export function readConfig(block) {
  const rows = block.querySelectorAll(':scope > div');
  const config = {};
  rows.forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase().replace(/\s+/g, '-');
      const value = cells[1];
      const img = value.querySelector('img');

      config[key] = img
        ? img.src
        : value.textContent.trim();
    }
  });
  return config;
}

/**
* Evaluates truthy string configurations into booleans.
*/
export function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return /^(true|yes|1|on)$/i.test(value);
}
// Code Ends for locator block configuration