/**
 * Get API information.
 */
export function getApiInfo(block, documentSettings) {
  const apiKeyElement = block.querySelector(
    '#form-apikey',
  );

  const apiKey = apiKeyElement?.textContent.trim();

  if (!apiKey || !documentSettings?.apiEndpoint) {
    return null;
  }

  /*
   * Remove API key from rendered form.
   */
  apiKeyElement
    ?.closest('.field-wrapper')
    ?.remove();

  return {
    apiKey,
    apiEndpoint: documentSettings.apiEndpoint,
  };
}

/**
 * Load all locator records.
 */
export async function loadLocations(
  apiInfo,
  settings,
) {
  try {
    const params = new URLSearchParams({
      actionType: 'getLocatorRecords',
      showHcp: String(
        settings.showHcpData,
      ).toLowerCase(),
      showIC: String(
        settings.showInfusionCenters,
      ).toLowerCase(),
    });

    const apiUrl = `${apiInfo.apiEndpoint}?${params.toString()}`;

    const response = await fetch(
        apiUrl,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      throw new Error(
        `API returned ${response.status}`,
      );
    }

    const data = await response.json();

    return (
      data.result
      || data.providers
      || data
      || []
    );
  } catch (error) {
    // Log error in development only (avoid console output in production)
    if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
      /* eslint-disable-next-line no-console */
      console.error('Failed to load locator records:', error);
    }

    return [];
  }
}