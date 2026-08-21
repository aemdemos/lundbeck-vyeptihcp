export const DEFAULT_DISTANCES = [
  '5',
  '10',
  '25',
  '50',
  '100',
  '200',
  '400',
];

/**
 * Parse block configuration.
 */
export function readConfig(block) {
  const rows = block.querySelectorAll(':scope > div');
  const config = {};

  rows.forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');

    if (cells.length < 2) return;

    const key = cells[0].textContent
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const value = cells[1];
    const image = value.querySelector('img');

    config[key] = image
      ? image.src
      : value.textContent.trim();
  });

  return config;
}

/**
 * Convert string configuration to boolean.
 */
export function parseBool(value, fallback = false) {
  if (value === undefined || value === '') {
    return fallback;
  }

  return /^(true|yes|1|on)$/i.test(value);
}

/**
 * Get sheet/form configuration.
 */
export function getSettings(block) {
  const config = readConfig(block);

  return {
    distances: config.distances
      ? config.distances
        .split(',')
        .map((distance) => distance.trim())
      : DEFAULT_DISTANCES,
  };
}