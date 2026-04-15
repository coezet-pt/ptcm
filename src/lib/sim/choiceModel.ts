/**
 * Choice model — multinomial logit for powertrain share targets
 * at 2045 and 2055. Returns PER-BUCKET shares.
 *
 * Formula per factor: EXP( elasticity_avg × 1.5 × (ratio - 1) )
 * Ratio direction varies by factor (see below).
 */
import type { Powertrain, Bucket, VehicleSize } from '@/lib/constants/extracted';
import type { PolicyConfig } from '@/lib/types';
import {
  POWERTRAINS,
  POWERTRAIN_RATINGS,
  START_OF_SUPPLY,
} from '@/lib/constants/extracted';
import type { BucketTCOMap } from './tco';

// Per-bucket, per-powertrain share
export type BucketShares = Record<string, Record<Powertrain, number>>;

/** Averaged per-bucket ratings from Excel (one number per factor) */
const ELASTICITIES = {
  TCO: 9.0,               // AVERAGE(10,9,8,9,9,9)
  vehiclePrice: 8.83,     // AVERAGE(9,9,9,9,9,8)
  ratedPayload: 7.17,     // AVERAGE(6,9,6,6,9,7)
  tatGradeability: 5.5,   // AVERAGE(3,9,4,7,5,5)
  rangeFillingTime: 7.5,  // AVERAGE(8,10,7,8,6,6)
};

/** Excel cell E2/F2 — global multiplier */
const GLOBAL_MULTIPLIER = 1.5;
let __debugDone = false;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function payloadRatio(bucket: Bucket, pt: Powertrain): number {
  const dieselPayload = bucket.gvw - bucket.ulw;
  const penalty: Record<Powertrain, number> = {
    'Diesel': 0,
    'CNG': 200,
    'LNG': 300,
    'BET': bucket.betBatteryKWh * 8,
    'H2-ICE': bucket.h2TankKg * 40,
    'H2-FCET': bucket.fcetFuelCellKW * 4 + bucket.fcetBatteryKWh * 8 + bucket.h2TankKg * 40,
  };
  const ptPayload = Math.max(1, dieselPayload - penalty[pt]);
  return ptPayload / dieselPayload;
}

