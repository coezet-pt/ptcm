/**
 * TCO module — vehicle prices and 7-year total cost of ownership
 * per bucket × powertrain × target year.
 */
import type { ParameterKey, PolicyConfig } from '@/lib/types';
import type { Powertrain, Bucket } from '@/lib/constants/extracted';
import {
  VEHICLE_BASE_PRICES_2025,
  BS_VII_PRICE_BUMP_2030,
  BET_OEM_MARGIN_BY_YEAR,
  FCET_OEM_MARGIN_BY_YEAR,
  RESALE_VALUES,
  BUCKET_RESALE_PROFILE,
  FINANCE,
  TECH_SPECS,
  EMISSION_FACTORS,
  POWERTRAINS,
} from '@/lib/constants/extracted';
import { getValueAtYear } from './timeSeries';

// ── Types ──
export interface TCOResult {
  tcoPerKm: number;
  vehiclePrice: number;
  totalCost: number;
  capexPerKm: number;
  opexPerKm: number;
  fuelCostPerKm: number;
  maintPerKm: number;
  manpowerPerKm: number;
  tollPerKm: number;
  resalePct: number;
}

export type BucketTCOMap = Record<string, Record<Powertrain, TCOResult>>;

// ── CNG tank cost — per-vehicle, NOT per-kg [fix #4] ──
const CNG_TANK_BASE_SMALL = 150000; // sizes ≤ 28T
const CNG_TANK_BASE_LARGE = 250000;
const CNG_TANK_GROWTH = 0.01; // 1% YoY
const LNG_VALVES_BASE = 100000;
const LNG_VALVES_GROWTH = 0.01;

// Manpower (driver + crew) constants — back-solved from Excel B1
const MANPOWER_BASE_2025_DIESEL = 400000;  // ₹4L/yr (Diesel, CNG, LNG, H2-ICE)
const MANPOWER_BASE_2025_BET    = 460000;  // ₹4.6L/yr (BET, FCET)
const MANPOWER_GROWTH = 0.04534;            // 4.53% YoY — (971000/400000)^(1/20)-1

// Toll constants
const TOLL_BASE_PER_KM = 2.5; // ₹/km in 2025
const TOLL_GROWTH = 0.025; // 2.5% YoY // TODO: parameterise

function isSmallSize(size: string): boolean {
  return size.includes('15T') || size.includes('19T');
}

function resaleTier(year: number): 0 | 1 | 2 {
  if (year <= 2035) return 0;
  if (year <= 2045) return 1;
  return 2;
}

function getH2PricePerKg(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  year: number,
): number {
  const green = getValueAtYear(ts.green_h2_production_per_kg, year);
  const grey = getValueAtYear(ts.grey_h2_production_per_kg, year);
  const compression = getValueAtYear(ts.h2_compression_storage_per_kg, year);

  let productionCost: number;
  switch (policy.h2_source_mix) {
    case 'green_only':
      productionCost = green;
      break;
    case 'blend_2046_green':
      productionCost = year < 2046
        ? (green + grey) / 2
        : green;
      break;
    case 'cheapest':
      productionCost = Math.min(green, grey);
      break;
    default:
      productionCost = green;
  }
  return productionCost + compression;
}

