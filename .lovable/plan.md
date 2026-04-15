# Step 1: Wire Unused Policy Fields into Simulation

## My understanding of the semantics

**Incentive phasing (BET and FCET):** The demand incentive per kWh is NOT a single flat value across all years. It operates in two phases: when `year ≤ phase1_end_year`, the full `bet_demand_incentive_per_kwh` applies; when `phase1_end_year < year ≤ phase2_end_year`, the reduced `bet_demand_incentive_phase2_per_kwh` applies; after `phase2_end_year`, no incentive at all (zero). Same logic for FCET using its own three fields. **Electricity subsidy:** `electricity_subsidy_per_kwh` applies only when `year ≤ electricity_subsidy_end_year`, zero after. **Toll waivers:** Instead of hardcoded 5y/2y split, use `toll_waiver_first_period_years` and `toll_waiver_second_period_years` — the effective toll over the 7-year useful life averages: first_pct waiver for `first_period` years, second_pct for `second_period` years, full toll for remaining years (if any within 7). **BET resale override:** When `targetYear ≥ 2046` and pt is BET, use `policy.bet_resale_2046_plus` instead of the RESALE_VALUES tier-2 lookup. **Diesel price override:** When `diesel_price_5pct_yoy_after_2045` is true, the d5155 delta for `diesel_price_per_l` becomes 0.05 regardless of what the parameter says. **Range concern removal:** When `range_filling_concern_after_2035 === false` and `targetYear ≥ 2035`, all powertrains get rangeFillingTime = 1.0 (no penalty). **Maturity year clamping:** At `maturity_year`, the Gompertz curve should have reached at least 50% of its saturation value; if the unclamped curve is lower, scale it up.

## Files to modify (4)

### `src/lib/sim/tco.ts`

- **BET incentive** (line 117): Replace `policy.bet_demand_incentive_per_kwh` with phased logic using `year`, `bet_incentive_phase1_end_year`, `bet_demand_incentive_phase2_per_kwh`, `bet_incentive_phase2_end_year`
- **FCET incentive** (line 134): Same pattern with FCET fields
- **Electricity subsidy** (line 160): Wrap with `year <= policy.electricity_subsidy_end_year` check
- **Toll waiver** (lines 219-223): Use `toll_waiver_first_period_years` / `toll_waiver_second_period_years` instead of hardcoded 5/2, compute weighted average over `FINANCE.useful_life_years` (7)
- **BET resale** (lines 198-201): When `pt === 'BET' && targetYear >= 2046`, use `policy.bet_resale_2046_plus` instead of `RESALE_VALUES` lookup

### `src/lib/sim/timeSeries.ts`

- In `buildTimeSeries`, accept `PolicyConfig` as second arg
- When `policy.diesel_price_5pct_yoy_after_2045 === true` and `key === 'diesel_price_per_l'`, override `delta` to `0.05` for years > 2045

### `src/lib/sim/choiceModel.ts`

- In `computeShares`, accept `PolicyConfig` as additional arg
- When `policy.range_filling_concern_after_2035 === false && targetYear >= 2035`, use `1.0` for all `rangeFillingTime` ratings instead of `POWERTRAIN_RATINGS.rangeFillingTime[pt]`
- Add `// TODO: gvw_payload_compensation_t not yet wired — add as adjustment to (gvw-ulw) in payload factor`

### `src/lib/sim/pttm.ts`

- Pass `maturityYear` to `gompertzCurve`
- After computing curve, check value at `maturityYear` index; if < `0.5 * AB`, scale the curve segment up to that year so it meets the threshold

### Callers: `src/hooks/useSimulation.ts`

- Pass `policy` to `buildTimeSeries`
- Pass `policy` to `computeShares`

## Step 2: Seed Supabase scenarios table

- Use Supabase tool to update the 4 rows with full config JSONB from `SCENARIO_CONFIGS`

## Step 3: Debug output

- Run simulation with `__SIM_DEBUG__=true`, capture and share B12 CNG diagnostic console output

## Step 4: Phase 6 StatCards

- Deferred until Steps 1-3 validated

Approved with two clarifications:

**1. Toll waiver averaging is slightly wrong.** You wrote "weighted average over 7 years" — that's right *in concept* but be specific: the formula should be:

```
toll_waiver_per_km_avg =
  (first_period_years * toll_waiver_pct_first_5y +
   second_period_years * toll_waiver_pct_next_5y +
   Math.max(0, 7 - first_period - second_period) * 0) / 7
```

Then `effective_toll_per_km = base_toll_per_km * (1 - toll_waiver_per_km_avg)`. Cap `first_period + second_period` at 7 to prevent overcounting if a scenario sets longer periods than vehicle life. (BWS-2 has first=10, second=0 — so the cap matters: it should clamp to 7, not run for 10 years.)

**2. Maturity year clamping is conceptually wrong as you wrote it.** "Scale the curve segment up to that year" will create a discontinuity at `maturity_year` (the curve will jump up before, then continue from the unscaled point). Two better options — pick the simpler one:

Option A (recommended, simple): If unclamped `share(maturity_year) < 0.5 * AB`, recompute `c` (growth rate) such that `share(maturity_year) = 0.5 * AB` exactly, then use the new `c` for the entire curve. This shifts the inflection earlier without creating a discontinuity.

Option B (skip if too complex): Don't apply the clamp at all — instead, log a warning when `share(maturity_year) < 0.5 * AB` saying "saturation level may be unrealistically low for this scenario; consider raising 2055 target shares". Maturity year then becomes informational only.

If Option A's recompute is non-trivial (it requires inverting a logarithm), do Option B. We'll revisit if scenarios show implausibly slow ZET adoption.

Proceed with all 4 files + scenario seeding + debug capture. Defer StatCards.

&nbsp;