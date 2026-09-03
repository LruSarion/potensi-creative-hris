import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  DEFAULT_OPERATIONAL_RULES,
  type OperationalRulesConfig,
  type RoleOperationalRule,
  type GeoLocationRule,
} from "@/lib/types/operational-rules";

export {
  DEFAULT_OPERATIONAL_RULES,
  type OperationalRulesConfig,
  type RoleOperationalRule,
  type GeoLocationRule,
};

/**
 * Fetch operational rules from Tenant.config, merging with safe defaults.
 */
export async function getOperationalRules(tenantId?: string | null): Promise<OperationalRulesConfig> {
  if (!tenantId) return DEFAULT_OPERATIONAL_RULES;

  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });

    const cfg = (tenant?.config as Record<string, any> | null) ?? {};
    const saved = cfg.operationalRules as Partial<OperationalRulesConfig> | undefined;

    if (!saved) return DEFAULT_OPERATIONAL_RULES;

    return {
      streamer: { ...DEFAULT_OPERATIONAL_RULES.streamer, ...(saved.streamer ?? {}) },
      ots: { ...DEFAULT_OPERATIONAL_RULES.ots, ...(saved.ots ?? {}) },
      staff: { ...DEFAULT_OPERATIONAL_RULES.staff, ...(saved.staff ?? {}) },
    };
  } catch (err) {
    console.error("Error reading operational rules:", err);
    return DEFAULT_OPERATIONAL_RULES;
  }
}

/**
 * Update operational rules in Tenant.config.
 */
export async function updateOperationalRules(
  tenantId: string | null | undefined,
  input: Partial<OperationalRulesConfig>
): Promise<OperationalRulesConfig> {
  if (!tenantId) {
    const firstTenant = await db.tenant.findFirst();
    if (!firstTenant) throw AppError.badRequest("Tenant belum dibuat.");
    tenantId = firstTenant.id;
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw AppError.notFound("Tenant tidak ditemukan.");

  const currentConfig = (tenant.config as Record<string, any> | null) ?? {};
  const currentRules = (currentConfig.operationalRules as Partial<OperationalRulesConfig> | undefined) ?? {};

  const mergedRules: OperationalRulesConfig = {
    streamer: {
      ...DEFAULT_OPERATIONAL_RULES.streamer,
      ...(currentRules.streamer ?? {}),
      ...(input.streamer ?? {}),
    },
    ots: {
      ...DEFAULT_OPERATIONAL_RULES.ots,
      ...(currentRules.ots ?? {}),
      ...(input.ots ?? {}),
    },
    staff: {
      ...DEFAULT_OPERATIONAL_RULES.staff,
      ...(currentRules.staff ?? {}),
      ...(input.staff ?? {}),
    },
  };

  const updatedConfig = {
    ...currentConfig,
    operationalRules: mergedRules,
  };

  await db.tenant.update({
    where: { id: tenantId },
    data: { config: updatedConfig },
  });

  return mergedRules;
}

/**
 * Calculate distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Parse latitude and longitude from location text like "Lat: -7.795600, Lng: 110.369500 (±15m)".
 */
export function parseCoordinates(lokasiStr?: string | null): { lat: number; lng: number } | null {
  if (!lokasiStr) return null;
  const match = lokasiStr.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/i);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

export type GeoValidationResult = {
  valid: boolean;
  distanceMeters?: number;
  radiusMeters?: number;
  mode?: "STRICT" | "WARNING";
  cabang?: string;
  message?: string;
  skipped?: boolean;
};

/**
 * Validate user check-in coordinates against studio branch configuration.
 */
export function validateGeoLocation(
  lokasiStr: string | null | undefined,
  cabangStudio: string | null | undefined,
  geoRules: GeoLocationRule[]
): GeoValidationResult {
  if (!geoRules || geoRules.length === 0) {
    return { valid: true, skipped: true };
  }

  // Find matching studio branch rule
  const normCabang = (cabangStudio || "").trim().toLowerCase();
  let matchedRule = geoRules.find((r) => {
    const rc = r.cabang.trim().toLowerCase();
    return rc === normCabang || normCabang.includes(rc) || rc.includes(normCabang);
  });

  // If no exact match found, fallback to the first configured rule if available
  if (!matchedRule && geoRules.length > 0) {
    matchedRule = geoRules[0];
  }

  if (!matchedRule) {
    return { valid: true, skipped: true };
  }

  const coords = parseCoordinates(lokasiStr);
  if (!coords) {
    if (matchedRule.mode === "STRICT") {
      return {
        valid: false,
        mode: matchedRule.mode,
        cabang: matchedRule.cabang,
        message: `Koordinat GPS lokasi tidak valid atau tidak terdeteksi untuk Studio ${matchedRule.cabang}.`,
      };
    }
    return { valid: true, skipped: true };
  }

  const distance = calculateDistanceMeters(
    coords.lat,
    coords.lng,
    matchedRule.lat,
    matchedRule.lng
  );

  const withinRadius = distance <= matchedRule.radiusMeter;

  if (withinRadius) {
    return {
      valid: true,
      distanceMeters: distance,
      radiusMeters: matchedRule.radiusMeter,
      mode: matchedRule.mode,
      cabang: matchedRule.cabang,
    };
  }

  return {
    valid: matchedRule.mode !== "STRICT", // if warning, still valid to check-in
    distanceMeters: distance,
    radiusMeters: matchedRule.radiusMeter,
    mode: matchedRule.mode,
    cabang: matchedRule.cabang,
    message: `Anda terdeteksi berada ${distance}m dari Studio ${matchedRule.cabang} (Radius toleransi: ${matchedRule.radiusMeter}m).`,
  };
}
