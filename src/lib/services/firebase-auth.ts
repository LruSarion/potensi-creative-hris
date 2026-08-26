/**
 * Firebase & Google Auth Public Key Verification Service
 */

const FIREBASE_PUBLIC_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

interface CachedKeys {
  keys: Record<string, string> | any[];
  expiresAt: number;
}

let firebaseCertCache: CachedKeys | null = null;
let googleJwksCache: CachedKeys | null = null;

/**
 * Fetch Firebase Public X.509 Certificates for verifying Firebase ID tokens.
 * Caches responses based on HTTP max-age header.
 */
export async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (firebaseCertCache && firebaseCertCache.expiresAt > now) {
    return firebaseCertCache.keys as Record<string, string>;
  }

  try {
    const res = await fetch(FIREBASE_PUBLIC_CERTS_URL, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Firebase public certs: ${res.statusText}`);
    }

    // Parse Cache-Control header max-age
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    const certs = (await res.json()) as Record<string, string>;
    firebaseCertCache = {
      keys: certs,
      expiresAt: now + maxAgeSeconds * 1000,
    };
    return certs;
  } catch (error) {
    console.error("[Firebase Auth] Error fetching public certs:", error);
    if (firebaseCertCache) return firebaseCertCache.keys as Record<string, string>;
    throw error;
  }
}

/**
 * Fetch Google OIDC Public Keys (JWKS format).
 */
export async function getGoogleJwksKeys(): Promise<{ keys: any[] }> {
  const now = Date.now();
  if (googleJwksCache && googleJwksCache.expiresAt > now) {
    return { keys: googleJwksCache.keys as any[] };
  }

  try {
    const res = await fetch(GOOGLE_JWKS_URL, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google JWKS: ${res.statusText}`);
    }

    const data = await res.json();
    googleJwksCache = {
      keys: data.keys || [],
      expiresAt: now + 3600 * 1000,
    };
    return data;
  } catch (error) {
    console.error("[Google Auth] Error fetching JWKS:", error);
    if (googleJwksCache) return { keys: googleJwksCache.keys as any[] };
    throw error;
  }
}

/**
 * Helper to decode JWT payload without external binary dependency.
 */
export function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("[JWT Decode] Failed to parse JWT payload:", err);
    return null;
  }
}

/**
 * Helper to decode JWT header (containing `kid` and `alg`).
 */
export function decodeJwtHeader(token: string): { kid?: string; alg?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = parts[0];
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/");
    const jsonHeader = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonHeader);
  } catch (err) {
    console.error("[JWT Decode] Failed to parse JWT header:", err);
    return null;
  }
}
