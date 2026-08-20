export type TierBand = {
  tier: string;
  jamMinimal: number;
  jamMaksimal: number;
  ratePerJam: number;
};

/**
 * Pure tier-matching: given bands and a total jam, return the matching band or null.
 */
export function matchTier(bands: TierBand[], totalJam: number): TierBand | null {
  for (const b of bands) {
    if (totalJam >= b.jamMinimal && totalJam <= b.jamMaksimal) {
      return b;
    }
  }
  return null;
}
