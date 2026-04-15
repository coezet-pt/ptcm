/**
 * Time-series projection — builds year-by-year arrays (2025–2055)
 * for all 15 cost parameters using compound growth per period.
 */
import type { ParameterKey, ScenarioConfig } from '@/lib/types';

export const START_YEAR = 2025;
export const END_YEAR = 2055;
export const YEAR_COUNT = END_YEAR - START_YEAR + 1; // 31

const GROWTH_RATE_KEYS: ParameterKey[] = [
  'diesel_vehicle_growth',
  'engine_trans_growth',
  'e_powertrain_growth',
];

/**
 * For each parameter, compound-grow from baseValue through 4 delta periods.
 * Growth-rate keys (diesel_vehicle_growth etc.) start at 1.0 and store
 * cumulative multiplier rather than absolute values.
 */
export function buildTimeSeries(
  params: ScenarioConfig['parameters'],
): Record<ParameterKey, number[]> {
  const result = {} as Record<ParameterKey, number[]>;

  for (const key of Object.keys(params) as ParameterKey[]) {
    const p = params[key];
    const isGrowthRate = GROWTH_RATE_KEYS.includes(key);
    const arr: number[] = new Array(YEAR_COUNT);

    arr[0] = isGrowthRate ? 1.0 : p.baseValue;

    for (let i = 1; i < YEAR_COUNT; i++) {
      const year = START_YEAR + i;
      let delta: number;
      if (year <= 2030) delta = p.d2630;
      else if (year <= 2040) delta = p.d3140;
      else if (year <= 2050) delta = p.d4150;
      else delta = p.d5155;

      arr[i] = arr[i - 1] * (1 + delta);
    }

    result[key] = arr;
  }

  return result;
}

/** Get value at a specific year from a time-series array. */
export function getValueAtYear(series: number[], year: number): number {
  const idx = year - START_YEAR;
  if (idx < 0) return series[0];
  if (idx >= YEAR_COUNT) return series[YEAR_COUNT - 1];
  return series[idx];
}

/** Convenience: year index from calendar year */
export function yearIndex(year: number): number {
  return Math.max(0, Math.min(year - START_YEAR, YEAR_COUNT - 1));
}
