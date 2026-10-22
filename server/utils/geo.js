const toRad = (deg) => (deg * Math.PI) / 180

// Great-circle distance in miles (UK shop, UK customers). Null when a coordinate is missing,
// so a branch without lat/lng sorts last instead of producing NaN.
export function distanceMiles(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return null
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Nearest first; branches with no distance go last.
export function byDistance(branches, origin) {
  return branches
    .map((b) => ({ ...b, distanceMiles: distanceMiles(origin, b) }))
    .sort((x, y) => (x.distanceMiles ?? Infinity) - (y.distanceMiles ?? Infinity))
}