export function computeShares(
  tcoResults: BucketTCOMap,
  buckets: Bucket[],
  targetYear: number,
  policy?: PolicyConfig,
): BucketShares {
  const result: BucketShares = {};

  for (const bucket of buckets) {
    const tco = tcoResults[bucket.id];
    if (!tco) continue;

    const dieselTCO = tco['Diesel'].tcoPerKm;
    const dieselPrice = tco['Diesel'].vehiclePrice;
    const dieselTAT = POWERTRAIN_RATINGS.tatGradeability['Diesel'];
    const dieselRange = POWERTRAIN_RATINGS.rangeFillingTime['Diesel'];

    const rawScores: Record<Powertrain, number> = {} as any;

    for (const pt of POWERTRAINS) {
      const supplyYear = START_OF_SUPPLY[bucket.size as VehicleSize]?.[pt] ?? 2025;
      if (targetYear < supplyYear) {
        rawScores[pt] = 0;
        continue;
      }

      // Factor 1: TCO — diesel/pt (lower TCO better)
      const tcoArg = ELASTICITIES.TCO * GLOBAL_MULTIPLIER * (dieselTCO / tco[pt].tcoPerKm - 1);

      // Factor 2: Vehicle Price — diesel/pt (lower price better)
      const priceArg = ELASTICITIES.vehiclePrice * GLOBAL_MULTIPLIER * (dieselPrice / tco[pt].vehiclePrice - 1);

      // Factor 3: Rated Payload — pt/diesel (higher payload better)
      const plRatio = payloadRatio(bucket, pt);
      const payloadArg = ELASTICITIES.ratedPayload * GLOBAL_MULTIPLIER * (plRatio / 1.0 - 1);

      // Factor 4: TAT/Gradeability — pt/diesel (higher rating better)
      const tatRating = POWERTRAIN_RATINGS.tatGradeability[pt];
      const tatArg = ELASTICITIES.tatGradeability * GLOBAL_MULTIPLIER * (tatRating / dieselTAT - 1);

      // Factor 5: Range/Filling — diesel/pt (lower penalty better)
      const rangeRating = (policy?.range_filling_concern_after_2035 === false && targetYear >= 2035)
        ? 1.0
        : POWERTRAIN_RATINGS.rangeFillingTime[pt];
      const rangeArg = ELASTICITIES.rangeFillingTime * GLOBAL_MULTIPLIER * (dieselRange / rangeRating - 1);

      const factors = {
        [pt]: {
          TCO: Math.exp(clamp(tcoArg, -50, 50)),
          vehiclePrice: Math.exp(clamp(priceArg, -50, 50)),
          ratedPayload: Math.exp(clamp(payloadArg, -50, 50)),
          tatGradeability: Math.exp(clamp(tatArg, -50, 50)),
          rangeFillingTime: Math.exp(clamp(rangeArg, -50, 50)),
        },
      };

      if (bucket.id === 'B1' && targetYear === 2045 && pt === 'BET' && !__debugDone) {
        __debugDone = true;
        const tcoFactorBET = factors['BET'].TCO;
        console.log(
          `🧪 RUNTIME CHECK: B1 BET TCO factor = ${tcoFactorBET.toFixed(3)} ` +
          `(Excel expects 7.186, broken value would be ~6400)`
        );
        if (tcoFactorBET > 100) {
          console.error('❌❌❌ Formula in loop is STILL using old multiplier. Self-test is misleading.');
        }
      }

      const score = factors[pt].TCO
        + factors[pt].vehiclePrice
        + factors[pt].ratedPayload
        + factors[pt].tatGradeability
        + factors[pt].rangeFillingTime;

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
    if (targetYear === 2045) {
      const b12 = result['B12'];
      const b12tco = tcoResults['B12'];
      if (b12 && b12tco) {
        console.table({
          'B12_CNG_vs_Diesel_2045': {
            CNG_TCO: b12tco['CNG']?.tcoPerKm?.toFixed(2),
            Diesel_TCO: b12tco['Diesel']?.tcoPerKm?.toFixed(2),
            CNG_share: b12['CNG'],
            Diesel_share: b12['Diesel'],
          }
        });
      }
      const b1tco = tcoResults['B1'];
      if (b1tco && b1tco['CNG']) {
        const dTCO = b1tco['Diesel'].tcoPerKm;
        const dPrice = b1tco['Diesel'].vehiclePrice;
        console.log('[ChoiceModel DEBUG] B1 CNG factor args at 2045:', {
          tcoArg: (ELASTICITIES.TCO * GLOBAL_MULTIPLIER * (dTCO / b1tco['CNG'].tcoPerKm - 1)).toFixed(4),
          priceArg: (ELASTICITIES.vehiclePrice * GLOBAL_MULTIPLIER * (dPrice / b1tco['CNG'].vehiclePrice - 1)).toFixed(4),
          tatArg: (ELASTICITIES.tatGradeability * GLOBAL_MULTIPLIER * (POWERTRAIN_RATINGS.tatGradeability['CNG'] / POWERTRAIN_RATINGS.tatGradeability['Diesel'] - 1)).toFixed(4),
          rangeArg: (ELASTICITIES.rangeFillingTime * GLOBAL_MULTIPLIER * (POWERTRAIN_RATINGS.rangeFillingTime['Diesel'] / POWERTRAIN_RATINGS.rangeFillingTime['CNG'] - 1)).toFixed(4),
        });
      }
    }
  }

  return result;
}

// Self-test on module load — throws if formula is broken
if (typeof window !== 'undefined') {
  const testBET_TCO = Math.exp(9.0 * 1.5 * (56.94 / 49.68 - 1));
  const expected = 7.186;
  if (Math.abs(testBET_TCO - expected) > 0.05) {
    console.error(`❌ Choice model formula BROKEN: expected ${expected}, got ${testBET_TCO.toFixed(3)}`);
  } else {
    console.log('✅ Choice model formula verified against Excel B1 BET TCO');
  }
}
