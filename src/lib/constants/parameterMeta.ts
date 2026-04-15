import type { ParameterKey } from '../types';

export interface ParameterMeta {
  label: string;
  unit: string;
  tooltip: string;
}

export const PARAMETER_META: Record<ParameterKey, ParameterMeta> = {
  diesel_price_per_l:             { label: 'Diesel price',            unit: '₹/L',   tooltip: 'Retail diesel price at pump (2025 base)' },
  cng_price_per_kg:               { label: 'CNG price',              unit: '₹/kg',  tooltip: 'Compressed natural gas retail price' },
  lng_price_per_kg:               { label: 'LNG price',              unit: '₹/kg',  tooltip: 'Liquefied natural gas retail price' },
  green_h2_production_per_kg:     { label: 'Green H₂ production',    unit: '₹/kg',  tooltip: 'Green hydrogen production cost at plant gate' },
  grey_h2_production_per_kg:      { label: 'Grey H₂ production',     unit: '₹/kg',  tooltip: 'Grey hydrogen (SMR) production cost' },
  h2_compression_storage_per_kg:  { label: 'H₂ compression & storage', unit: '₹/kg', tooltip: 'Hydrogen compression, storage & dispensing cost' },
  electricity_per_kwh:            { label: 'Electricity price',      unit: '₹/kWh', tooltip: 'Commercial electricity tariff for BET charging' },
  battery_cost_per_kwh:           { label: 'Battery pack cost',      unit: '₹/kWh', tooltip: 'Li-ion battery pack cost (cell + BMS + enclosure)' },
  fuel_cell_cost_per_kw:          { label: 'Fuel cell cost',         unit: '₹/kW',  tooltip: 'PEM fuel cell stack cost per kW rated output' },
  lng_tank_cost_per_kg:           { label: 'LNG tank cost',          unit: '₹/kg',  tooltip: 'Cryogenic LNG tank cost per kg capacity' },
  h2_tank_cost_per_kg:            { label: 'H₂ tank cost',           unit: '₹/kg',  tooltip: 'Type IV composite H₂ tank cost per kg storage' },
  adblue_per_l:                   { label: 'AdBlue (DEF) price',     unit: '₹/L',   tooltip: 'Diesel exhaust fluid price (consumed ~5% of diesel volume)' },
  diesel_vehicle_growth:          { label: 'Diesel vehicle price growth', unit: '%/yr', tooltip: 'Annual YoY price growth for diesel vehicle platform' },
  engine_trans_growth:            { label: 'Engine+trans growth',    unit: '%/yr',  tooltip: 'Annual YoY cost growth for engine + transmission (ZET glider)' },
  e_powertrain_growth:            { label: 'E-powertrain growth',    unit: '%/yr',  tooltip: 'Annual YoY cost change for electric motor + electronics' },
};
