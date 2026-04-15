# Power Train Choice Model — India Heavy Truck Transition Dashboard

## Overview

A single-page React dashboard that simulates India's heavy-commercial-truck fleet transition across 6 powertrains (Diesel, CNG, LNG, BET, H2-ICE, H2-FCET) from 2025→2055.

## Phase 1: Data Extraction & Constants

- Copy the uploaded Excel file and extract all hardcoded constants using pandas/openpyxl:
  - Per-bucket efficiencies (KMPL, kWh/km, km/kg), annual km, maintenance costs
  - Vehicle base prices per bucket × powertrain
  - Historical sales 2001–2024 for stock evolution
  - Choice model elasticities and weightings
  - Gompertz/Weibull curve parameters (start years, inflection years per scenario)
  - Resale value tiers, readiness factors, TIV availability ratios
  - All 4 scenario preset configs (BAU, BWS-1, BWS-2, BEST)
- Store extracted data as TypeScript constant files in `src/lib/constants/`

## Phase 2: Database & Scenario Presets

- Create `scenarios` table in Lovable Cloud (id, name, description, config JSONB, created_at)
- Public read RLS, no write
- Seed 4 rows with full scenario configs extracted from Excel
- Build ScenarioContext to fetch and cache presets on mount

## Phase 3: Input Panel

- **ScenarioPicker** dropdown (BAU/BWS-1/BWS-2/BEST/Custom) — loads preset config
- **Quick tab**: 17 parameter rows, each with base value + 4 period delta inputs
- **Advanced tab**: Per-bucket override table (14 buckets × parameter overrides)
- Auto-promote to "Custom" when user edits any field
- "Reset to BAU" button
- Tooltips on every parameter explaining its meaning

## Phase 4: Simulation Engine (5 pure TypeScript modules)

- `timeSeries.ts` — Project 17 parameters year-by-year (2025–2055) using compound growth
- `tco.ts` — 7-year TCO per bucket × powertrain for 2045 and 2055 (capex + opex)
- `choiceModel.ts` — Multinomial logit with 5 choice factors → PT share targets
- `pttm.ts` — Gompertz (ZET) and Weibull (CNG/LNG) S-curves for annual share interpolation
- `stockEmissions.ts` — Stock evolution with 20-year scrappage + CO₂ emissions calculation

## Phase 5: Charts & Visualizations (Recharts)

- Chart A: Annual Sales by Powertrain (stacked area)
- Chart B: Powertrain Share of Annual Sales % (stacked area 100%)
- Chart C: Cumulative Stock by Powertrain (stacked area)
- Chart D: Annual CO₂ Emissions + Diesel counterfactual line (stacked area + overlay)
- Chart E: ZET Penetration Curve (line chart with inflection markers)
- Chart F: TCO Parity Year by Bucket (horizontal bar)
- Consistent color palette: Diesel #6b7280, CNG #f59e0b, LNG #f97316, BET #10b981, H2-ICE #3b82f6, H2-FCET #8b5cf6
- Each chart wrapped in ChartCard with PNG download (html-to-image) and "View data" toggle with CSV export (PapaParse)

## Phase 6: Key Numbers Stat Cards

- Total ZET sales 2025–2055
- Year of 50% ZET share
- Cumulative CO₂ avoided (Mt)
- Diesel stock peak year & value
- 2045 and 2055 PT mix (mini donut charts)

## Phase 7: UX Polish

- 300ms debounced simulation with "Calculating..." indicator
- Memoized results with deep compare
- Responsive layout — mobile stacks vertically, Advanced tab behind accordion
- All charts use ResponsiveContainer  


The constants file is ready — drop the file I'm sharing into:

  src/lib/constants/extracted.ts

Update the plan with these 8 additions/corrections, then proceed:

──────────────────────────────────────────────────────────

PLAN AMENDMENTS

──────────────────────────────────────────────────────────

[A1] REPLACE Phase 1 entirely

Don't try to extract from Excel — you don't have Python or SheetJS in

