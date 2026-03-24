/** Geocodare Mapbox (forward). Returnează [lat, lng] sau null. */
export async function geocodeAddress(address: string, token: string): Promise<[number, number] | null> {
  const q = address.trim();
  if (!q || !token.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const features = data?.features ?? [];
    if (features[0]?.center) {
      const [lng, lat] = features[0].center as [number, number];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
  } catch {
    // ignore
  }
  return null;
}
