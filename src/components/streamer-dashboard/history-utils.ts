// Image URL + GPS coordinate helpers shared by the streamer dashboard page
// and the History tab modals. Extracted verbatim from page.tsx (refactor only).

/** Resolve a photo reference (data URI, absolute URL, or Drive file id) to a displayable URL. */
export function resolveImageUrl(val: string | null | undefined): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1200`;
}

/** Parse "Lat: -7.79, Lng: 110.36" or raw "-7.7956, 110.3695" into coordinates. */
export function parseCoordinates(locationStr: string | null | undefined): { lat: number; lng: number } | null {
  if (!locationStr) return null;
  // 1. Try matching Lat: ... and Lng/Long: ...
  const latMatch = locationStr.match(/lat(?:itude)?:\s*([-+]?\d+(?:\.\d+)?)/i);
  const lngMatch = locationStr.match(/l(?:ng|ong(?:itude)?):\s*([-+]?\d+(?:\.\d+)?)/i);
  if (latMatch && lngMatch) {
    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lngMatch[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. Try matching raw "-7.7956, 110.3695"
  const rawMatch = locationStr.match(/([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}