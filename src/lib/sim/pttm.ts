/**
 * PTTM — Powertrain Transition Trajectory Model
 * Gompertz for BET/H2-ICE/H2-FCET, Weibull for CNG/LNG.
 * Runs per-bucket, aggregates final sales [fix #3].
 */
import type { Powertrain, Bucket, VehicleSize } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  BUCKETS,
  TIV_PROJECTION,
  START_OF_SUPPLY,
  PTTM_PILOT_SHARE,
  WEIBULL_SHAPE_ALPHA,
  WEIBULL_PEAK_YEAR,
  CNG_UNITS_2025,
  LNG_UNITS_2025,
  OTHER_DIESEL_TIV_SHARE,
} from '@/lib/constants/extracted';
import type { PolicyConfig } from '@/lib/types';
import type { BucketShares } from './choiceModel';
import { START_YEAR, END_YEAR, YEAR_COUNT } from './timeSeries';

export interface AnnualPTSales {
  share: Record<Powertrain, number>;
  sales: Record<Powertrain, number>;
}

/** Gompertz S-curve for BET/H2-ICE/H2-FCET per bucket [fix #2] */
function gompertzCurve(
  startYear: number,
  inflectionYear: number,
  W: number,    // pilot share at start
  AB: number,   // 2055 target share from choice model
): number[] {
  const shares = new Array(YEAR_COUNT).fill(0);
  if (AB <= 0 || startYear > END_YEAR) return shares;

  // Exact order [fix #2]:
  const a_initial = Math.max(AB, W * 1.02);
  const b = Math.log(Math.max(a_initial, W * 1.01) / W);
  const inflDelta = Math.max(inflectionYear - startYear, 1);
  const c = -(1 / inflDelta) * Math.log(
    Math.log(Math.max(a_initial, 0.1001) / 0.1) / Math.max(b, 0.001)
  );
  const endDelta = END_YEAR - startYear;
  const normFactor = Math.exp(-b * Math.exp(-c * endDelta));
  const a_final = normFactor > 0 ? AB / normFactor : AB;

  // DEBUG
  if (typeof window !== 'undefined' && (window as any).__SIM_DEBUG__) {
    console.log(`[PTTM Gompertz] W=${W}, AB=${AB.toFixed(4)}, a_init=${a_initial.toFixed(4)}, b=${b.toFixed(4)}, c=${c.toFixed(6)}, a_final=${a_final.toFixed(4)}`);
  }

  for (let i = 0; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    if (year < startYear) {
      shares[i] = 0;
      continue;
    }
    const t = year - startYear;
    shares[i] = a_final * Math.exp(-b * Math.exp(-c * t)) / Math.exp(-b * Math.exp(-c * endDelta));
  }

  return shares;
}

/** Weibull curve for CNG/LNG per bucket [fix #1] */
function weibullCurve(
  startYear: number,
  peakShare: number, // from shares2045 [fix #1]
  pt: 'CNG' | 'LNG',
): number[] {
  const shares = new Array(YEAR_COUNT).fill(0);
  if (peakShare <= 0 || startYear > END_YEAR) return shares;

  const alpha = WEIBULL_SHAPE_ALPHA;
  const peakYear = WEIBULL_PEAK_YEAR;
  const peakDelta = peakYear - startYear;
  if (peakDelta <= 0) return shares;

  // Normalisation at peak (2045)
  const refT = (2045 - startYear) / peakDelta;
  const normVal = Math.pow(refT, alpha - 1)
    * Math.exp(((alpha - 1) / alpha) * (1 - Math.pow(refT, alpha)));
  const W = normVal > 0 ? peakShare / normVal : peakShare;

  for (let i = 0; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    if (year < startYear) continue;
    const t = (year - startYear) / peakDelta;
    if (t <= 0) continue;
    shares[i] = W * Math.pow(t, alpha - 1)
      * Math.exp(((alpha - 1) / alpha) * (1 - Math.pow(t, alpha)));
  }

  // Anchor check [fix #1]: warn if 2025 share deviates >50% from historical
  const anchor2025 = pt === 'CNG'
    ? CNG_UNITS_2025 / TIV_PROJECTION[2025]
    : LNG_UNITS_2025 / TIV_PROJECTION[2025];
  const computed2025 = shares[0];
  if (anchor2025 > 0 && Math.abs(computed2025 - anchor2025) / anchor2025 > 0.5) {
    console.warn(`[PTTM] ${pt} Weibull 2025 share ${(computed2025 * 100).toFixed(2)}% deviates >50% from anchor ${(anchor2025 * 100).toFixed(2)}%`);
  }

  return shares;
}

