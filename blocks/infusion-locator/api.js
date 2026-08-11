import { geocodeZip, centerMap } from "./map.js";
import  mockdata  from "./mockData.js";

const USE_MOCK_DATA = true;

export function getApiKey(block) {
  const apiKeyElement = block.querySelector('#form-apikey');

  if (!apiKeyElement) {
    return null;
  }

  const apiKey = apiKeyElement.textContent.trim();

  // Remove the rendered field from the page
  apiKeyElement.closest('.field-wrapper')?.remove();

  return apiKey;
}

export async function searchLocations(
  zip,
  distance,
  settings,
  activeFilters = [],
) {
  const coords = await geocodeZip(zip);
  centerMap(coords, 10);

  if (USE_MOCK_DATA) {
    return mockdata.result;
  }

  try {
    const params = new URLSearchParams({
      latitude: coords.lat,
      longitude: coords.lng,
      radius: distance,
      showIC: settings.showInfusionCenters,
      showHCPData: settings.showHcpData,
    });

    activeFilters.forEach((filter) => {
      params.append("filter", filter);
    });

    const response = await fetch(`${settings.apiEndpoint}?${params}`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    return data.results || data.providers || data || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}