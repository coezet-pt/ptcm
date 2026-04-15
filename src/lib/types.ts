import type { Powertrain, ScenarioName } from './constants/extracted';

// ── Parameter config (15 cost trajectories) ──
export interface ParameterConfig {
  baseValue: number;
  d2630: number;
  d3140: number;
  d4150: number;
  d5155: number;
}

export type ParameterKey =
  | 'diesel_price_per_l'
  | 'cng_price_per_kg'
  | 'lng_price_per_kg'
  | 'green_h2_production_per_kg'
  | 'grey_h2_production_per_kg'
  | 'h2_compression_storage_per_kg'
  | 'electricity_per_kwh'
  | 'battery_cost_per_kwh'
  | 'fuel_cell_cost_per_kw'
  | 'lng_tank_cost_per_kg'
  | 'h2_tank_cost_per_kg'
  | 'adblue_per_l'
  | 'diesel_vehicle_growth'
  | 'engine_trans_growth'
  | 'e_powertrain_growth';

export type H2SourceMix = 'green_only' | 'blend_2046_green' | 'cheapest';

// ── Policy levers ──
export interface PolicyConfig {
  bet_demand_incentive_per_kwh: number;
  fcet_demand_incentive_per_kwh: number;
  interest_rate_zet: number;
  loan_tenure_years: number;
  electricity_subsidy_per_kwh: number;
  toll_waiver_pct_first_5y: number;
  toll_waiver_pct_next_5y: number;
  bet_inflection_year: number;
  h2ice_inflection_year: number;
  fcet_inflection_year: number;
  h2_source_mix: H2SourceMix;
  bet_resale_2046_plus: number;
  diesel_price_5pct_yoy_after_2045: boolean;
}

// ── Full scenario config ──
export interface ScenarioConfig {
  parameters: Record<ParameterKey, ParameterConfig>;
  policy: PolicyConfig;
}

// ── Simulation output ──
export interface AnnualResult {
  year: number;
  tiv: number;
  salesByPT: Record<Powertrain, number>;
  shareByPT: Record<Powertrain, number>;
  stockByPT: Record<Powertrain, number>;
  emissionsByPT: Record<Powertrain, number>;
  totalEmissions: number;
  dieselCounterfactualEmissions: number;
  zetShare: number;
}

export interface SimulationResult {
  years: AnnualResult[];
  totalZetSales: number;
  year50PctZet: number | null;
  cumulativeCO2Avoided: number;
  dieselStockPeakYear: number;
  dieselStockPeakValue: number;
}

// ── Sanity check ──
export interface SanityCheckResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  message: string;
}

// ── DB row ──
export interface ScenarioRow {
  id: string;
  name: ScenarioName;
  description: string;
  config: Record<string, unknown>;
  created_at: string;
}
