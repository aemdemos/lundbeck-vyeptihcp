import { loadScript } from '../../scripts/aem.js';

let map;
let googleMaps;
const markers = [];

// Initialize autocomplete on keyup/input
export function initializeAutocomplete(inputElement) {
  if (!inputElement) {
    return null;
  }

  if (!googleMaps?.maps?.places?.Autocomplete) {
    console.error(
      'Google Places Autocomplete is not available.',
    );
    return null;
  }

  const autocomplete =
    new googleMaps.maps.places.Autocomplete(
      inputElement,
      {
        types: ['geocode'],
        componentRestrictions: {
          country: 'us',
        },
        fields: [
          'geometry',
          'formatted_address',
          'address_components',
        ],
      },
    );

  return autocomplete;
}


export async function initializeMap(apiKey) {
  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`,
  );

  if (!window.google?.maps) {
    throw new Error(
      'Google Maps failed to load',
    );
  }

  googleMaps = window.google;

  const mapElement =
    document.querySelector('.locator-map');

  if (!mapElement) {
    throw new Error(
      'Map container not found.',
    );
  }

  map = new googleMaps.maps.Map(
    mapElement,
    {
      center: {
        lat: 37.09,
        lng: -95.71,
      },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
    },
  );

  return map;
}


export function getMap() {
  return map;
}


/**
 * Remove all markers from the map.
 */
export function clearMarkers() {
  markers.forEach((marker) => {
    marker.setMap(null);
  });

  markers.length = 0;
}


/**
 * Create numbered marker icon.
 *
 * Network provider:
 *   RED
 *
 * Regular provider:
 *   BLUE
 */
function createMarkerIcon(number, isNetwork) {
  const color = isNetwork
    ? '#C72C5A'
    : '#39718C';

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="58"
      viewBox="0 0 48 58"
    >
      <path
        d="
          M24 1
          C11.3 1 1 11.3 1 24
          C1 40 24 57 24 57
          C24 57 47 40 47 24
          C47 11.3 36.7 1 24 1
          Z
        "
        fill="${color}"
      />

      <text
        x="24"
        y="30"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="#ffffff"
        font-family="Arial, sans-serif"
        font-size="16"
        font-weight="700"
      >
        ${number}
      </text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new googleMaps.maps.Size(32, 38),
    anchor: new googleMaps.maps.Point(24, 57),
  };
}


/**
 * Add a single marker.
 */
export function addMarker(
  location,
  title,
  info,
  number = 1,
  preferredIc = 'FALSE',
) {
  if (!map || !googleMaps) {
    return null;
  }

  const isNetwork =
    String(preferredIc)
      .trim()
      .toUpperCase() === 'TRUE';

  const marker =
    new googleMaps.maps.Marker({
      position: location,
      map,
      title,
      icon: createMarkerIcon(
        number,
        isNetwork,
      ),
    });

  const infoWindow =
    new googleMaps.maps.InfoWindow({
      content: info,
    });

  marker.addListener('click', () => {
    infoWindow.open(
      map,
      marker,
    );
  });

  markers.push(marker);

  return marker;
}


/**
 * Render all facility markers.
 *
 * The order is the same as filteredResults,
 * therefore marker number matches the result card.
 */
export function renderMarkers(
  facilities,
) {
  if (!map || !googleMaps) {
    return;
  }

  clearMarkers();

  facilities.forEach(
    (facility, index) => {
      const latitude =
        Number(facility.latitude);

      const longitude =
        Number(facility.longitude);

      if (
        Number.isNaN(latitude)
        || Number.isNaN(longitude)
      ) {
        return;
      }

      addMarker(
        {
          lat: latitude,
          lng: longitude,
        },
        facility.name,
        `
          <div>
            <strong>${facility.name}</strong>
          </div>
        `,
        index + 1,
        facility.preferredIc,
      );
    },
  );
}


/**
 * Geocode ZIP / city / state / address.
 */
export async function geocodeZip(zip) {
  console.log('ZIP:', zip);

  if (!map) {
    throw new Error(
      'Map has not been initialized.',
    );
  }

  const geocoder =
    new googleMaps.maps.Geocoder();

  return new Promise(
    (resolve, reject) => {
      geocoder.geocode(
        {
          address: zip,
          componentRestrictions: {
            country: 'US',
          },
        },
        (
          results,
          status,
        ) => {
          if (
            status === 'OK'
            && results[0]
          ) {
            const [
              {
                geometry: {
                  location,
                },
              },
            ] = results;

            resolve({
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            reject(
              new Error(
                `Geocode failed: ${status}`,
              ),
            );
          }
        },
      );
    },
  );
}


/**
 * Center map on the user's searched location.
 */
export function centerMap(
  location,
  zoom = 11,
) {
  if (!map || !location) {
    return;
  }

  map.setZoom(zoom);

  map.panTo({
    lat: location.lat,
    lng: location.lng,
  });
}


/**
 * Center map on a specific result marker.
 *
 * Used when clicking a result card.
 */
export function centerMapOnMarker(
  index,
  zoom = 14,
) {
  const marker = markers[index];

  if (!map || !marker) {
    return;
  }

  map.setZoom(zoom);
  map.panTo(
    marker.getPosition(),
  );
}