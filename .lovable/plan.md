# Phase 4 — Simulation Engine Implementation

All 6 bug fixes from the user are incorporated. Seven files to create.

## File 1: `src/lib/sim/timeSeries.ts`

Build year-by-year arrays (index 0=2025, index 30=2055) for all 15 parameters using compound growth per period. Export `buildTimeSeries(params) → Record<ParameterKey, number[]>` and `getValueAtYear(series, year) → number`.

For the three growth-rate keys (`diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`), the baseValue is 0 — store cumulative multiplier starting at 1.0, compounding the delta each year.

## File 2: `src/lib/sim/tco.ts`

**Vehicle prices per bucket × powertrain × year** using exact [A6] formulas:

- Diesel: `diesel_total_2025 * 1.03^(y-2025) + (y>=2030 ? 400000 : 0)`
- CNG: diesel_price + per-vehicle tank cost (₹150k small ≤28T / ₹250k large, 1% YoY) — **NOT** from `lng_tank_cost_per_kg` time series [fix #4]
- LNG: diesel_price + lng_tank_kg × lng_tank_cost_per_kg[y] + valves (100k base, 1% YoY)
- BET: engine_trans × growth + e_powertrain[y] + battery_kWh × battery_cost[y], then × (1+OEM_MARGIN[y]), then − demand incentive
- H2-ICE: diesel_price + h2_tank_kg × h2_tank_cost[y]
- H2-FCET: engine_trans × growth + e_powertrain[y] + fc_kW × fc_cost[y] + battery_kWh × battery_cost[y] + h2_tank × h2_tank_cost[y], then OEM margin, then incentive

**7-year TCO** per [A7]:

- Resale = price × tier% from `RESALE_VALUES` + `BUCKET_RESALE_PROFILE` (tier by purchase year: ≤2035→0, 2036-2045→1, >2045→2)
- Interest = price × rate × tenure / 2
- Insurance = price × 0.02 × 7
- Fuel cost/km by powertrain (H2 uses blended green/grey per `h2_source_mix` policy)
- Toll = ₹2.5/km × 1.025^(y-2025) with `// TODO: parameterise`
- Toll waiver for BET/FCET; electricity subsidy for BET only
- TCO/km = (capex + opex × annual_km × 7) / (annual_km × 7)

Export: `computeTCO(timeSeries, policy, buckets, targetYear) → Record<bucketId, Record<Powertrain, { tcoPerKm, vehiclePrice }>>`

## File 3: `src/lib/sim/choiceModel.ts`

Per bucket × target year, compute 5 factors per powertrain:

- `arg = elasticity × weighting / 1.5 × (diesel_value/pt_value - 1)`
- `factor = Math.exp(clamp(arg, -50, 50))` [A5a]
- TCO and price factors from tco output; payload uses `(gvw-ulw)` ratios; TAT and range from `POWERTRAIN_RATINGS`

Normalize to shares. Zero out shares before `START_OF_SUPPLY[bucket.size][pt]`.

**Return per-bucket shares** — do NOT aggregate [fix #3]. Export: `computeShares(...) → { shares2045: Record<bucketId, Record<Powertrain, number>>, shares2055: ... }`

## File 4: `src/lib/sim/pttm.ts`

Run Gompertz/Weibull **per bucket**, aggregate final sales [fix #3].

**Gompertz (BET, H2-ICE, H2-FCET)** — per bucket:

- startYear = `START_OF_SUPPLY[bucket.size][pt]`
- W = `PTTM_PILOT_SHARE[pt]`
- AB = shares2055 from choiceModel (per bucket)
- Exact order of operations [fix #2]:
  1. `a_initial = AB`
  2. `b = ln(max(a_initial, W * 1.01) / W)`
  3. `c = -(1/(inflectionYear - startYear)) × ln(ln(max(a_initial, 0.1001) / 0.1) / b)`
  4. `a_final = AB / exp(-b × exp(-c × (2055 - startYear)))`
  5. `share(y) = a_final × exp(-b × exp(-c × (y - startYear))) / exp(-b × exp(-c × (2055 - startYear)))`

**Weibull (CNG, LNG)** — per bucket:

- peakShare (W) = `shares2045[bucket][CNG/LNG]` from choiceModel [fix #1]
- α=5, peakYear=2045, startYear from `START_OF_SUPPLY`
- Add `console.warn` if computed 2025 share deviates >50% from historical anchor `CNG_UNITS_2025/TIV_2025`

**Post-processing** [A5d]: sum all non-diesel shares per year; if >1.0, scale proportionally so diesel ≥ 0.

Aggregate: `sales[y][pt] = Σ_buckets(share[bucket][pt][y] × TIV[y] × bucket.tivShare2045)`. Add `OTHER_DIESEL_TIV_SHARE` to diesel.

## File 5: `src/lib/sim/stockEmissions.ts`

**Stock evolution:**

- diesel stock[2024] = `DIESEL_STOCK_END_2024`; others = 0
- For y≥2025: `stock[y] = stock[y-1] + sales[y] - retirements[y]`
- Retirements = `sales[y-20]` (from `HISTORICAL_SALES` for pre-2025)
- Pre-2001 diesel scrappage: 125k/yr until 2040

**Emissions (Mt CO₂/yr):**

- Per powertrain using `EMISSION_FACTORS` and bucket-weighted efficiencies
- Diesel counterfactual [fix #5]: `actual_total_stock[y] × diesel_emission_rate` where rate = bucket-weighted `(annualKm / dieselKMPL × 2.60)` averaged across buckets by tivShare

**Summary stats:** totalZetSales, year50PctZet, cumulativeCO2Avoided, dieselStockPeakYear/Value

## File 6: `src/hooks/useSimulation.ts`

Wires modules: timeSeries → tco(2045,2055) → choiceModel → pttm → stockEmissions.

Uses stable stringify for memo key [fix #6]: a small `stableStringify` helper that sorts object keys recursively before `JSON.stringify`. No external dep needed — ~15 lines of code.

Returns `SimulationResult`. 300ms debounce via `setTimeout`/`clearTimeout` pattern.

## File 7: Minor update to `src/pages/Index.tsx`

Call `useSimulation(config)` and `console.log('SimulationResult:', result)` for verification. No UI changes yet.

Approved. One small ask: in each of the 5 sim modules, add a `// DEBUG:` block at the bottom of every exported function that logs key intermediate values when `window.__SIM_DEBUG__ === true`. Specifically:

- `tco.ts`: log vehicle prices and TCO/km for B1 (Market Load 19T) at 2045 for all 6 powertrains
- `choiceModel.ts`: log raw factors and final shares for B1 at 2045
- `pttm.ts`: log Gompertz parameters (W, AB, a_initial, b, c, a_final) for BET in B1
- `stockEmissions.ts`: log year-2030 and year-2045 stock totals

This lets me toggle deep diagnostics from the browser console without UI changes when Model Health fails. Default off so production output stays clean.

---

## Summary of all 6 fixes applied


| #   | Fix                                                               | Module             |
| --- | ----------------------------------------------------------------- | ------------------ |
| 1   | Weibull W = shares2045 from choiceModel, not CNG_UNITS/TIV        | pttm.ts            |
| 2   | Gompertz: a_initial→b→c→a_final order                             | pttm.ts            |
| 3   | Per-bucket shares in choiceModel, aggregate in pttm               | choiceModel + pttm |
| 4   | CNG tank cost hardcoded per-vehicle, not lng time series          | tco.ts             |
| 5   | Diesel counterfactual = total stock × bucket-weighted diesel rate | stockEmissions.ts  |
| 6   | Stable stringify for memo key                                     | useSimulation.ts   |