const GOMPERTZ_PTS: Powertrain[] = ['BET', 'H2-ICE', 'H2-FCET'];
const WEIBULL_PTS: ('CNG' | 'LNG')[] = ['CNG', 'LNG'];

export function computePTTM(
  shares2045: BucketShares,
  shares2055: BucketShares,
  policy: PolicyConfig,
  buckets: Bucket[] = BUCKETS,
): AnnualPTSales[] {
  // Per-year aggregated sales
  const annual: AnnualPTSales[] = [];
  for (let i = 0; i < YEAR_COUNT; i++) {
    annual.push({
      share: { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 },
      sales: { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 },
    });
  }

  const inflectionYears: Record<string, number> = {
    'BET': policy.bet_inflection_year,
    'H2-ICE': policy.h2ice_inflection_year,
    'H2-FCET': policy.fcet_inflection_year,
  };

  // Run per bucket, accumulate weighted shares
  for (const bucket of buckets) {
    const size = bucket.size as VehicleSize;
    const weight = bucket.tivShare2045;

    // Gompertz PTs
    for (const pt of GOMPERTZ_PTS) {
      const startYear = START_OF_SUPPLY[size]?.[pt] ?? 2025;
      const W = PTTM_PILOT_SHARE[pt as keyof typeof PTTM_PILOT_SHARE] ?? 0.0001;
      const AB = shares2055[bucket.id]?.[pt] ?? 0;
      const inflYear = inflectionYears[pt] ?? 2038;
      const curve = gompertzCurve(startYear, inflYear, W, AB);

      for (let i = 0; i < YEAR_COUNT; i++) {
        annual[i].share[pt] += curve[i] * weight;
      }
    }

    // Weibull PTs
    for (const pt of WEIBULL_PTS) {
      const startYear = START_OF_SUPPLY[size]?.[pt] ?? 2025;
      const peakShare = shares2045[bucket.id]?.[pt] ?? 0;
      const curve = weibullCurve(startYear, peakShare, pt);

      for (let i = 0; i < YEAR_COUNT; i++) {
        annual[i].share[pt] += curve[i] * weight;
      }
    }
  }

  // Post-processing [A5d]: cap non-diesel, compute diesel as residual
  for (let i = 0; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    const tiv = TIV_PROJECTION[year] ?? 0;
    const s = annual[i].share;

    const nonDieselSum = s.CNG + s.LNG + s.BET + s['H2-ICE'] + s['H2-FCET'];
    if (nonDieselSum > 1.0) {
      const scale = 1.0 / nonDieselSum;
      for (const pt of [...GOMPERTZ_PTS, ...WEIBULL_PTS] as Powertrain[]) {
        s[pt] *= scale;
      }
    }
    s.Diesel = Math.max(0, 1 - (s.CNG + s.LNG + s.BET + s['H2-ICE'] + s['H2-FCET']));

    // Sales = share × TIV; diesel also gets OTHER_DIESEL_TIV_SHARE
    for (const pt of POWERTRAINS) {
      annual[i].sales[pt] = s[pt] * tiv;
    }
    // Add "Other" diesel share
    annual[i].sales.Diesel += OTHER_DIESEL_TIV_SHARE * tiv;
  }

  return annual;
}
