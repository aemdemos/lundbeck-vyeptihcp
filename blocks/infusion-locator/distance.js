// It calculate the miles/distance  which is selected from miles drop down 

export default function getMiles(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const radLat1 = (Math.PI * lat1) / 180;
  const radLat2 = (Math.PI * lat2) / 180;

  const theta = lon1 - lon2;
  const radTheta = (Math.PI * theta) / 180;

  let dist =
    Math.sin(radLat1) * Math.sin(radLat2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.cos(radTheta);

  // Protect against floating-point precision errors.
  dist = Math.min(1, Math.max(-1, dist));

  dist = Math.acos(dist);
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515;

  return Number(dist.toFixed(1));
}