export type GeoLocationRule = {
  cabang: string; // e.g. "Timoho", "Berbah", "Wiyoro"
  lat: number;
  lng: number;
  radiusMeter: number; // e.g. 100
  mode: "STRICT" | "WARNING";
};

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
      { cabang: "Timoho", lat: -7.7956, lng: 110.3695, radiusMeter: 100, mode: "STRICT" },
      { cabang: "Berbah", lat: -7.8085, lng: 110.4421, radiusMeter: 100, mode: "WARNING" },
      { cabang: "Wiyoro", lat: -7.8223, lng: 110.4089, radiusMeter: 100, mode: "STRICT" },
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
      { cabang: "Timoho", lat: -7.7956, lng: 110.3695, radiusMeter: 100, mode: "STRICT" },
      { cabang: "Berbah", lat: -7.8085, lng: 110.4421, radiusMeter: 100, mode: "WARNING" },
      { cabang: "Wiyoro", lat: -7.8223, lng: 110.4089, radiusMeter: 100, mode: "STRICT" },
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
      { cabang: "Kantor Pusat", lat: -7.7956, lng: 110.3695, radiusMeter: 150, mode: "WARNING" },
    ],
  },
};
