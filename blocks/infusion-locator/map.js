import { loadScript } from "../../scripts/aem.js";

let map;
let googleMaps;
const markers = [];

export async function initializeMap(apiKey) {
  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  );

  
  if (!window.google?.maps) {
    throw new Error("Google Maps failed to load");
  }

  googleMaps = window.google;

  const mapElement = document.querySelector('.locator-map');

  if (!mapElement) {
    throw new Error("Map container not found.");
  }

  map = new googleMaps.maps.Map(mapElement, {
    center: {
      lat: 37.09,
      lng: -95.71,
    },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    zoomControl: true,
  });

  return map;
}

export function getMap() {
  return map;
}

export function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers.length = 0;
}

export function addMarker(location, title, info) {
  if (!map || !googleMaps) {
    return;
  }

  const marker = new googleMaps.maps.Marker({
    position: location,
    map,
    title,
  });

  const infoWindow = new googleMaps.maps.InfoWindow({
    content: info,
  });

  marker.addListener("click", () => {
    infoWindow.open(map, marker);
  });

  markers.push(marker);
}

export async function geocodeZip(zip) {

  console.log("ZIP:", zip);
  if (!map) {
    throw new Error("Map has not been initialized.");
  }

  const geocoder = new googleMaps.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      {
        address: zip,
        componentRestrictions: {
          country: "US",
      },
      },
      (results, status) => {
        if (status === "OK" && results[0]) {
          const [{ geometry: { location } }] = results;

          resolve({
            lat: location.lat(),
            lng: location.lng(),
          });
        } else {
          reject(new Error(`Geocode failed: ${status}`));
        }
      },
    );
  });
}

export function centerMap(location, zoom = 10) {
  if (!map) {
    return;
  }

  map.setCenter(location);
  map.setZoom(zoom);
}