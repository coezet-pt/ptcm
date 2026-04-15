# Phase 4.5+5 Completion: Scenario Configs, Type Updates, Debug Logging, and Build Fix

## Summary

Four things to do: (1) fix the recharts v3 TS build error in `chart.tsx`, (2) expand `PolicyConfig` with 17 new fields, (3) create `src/lib/constants/scenarios.ts` with all 4 scenario configs and seed them to Supabase, (4) add enhanced CNG/LNG debug logging to `choiceModel.ts` and `pttm.ts`.

## 1. Fix Build Error — `src/components/ui/chart.tsx`

The recharts v3 (`^3.8.1`) removed `payload` and `label` from the Tooltip content props type. Fix by adding explicit type casting/extension at the component props level:

- Line 95: Change the intersection type to add `payload?: any[]; label?: string;` to the props
- Line 233: Change `Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign">` to inline `{ payload?: any[]; verticalAlign?: string }`

This is a known recharts v3 breaking change in the shadcn chart component.

## 2. Expand `PolicyConfig` — `src/lib/types.ts`

Add these 17 fields to `PolicyConfig`:

```
bet_incentive_phase1_end_year: number;
bet_demand_incentive_phase2_per_kwh: number;
bet_incentive_phase2_end_year: number;
fcet_incentive_phase1_end_year: number;
fcet_demand_incentive_phase2_per_kwh: number;
fcet_incentive_phase2_end_year: number;
electricity_subsidy_end_year: number;
toll_waiver_first_period_years: number;
toll_waiver_second_period_years: number;
bet_maturity_year: number;
h2ice_maturity_year: number;
fcet_maturity_year: number;
range_filling_concern_after_2035: boolean;
gvw_payload_compensation_t: number;
```

(h2_source_mix, diesel_price_5pct_yoy_after_2045, bet_resale_2046_plus already exist)

## 3. Update `BAU_POLICY` — `src/lib/constants/extracted.ts`

Add default values for all new fields to `BAU_POLICY` so BAU config remains complete:

```
bet_incentive_phase1_end_year: 2030,
bet_demand_incentive_phase2_per_kwh: 0,
bet_incentive_phase2_end_year: 2035,
fcet_incentive_phase1_end_year: 2030,
fcet_demand_incentive_phase2_per_kwh: 0,
fcet_incentive_phase2_end_year: 2035,
electricity_subsidy_end_year: 2035,
toll_waiver_first_period_years: 5,
toll_waiver_second_period_years: 5,
bet_maturity_year: 2035,
h2ice_maturity_year: 2042,
fcet_maturity_year: 2045,
range_filling_concern_after_2035: false,
gvw_payload_compensation_t: 0,
```

## 4. Create `src/lib/constants/scenarios.ts`

Full `ScenarioConfig` objects for BAU, BWS-1, BWS-2, BEST. Each has `parameters` (15 keys) and `policy` (all fields including new ones). BAU reuses `BAU_PARAMETERS` + extended `BAU_POLICY`. BWS-1/BWS-2/BEST have their own parameter overrides and policy configs.

Since the user said they're "sending" this file but didn't attach it, I'll create the structure with BAU fully populated (from existing constants) and BWS-1/BWS-2/BEST using the existing `BEST_OVERRIDES` + `SCENARIO_INFLECTION_YEARS` + `SCENARIO_MATURITY_YEARS` to populate them as completely as possible from extracted.ts data.

## 5. Seed Supabase `scenarios` table

Use the Supabase insert tool to UPDATE the 4 existing scenario rows with their full `config` JSONB from the scenarios.ts objects.

## 6. Update `ScenarioContext.tsx`

Import scenario configs from `scenarios.ts` as fallbacks when DB rows have empty config. This ensures the app works even before DB is seeded.

## 7. Enhanced Debug Logging

`**choiceModel.ts**`: When `__SIM_DEBUG__`, add `console.table` for B12 CNG vs Diesel at 2045 showing TCO, price, and share. Also log all 5 factor args for CNG in B1.

`**pttm.ts**`: When `__SIM_DEBUG__`, log Weibull inputs and outputs for B12 CNG: peakShare W, computed shares at 2025/2035/2045/2055, NaN/Infinity warnings.

## Files Modified (7)

1. `src/components/ui/chart.tsx` — fix TS errors for recharts v3
2. `src/lib/types.ts` — expand PolicyConfig
3. `src/lib/constants/extracted.ts` — expand BAU_POLICY defaults
4. `src/lib/constants/scenarios.ts` — create with 4 scenario configs
5. `src/contexts/ScenarioContext.tsx` — use scenario configs as fallbacks
6. `src/lib/sim/choiceModel.ts` — enhanced debug logging
7. `src/lib/sim/pttm.ts` — enhanced debug logging

No database schema changes needed. Will use insert tool to update scenario config data.

**why is model Model Health Checks not [assing in full**

&nbsp;