this environment. The file `src/lib/constants/extracted.ts` already

contains everything you need: the 14 buckets with all efficiencies and

spec, vehicle base prices, choice elasticities, OEM margin schedules,

historical sales, TIV projections, scenario inflection years, emission

factors, TCO parity years, and the BAU parameter defaults. Import from

this file everywhere the plan says "extracted from Excel".

[A2] ADD Phase 2.5 — Sanity-check harness (BEFORE Phase 4)

Create `src/lib/sim/sanityCheck.ts` that takes a SimulationResult and

runs assertions from the BAU_BASELINE_CHECKS constant. Returns an array

of {name, passed, expected, actual, message}. Render a small "Model

Health" badge in the dashboard header — green if all pass, yellow if any

fail with a click-to-expand panel showing the failures. This catches

formula bugs immediately instead of debugging through chart UIs.

[A3] CORRECT Phase 3 — Split InputPanel into TWO sections

Don't put policy levers in the same form as cost trajectories.

- Section 1: "Cost Trajectories" — 15 rows from BAU_PARAMETERS, each

  with base + 4 deltas (2026-30, 2031-40, 2041-50, 2051-55).

  Diesel price 2025 base value is editable but defaults to 88.93.

- Section 2: "Policy Levers" — 7 controls from BAU_POLICY:

    • BET demand incentive (₹/kWh) — number input

    • FCET demand incentive (₹/kWh) — number input

    • ZET interest rate (%) — slider 8-15%

    • Electricity subsidy (₹/kWh) — number input

    • Toll waiver (% first 5y / % next 5y) — two number inputs

    • H2 source mix — radio: green_only / blend_2046_green / cheapest

    • BET inflection year — slider 2030-2042

- These do NOT have growth-rate deltas. Don't render the delta columns

  for Policy Levers.

[A4] CORRECT Phase 5 — Chart F is from a CONSTANT, not the simulation

Chart F (TCO Parity Year by Bucket) reads directly from

TCO_PARITY_YEARS in extracted.ts based on the currently-selected

scenario. It does NOT compute from simulation output. Show parity year

for BET, H2-ICE, H2-FCET as three grouped horizontal bars per bucket.

For "Custom" scenarios, fall back to scenario1_BAU values with a

disclaimer "TCO parity years shown for BAU baseline; custom scenarios

do not recompute parity years in this version".

[A5] ADD to Phase 4 — Numerical guards in choiceModel.ts and pttm.ts

Three specific guards to add:

  (a) In choiceModel: clamp the EXP argument to [-50, 50] before

      Math.exp() to prevent overflow when prices are wildly off.

  (b) In pttm Gompertz `b` parameter: use Math.max(saturation, W*1.01)

      as the numerator inside LN, exactly like Excel cell X2:

        b = Math.log(Math.max(a, W * 1.01) / W)

  (c) In pttm Gompertz `c` parameter: clamp inner LN argument:

        c = -(1/(inflectionYear - startYear)) *

             Math.log( Math.log( Math.max(a, 0.1001) / 0.1 ) / b )

  (d) After computing all powertrain shares for a year, if their sum

      exceeds 1.0, scale the ZET shares (BET, H2-ICE, FCET, CNG, LNG)

      proportionally so the diesel share is at least 0.

[A6] ADD to Phase 4 — Vehicle price computation rule

The TCO module needs to compute on-road vehicle price per powertrain

