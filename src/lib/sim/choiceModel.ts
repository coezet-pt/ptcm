/**
 * Choice model — multinomial logit for powertrain share targets
 * at 2045 and 2055. Returns PER-BUCKET shares [fix #3].
 */
import type { Powertrain, Bucket, VehicleSize } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  CHOICE_FACTORS,
  CHOICE_WEIGHT_DENOMINATOR,
  POWERTRAIN_RATINGS,
  START_OF_SUPPLY,
} from '@/lib/constants/extracted';
import type { BucketTCOMap } from './tco';

// Per-bucket, per-powertrain share
export type BucketShares = Record<string, Record<Powertrain, number>>;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function payloadRatio(bucket: Bucket, pt: Powertrain): number {
  // Simplified: diesel payload = gvw - ulw. Others have weight penalty for tanks/batteries.
  const dieselPayload = bucket.gvw - bucket.ulw;
  // For non-diesel, approximate weight penalty (could be refined)
  const penalty: Record<Powertrain, number> = {
    'Diesel': 0,
    'CNG': 200,
    'LNG': 300,
    'BET': bucket.betBatteryKWh * 8, // ~8 kg/kWh battery density
    'H2-ICE': bucket.h2TankKg * 40, // ~40 kg tank per kg H2
    'H2-FCET': bucket.fcetFuelCellKW * 4 + bucket.fcetBatteryKWh * 8 + bucket.h2TankKg * 40,
  };
  const ptPayload = Math.max(1, dieselPayload - penalty[pt]);
  return ptPayload / dieselPayload;
}

export function computeShares(
  tcoResults: BucketTCOMap,
  buckets: Bucket[],
  targetYear: number,
): BucketShares {
  const result: BucketShares = {};

  for (const bucket of buckets) {
    const tco = tcoResults[bucket.id];
    if (!tco) continue;

    const dieselTCO = tco['Diesel'].tcoPerKm;
    const dieselPrice = tco['Diesel'].vehiclePrice;
    const dieselPayloadRatio = 1.0;
    const dieselTAT = POWERTRAIN_RATINGS.tatGradeability['Diesel'];
    const dieselRange = POWERTRAIN_RATINGS.rangeFillingTime['Diesel'];

    const rawScores: Record<Powertrain, number> = {} as any;

    for (const pt of POWERTRAINS) {
      const supplyYear = START_OF_SUPPLY[bucket.size as VehicleSize]?.[pt] ?? 2025;
      if (targetYear < supplyYear) {
        rawScores[pt] = 0;
        continue;
      }

      // 5 factors
      const tcoArg = CHOICE_FACTORS.TCO.elasticity * CHOICE_FACTORS.TCO.weighting / CHOICE_WEIGHT_DENOMINATOR
        * (dieselTCO / tco[pt].tcoPerKm - 1);
      const priceArg = CHOICE_FACTORS.vehiclePrice.elasticity * CHOICE_FACTORS.vehiclePrice.weighting / CHOICE_WEIGHT_DENOMINATOR
        * (dieselPrice / tco[pt].vehiclePrice - 1);

      const plRatio = payloadRatio(bucket, pt);
      const payloadArg = CHOICE_FACTORS.ratedPayload.elasticity * CHOICE_FACTORS.ratedPayload.weighting / CHOICE_WEIGHT_DENOMINATOR
        * (dieselPayloadRatio / plRatio - 1);

      const tatRating = POWERTRAIN_RATINGS.tatGradeability[pt];
      const tatArg = CHOICE_FACTORS.tatGradeability.elasticity * CHOICE_FACTORS.tatGradeability.weighting / CHOICE_WEIGHT_DENOMINATOR
        * (dieselTAT / tatRating - 1);

      const rangeRating = POWERTRAIN_RATINGS.rangeFillingTime[pt];
      const rangeArg = CHOICE_FACTORS.rangeFillingTime.elasticity * CHOICE_FACTORS.rangeFillingTime.weighting / CHOICE_WEIGHT_DENOMINATOR
        * (dieselRange / rangeRating - 1);

      const score = Math.exp(clamp(tcoArg, -50, 50))
        + Math.exp(clamp(priceArg, -50, 50))
        + Math.exp(clamp(payloadArg, -50, 50))
        + Math.exp(clamp(tatArg, -50, 50))
        + Math.exp(clamp(rangeArg, -50, 50));

      rawScores[pt] = score;
    }

    // Normalize
    const total = POWERTRAINS.reduce((s, pt) => s + rawScores[pt], 0);
    const shares: Record<Powertrain, number> = {} as any;
    for (const pt of POWERTRAINS) {
      shares[pt] = total > 0 ? rawScores[pt] / total : 0;
    }

    result[bucket.id] = shares;
  }

  // DEBUG
  if (typeof window !== 'undefined' && (window as any).__SIM_DEBUG__) {
    const b1 = result['B1'];
    if (b1) {
      console.log(`[ChoiceModel DEBUG] Year=${targetYear} Bucket=B1`);
      for (const pt of POWERTRAINS) {
        console.log(`  ${pt}: share=${(b1[pt] * 100).toFixed(2)}%`);
      }
    }
  }

  return result;
}
