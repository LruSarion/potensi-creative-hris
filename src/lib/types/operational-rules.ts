export type GeoLocationRule = {
  cabang: string; // e.g. "Timoho", "Berbah", "Wiyoro"
  koordinat?: string; // e.g. "-7.7956, 110.3695"
  lat: number;
  lng: number;
  radiusMeter: number; // e.g. 100
  mode: "STRICT" | "WARNING";
};

/**
 * Parse coordinates string copied directly from Google Maps.
 * Supports:
 * - Direct: "-7.7956, 110.3695" or "-7.7956,110.3695"
 * - URL: "https://www.google.com/maps/@-7.7956,110.3695,15z"
 * - Plus code query: "?q=-7.7956,110.3695"
 */
export function parseGMapCoords(val: string): { lat: number; lng: number } | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();

  // URL format (@lat,lng or q=lat,lng)
  const urlMatch = trimmed.match(/[@=](-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Standard format: lat, lng
  const directMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

export type RoleOperationalRule = {
  enabled: boolean;
  wajibHadirMenit: number; // e.g. 15
  jendelaBukaMenit: number; // e.g. 120
  jendelaTutupMenit: number; // e.g. 60
  toleransiTerlambatMenit: number; // e.g. 0
  wajibAlasanTerlambat: boolean;
  geoLocations: GeoLocationRule[];
};

export type OperationalRulesConfig = {
  streamer: RoleOperationalRule;
  ots: RoleOperationalRule;
  staff: RoleOperationalRule;
};

export const DEFAULT_OPERATIONAL_RULES: OperationalRulesConfig = {
  streamer: {
    enabled: true,
    wajibHadirMenit: 15,
    jendelaBukaMenit: 120,
    jendelaTutupMenit: 60,
    toleransiTerlambatMenit: 0,
    wajibAlasanTerlambat: true,
    geoLocations: [
      { cabang: "Timoho", koordinat: "-7.7956, 110.3695", lat: -7.7956, lng: 110.3695, radiusMeter: 100, mode: "STRICT" },
      { cabang: "Berbah", koordinat: "-7.8085, 110.4421", lat: -7.8085, lng: 110.4421, radiusMeter: 100, mode: "WARNING" },
      { cabang: "Wiyoro", koordinat: "-7.8223, 110.4089", lat: -7.8223, lng: 110.4089, radiusMeter: 100, mode: "STRICT" },
    ],
  },
  ots: {
    enabled: true,
    wajibHadirMenit: 30,
    jendelaBukaMenit: 60,
    jendelaTutupMenit: 60,
    toleransiTerlambatMenit: 5,
    wajibAlasanTerlambat: true,
    geoLocations: [
      { cabang: "Timoho", koordinat: "-7.7956, 110.3695", lat: -7.7956, lng: 110.3695, radiusMeter: 100, mode: "STRICT" },
      { cabang: "Berbah", koordinat: "-7.8085, 110.4421", lat: -7.8085, lng: 110.4421, radiusMeter: 100, mode: "WARNING" },
      { cabang: "Wiyoro", koordinat: "-7.8223, 110.4089", lat: -7.8223, lng: 110.4089, radiusMeter: 100, mode: "STRICT" },
    ],
  },
  staff: {
    enabled: false,
    wajibHadirMenit: 0,
    jendelaBukaMenit: 60,
    jendelaTutupMenit: 120,
    toleransiTerlambatMenit: 10,
    wajibAlasanTerlambat: true,
    geoLocations: [
      { cabang: "Kantor Pusat", koordinat: "-7.7956, 110.3695", lat: -7.7956, lng: 110.3695, radiusMeter: 150, mode: "WARNING" },
    ],
  },
};