per year. Use these formulas (DON'T let the LLM improvise):

  diesel_price[y]    = diesel_total_2025 * (1.03)^(y-2025)

                       + (y >= 2030 ? 400000 : 0)   // BS-VII bump

  cng_price[y]       = diesel_price[y]

                       + cng_tank_kg * cng_tank_cost_per_kg[y]

                       (cng_tank_kg from TANK_SIZES, cost

                        defaults to 150,000 for small / 250,000 for

                        large tank — apply 1% YoY growth)

  lng_price[y]       = diesel_price[y]

                       + lng_tank_kg * lng_tank_cost_per_kg[y]

                       + lng_valves_per_vehicle[y]   // base 100,000

  bet_price[y]       = engine_trans_2025 * (1.02)^(y-2025)

                       + e_powertrain[y]

                       + bet_battery_kwh * battery_cost_per_kwh[y]

                       Then apply OEM margin:

                         price *= (1 + BET_OEM_MARGIN_BY_YEAR[y])

                       Apply demand incentive:

                         price -= bet_battery_kwh * bet_demand_incentive_per_kwh

  h2ice_price[y]     = diesel_price[y]

                       + h2_tank_kg * h2_tank_cost_per_kg[y]

  fcet_price[y]      = engine_trans_2025 * (1.02)^(y-2025)

                       + e_powertrain[y]

                       + fcet_fuel_cell_kw * fuel_cell_cost_per_kw[y]

                       + fcet_battery_kwh * battery_cost_per_kwh[y]

                       + h2_tank_kg * h2_tank_cost_per_kg[y]

                       Then OEM margin via FCET_OEM_MARGIN_BY_YEAR

                       Then demand incentive via fcet_demand_incentive

[A7] ADD to Phase 4 — TCO formula

Annualised TCO per km, 7-year ownership horizon:

  capex_total = vehicle_price - resale_value_after_7y

                + interest_paid_over_loan

                + insurance_2pct_per_year * 7

  resale_value = vehicle_price * resale_pct_for_period

                 (use RESALE_VALUES + BUCKET_RESALE_PROFILE; period

                  determined by purchase year)

  interest_paid = vehicle_price  *interest_rate*  tenure / 2

                  (simple-interest approximation per Excel convention)

  fuel_cost_per_km = fuel_price[y] / efficiency_per_km

    For BET: electricity_per_kwh[y] * bet_kwh_per_km

    For H2-ICE/FCET: ((green_h2  *(1-blend) + grey_h2*  blend)

                      + h2_compression) / efficiency

    For Diesel: diesel_price[y] / dieselKMPL

                + adblue_per_l[y] * 0.05 / dieselKMPL

    For CNG: cng_price[y] / cngKmPerKg

    For LNG: lng_price[y] / lngKmPerKg

  total_opex_per_km = fuel_cost_per_km + maint_per_km + toll_per_km

                      - electricity_subsidy * (bet_only)

                      - toll_waiver * toll_per_km

  total_lifecycle_cost = capex_total + total_opex_per_km  *annual_km*  7

  TCO_per_km = total_lifecycle_cost / (annual_km * 7)

Toll cost — assume flat ₹2.5/km for all powertrains in 2025, 2.5% YoY

growth. (This isn't in extracted.ts — hardcode in tco.ts as a comment

"// TODO: parameterise from policy if scenarios add toll variations".)

[A8] ADD to Phase 6 — One additional stat card

Add card: "TCO Parity Year (Avg across buckets)" — a single number per

ZET powertrain showing the volume-weighted average parity year. Source:

TCO_PARITY_YEARS weighted by Bucket.tivShare2045.

──────────────────────────────────────────────────────────

EXECUTION ORDER (revised)

──────────────────────────────────────────────────────────

1. Drop extracted.ts into src/lib/constants/

2. Phase 2 — DB schema (empty seeds, just the table)

3. Phase 3 — InputPanel UI with BAU defaults imported from extracted.ts

4. Phase 4 — Simulation modules (use guards from [A5], formulas from

             [A6][A7])

5. Phase 2.5 — Sanity-check harness, wire up Model Health badge

6. Phase 5 — Charts (Chart F uses constant, others use sim output)

7. Phase 6 — Stat cards

8. Phase 7 — Polish

Skip Phase 2 seeding the 4 scenarios with config — leave the rows with

empty config: {} for now. I'll provide BWS-1, BWS-2, BEST configs as

SQL inserts after I see Phase 5 working with BAU.

Confirm this plan and start with steps 1-3.