function computeVehiclePrice(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
): number {
  const base = VEHICLE_BASE_PRICES_2025[bucket.size];
  const dy = year - 2025;

  switch (pt) {
    case 'Diesel': {
      const price = base.diesel_total * Math.pow(1.03, dy);
      return price + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
    }
    case 'CNG': {
      const dieselPrice = base.diesel_total * Math.pow(1.03, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const tankBase = isSmallSize(bucket.size) ? CNG_TANK_BASE_SMALL : CNG_TANK_BASE_LARGE;
      const tankCost = tankBase * Math.pow(1 + CNG_TANK_GROWTH, dy);
      return dieselPrice + tankCost;
    }
    case 'LNG': {
      const dieselPrice = base.diesel_total * Math.pow(1.03, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const lngTankCostPerKg = getValueAtYear(ts.lng_tank_cost_per_kg, year);
      // LNG tank capacity in kg ≈ litres × density
      const lngCapacityKg = isSmallSize(bucket.size)
        ? 450 * 0.35 // small
        : 990 * 0.35; // large
      const valves = LNG_VALVES_BASE * Math.pow(1 + LNG_VALVES_GROWTH, dy);
      return dieselPrice + lngCapacityKg * lngTankCostPerKg + valves;
    }
    case 'BET': {
      // Excel formula: dieselBase - dieselPowertrain + ePowertrain + battery, then OEM margin, then incentive
      const dieselBase = base.diesel_total * Math.pow(1.03, dy)
        + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const batteryCost = bucket.betBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const oem = BET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.25;
      const raw = dieselBase - dieselPowertrain + ePowertrain + batteryCost;
      const withMargin = raw * (1 + oem);
      // Phased incentive: full until phase1_end, reduced until phase2_end, zero after
      const betIncentivePerKwh = year <= policy.bet_incentive_phase1_end_year
        ? policy.bet_demand_incentive_per_kwh
        : year <= policy.bet_incentive_phase2_end_year
          ? policy.bet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = betIncentivePerKwh * bucket.betBatteryKWh;
      return Math.max(0, withMargin - incentive);
    }
    case 'H2-ICE': {
      const dieselPrice = base.diesel_total * Math.pow(1.03, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      return dieselPrice + h2TankCost;
    }
    case 'H2-FCET': {
      // Excel formula: dieselBase - dieselPowertrain + ePowertrain + fuelCell + battery + h2Tank, then OEM margin, then incentive
      const dieselBase = base.diesel_total * Math.pow(1.03, dy)
        + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const fcCost = bucket.fcetFuelCellKW * getValueAtYear(ts.fuel_cell_cost_per_kw, year);
      const batteryCost = bucket.fcetBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      const oem = FCET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.35;
      const raw = dieselBase - dieselPowertrain + ePowertrain + fcCost + batteryCost + h2TankCost;
      const withMargin = raw * (1 + oem);
      // Phased incentive: full until phase1_end, reduced until phase2_end, zero after
      const fcetIncentivePerKwh = year <= policy.fcet_incentive_phase1_end_year
        ? policy.fcet_demand_incentive_per_kwh
        : year <= policy.fcet_incentive_phase2_end_year
          ? policy.fcet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = fcetIncentivePerKwh * bucket.fcetBatteryKWh;
      return Math.max(0, withMargin - incentive);
    }
    default:
      return 0;
  }
}

function computeFuelCostPerKm(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
): number {
  switch (pt) {
    case 'Diesel': {
      const dieselPrice = getValueAtYear(ts.diesel_price_per_l, year);
      const adbluePrice = getValueAtYear(ts.adblue_per_l, year);
      return dieselPrice / bucket.dieselKMPL + adbluePrice * TECH_SPECS.adblue_consumption_l_per_l_diesel / bucket.dieselKMPL;
    }
    case 'CNG':
      return getValueAtYear(ts.cng_price_per_kg, year) / bucket.cngKmPerKg;
    case 'LNG':
      return getValueAtYear(ts.lng_price_per_kg, year) / bucket.lngKmPerKg;
    case 'BET': {
      const subsidy = year <= policy.electricity_subsidy_end_year ? policy.electricity_subsidy_per_kwh : 0;
      const elecPrice = getValueAtYear(ts.electricity_per_kwh, year) - subsidy;
      return Math.max(0, elecPrice) * bucket.betKwhPerKm;
    }
    case 'H2-ICE':
      return getH2PricePerKg(ts, policy, year) / bucket.h2iceKmPerKg;
    case 'H2-FCET':
      return getH2PricePerKg(ts, policy, year) / bucket.fcetKmPerKg;
    default:
      return 0;
  }
}

function getMaintenancePerKm(pt: Powertrain, bucket: Bucket): number {
  if (pt === 'Diesel') return bucket.maintDieselPerKm;
  if (pt === 'BET' || pt === 'H2-FCET') return bucket.maintDieselPerKm * 0.6; // ~60% of diesel
  return bucket.maintCngLngH2icePerKm;
}

function isZET(pt: Powertrain): boolean {
  return pt === 'BET' || pt === 'H2-FCET';
}

export function computeTCO(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  buckets: Bucket[],
  targetYear: number,
): BucketTCOMap {
  const result: BucketTCOMap = {};

  for (const bucket of buckets) {
    const ptResults = {} as Record<Powertrain, TCOResult>;
    const dy = targetYear - 2025;
    const tollPerKm = TOLL_BASE_PER_KM * Math.pow(1 + TOLL_GROWTH, dy); // TODO: parameterise

    for (const pt of POWERTRAINS) {
      const price = computeVehiclePrice(pt, bucket, targetYear, ts, policy);

      // Resale — BET override for 2046+ purchases
      const profile = BUCKET_RESALE_PROFILE[bucket.id] ?? 'general';
      const tier = resaleTier(targetYear);
      let resalePct = RESALE_VALUES[profile][pt][tier];
      if (pt === 'BET' && targetYear >= 2046 && policy.bet_resale_2046_plus > 0) {
        resalePct = policy.bet_resale_2046_plus;
      }
      const resale = price * resalePct;

      // Finance
      const rate = isZET(pt) ? policy.interest_rate_zet : FINANCE.diesel_cng_lng_h2ice_interest_pa_default;
      const tenure = policy.loan_tenure_years;
      const interest = price * rate * tenure / 2;
      const insurance = price * FINANCE.insurance_rate_per_year * FINANCE.useful_life_years;

      // Capex
      const capex = price - resale + interest + insurance;

      // Opex per year
      const fuelPerKm = computeFuelCostPerKm(pt, bucket, targetYear, ts, policy);
      const maintPerKm = getMaintenancePerKm(pt, bucket);

      // Toll with waiver for ZET — weighted average over useful life
      let effectiveToll = tollPerKm;
      if (isZET(pt)) {
        const life = FINANCE.useful_life_years; // 7
        const p1 = Math.min(policy.toll_waiver_first_period_years, life);
        const p2 = Math.min(policy.toll_waiver_second_period_years, life - p1);
        const p3 = Math.max(0, life - p1 - p2);
        const waiverAvg = (p1 * policy.toll_waiver_pct_first_5y
          + p2 * policy.toll_waiver_pct_next_5y
          + p3 * 0) / life;
        effectiveToll = tollPerKm * (1 - waiverAvg);
      }

      const baseManpower = (pt === 'BET' || pt === 'H2-FCET')
        ? MANPOWER_BASE_2025_BET
        : MANPOWER_BASE_2025_DIESEL;
      const manpowerPerYear = baseManpower * Math.pow(1 + MANPOWER_GROWTH, dy);
      const manpowerPerKm = manpowerPerYear / bucket.annualKm;

      const opexPerKm = fuelPerKm + maintPerKm + effectiveToll + manpowerPerKm;
      const totalOpex = opexPerKm * bucket.annualKm * FINANCE.useful_life_years;
      const totalCost = capex + totalOpex;
      const tcoPerKm = totalCost / (bucket.annualKm * FINANCE.useful_life_years);
      const capexPerKm = capex / (bucket.annualKm * FINANCE.useful_life_years);

      ptResults[pt] = {
        tcoPerKm, vehiclePrice: price, totalCost,
        capexPerKm, opexPerKm, fuelCostPerKm: fuelPerKm,
        maintPerKm, manpowerPerKm, tollPerKm: effectiveToll, resalePct,
      };
    }
    result[bucket.id] = ptResults;
  }

  // DEBUG — detailed B1 2045 breakdown
  if (typeof window !== 'undefined' && targetYear === 2045) {
    const b1 = result['B1'];
    if (b1) {
      console.group('🔬 TCO TRACE — B1 2045 (Excel ref: Diesel=56.94, BET=49.68)');
      for (const pt of POWERTRAINS) {
        const r = b1[pt];
        console.log(pt, {
          vehiclePrice_lakh: (r.vehiclePrice / 100000).toFixed(2),
          tcoPerKm: r.tcoPerKm.toFixed(2),
          capexPerKm: r.capexPerKm.toFixed(2),
          opexPerKm: r.opexPerKm.toFixed(2),
          fuelCostPerKm: r.fuelCostPerKm.toFixed(4),
          maintPerKm: r.maintPerKm.toFixed(4),
          manpowerPerKm: r.manpowerPerKm.toFixed(4),
          tollPerKm: r.tollPerKm.toFixed(4),
          resalePct: r.resalePct,
        });
      }
      console.groupEnd();
    }
  }

  return result;
}
