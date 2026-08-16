// Code Starts for locator block configuration

export const DEFAULT_DISTANCES = ['5', '10', '25', '50','100', '200', '400'];

export function getSettings(block, apiInfo) {

 // const config = readConfig(block); 
 alert(apiInfo.showHcpData);
   return {
    apiKey: apiInfo.apiKey,
    apiEndpoint: apiInfo.apiEndpoint,
    showInfusionCenters: parseBool(apiInfo.showInfusionCenters, true),
    showHcpData: parseBool(apiInfo.showHcpData, false),
    showFilters: parseBool(apiInfo.showFilters, false),
    distances: apiInfo.distances
      ? apiInfo.distances.split(',').map((d) => d.trim())
      : DEFAULT_DISTANCES,
  };
}
 
/**
* Evaluates truthy string configurations into booleans.
*/
export function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return /^(true|yes|1|on)$/i.test(value);
}
// Code Ends for locator block configuration