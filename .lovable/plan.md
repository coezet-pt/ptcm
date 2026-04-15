

# PTCM Dashboard — Revised Implementation Plan

## Overview
Single-page React dashboard simulating India's heavy truck fleet transition across 6 powertrains (2025-2055). All constants come from the uploaded `extracted.ts` file. Simulation runs client-side. Scenarios stored in Supabase.

---

## Execution Phases

### Phase 1 — Constants & Foundation
- Copy `extracted.ts` verbatim to `src/lib/constants/extracted.ts`
- Install dependencies: `recharts`, `html-to-image`, `papaparse`
- Create shared types in `src/lib/types.ts` (ScenarioConfig, SimulationResult, etc.)
- Create powertrain color map and utility exports in `src/lib/constants/`

### Phase 2 — Database
- Create `scenarios` table: `id (uuid pk)`, `name (text)`, `description (text)`, `config (jsonb)`, `created_at (timestamptz)`
- RLS: public read, no write
- Seed 4 rows with `name` = BAU/BWS-1/BWS-2/BEST, `config` = `{}` (placeholder — user will provide full configs later)
- Build `ScenarioContext.tsx` — fetches all 4 on mount, caches in React context
- Wire up Supabase client

### Phase 3 — Input Panel UI
Two distinct sections per amendment [A3]:

**Section 1: Cost Trajectories** — 15 parameter rows from `BAU_PARAMETERS`, each with:
- Parameter name + tooltip
- Base value (2025) input
- 4 delta-% inputs (2026-30, 2031-40, 2041-50, 2051-55)

**Section 2: Policy Levers** — 7 controls from `BAU_POLICY`, NO delta columns:
- BET/FCET demand incentive (number inputs, Rs/kWh)
- ZET interest rate (slider 8-15%)
- Electricity subsidy (number input)
- Toll waiver first 5y / next 5y (two number inputs)
- H2 source mix (radio: green_only / blend_2046_green / cheapest)
- BET inflection year (slider 2030-2042)

**ScenarioPicker**: dropdown BAU/BWS-1/BWS-2/BEST/Custom. Selecting a preset loads its config. Any edit auto-promotes to "Custom". "Reset to BAU" button.

Components: `ScenarioPicker.tsx`, `InputPanel.tsx`, `ParameterRow.tsx`, `PolicyLevers.tsx`

### Phase 4 — Simulation Engine
Five modules in `src/lib/sim/`:

**timeSeries.ts** — For each of 15 cost parameters, build year-by-year array (2025-2055) using compound growth per period.

**tco.ts** — Per amendment [A6] and [A7]:
- Vehicle price per powertrain per year using exact formulas (diesel 3% growth + BS-VII bump, BET = glider + battery + e-powertrain with OEM margin, etc.)
- 7-year TCO = capex (price - resale + interest + insurance) + opex (fuel + maintenance + toll - subsidies) over annual_km * 7
- Toll: flat Rs 2.5/km in 2025, 2.5% YoY growth (hardcoded with TODO comment)
- Compute for target years 2045 and 2055

**choiceModel.ts** — Per amendment [A5]:
- 5 factors (TCO, price, payload, TAT, range) with elasticities from `CHOICE_FACTORS`
- `factor = EXP(clamp(elasticity * weighting / 1.5 * (base/value - 1), -50, 50))`
- Sum factors per PT, normalize to shares
- Apply start-of-supply readiness scaling

**pttm.ts** — Per amendment [A5]:
- Gompertz for BET/H2-ICE/H2-FCET with guarded b and c parameters
- Weibull for CNG/LNG (alpha=5, peak=2045)
- After all shares computed: if sum > 1, scale non-diesel proportionally so diesel >= 0
- Output: annual sales by PT = share * TIV

**stockEmissions.ts**:
- Stock evolution: stock[y] = stock[y-1] + sales[y] - retirements[y] (20-year scrappage)
- Pre-2001 backlog: 125k/yr diesel scrappage until 2040
- Emissions: stock * annual_km * emission_factor / efficiency / 1e9 (Mt CO2)

### Phase 4.5 — Sanity Check Harness (Amendment [A2])
- `src/lib/sim/sanityCheck.ts` — validates SimulationResult against `BAU_BASELINE_CHECKS`
- Returns `{name, passed, expected, actual, message}[]`
- "Model Health" badge in dashboard header — green (all pass) / yellow (failures) with expandable failure panel

### Phase 5 — Charts
Six charts in `src/components/charts/`, each wrapped in `ChartCard.tsx` with PNG download (html-to-image) and "View data" toggle with CSV export (papaparse):

- **A** Annual Sales by Powertrain — stacked area
- **B** Powertrain Share % — stacked area to 100%
- **C** Cumulative Stock — stacked area
- **D** CO2 Emissions — stacked area + diesel-counterfactual overlay line
- **E** ZET Penetration — line chart with inflection year markers
- **F** TCO Parity Year — horizontal bar from `TCO_PARITY_YEARS` constant (per [A4]); Custom scenario falls back to BAU with disclaimer

### Phase 6 — Stat Cards
Grid of shadcn Cards:
- Total ZET sales 2025-2055
- Year of 50% ZET share
- Cumulative CO2 avoided (Mt)
- Diesel stock peak year & value
- 2045 PT mix (mini donut)
- 2055 PT mix (mini donut)
- **TCO Parity Year (Avg)** per ZET powertrain, volume-weighted by tivShare2045 (amendment [A8])

### Phase 7 — UX Polish
- 300ms debounced simulation with "Calculating..." indicator
- `useMemo` with deep compare on input config
- Responsive: mobile stacks vertically, Advanced tab behind accordion
- All charts in `ResponsiveContainer`

---

## File Structure
```text
src/
  lib/
    constants/
      extracted.ts          ← uploaded file (verbatim)
    types.ts                ← ScenarioConfig, SimulationResult interfaces
    sim/
      timeSeries.ts
      tco.ts
      choiceModel.ts
      pttm.ts
      stockEmissions.ts
      sanityCheck.ts
    exporters.ts            ← PNG + CSV utilities
  contexts/
    ScenarioContext.tsx
  hooks/
    useSimulation.ts        ← debounced runner
  components/
    InputPanel.tsx
    ScenarioPicker.tsx
    ParameterRow.tsx
    PolicyLevers.tsx
    BucketOverrideTable.tsx  (Advanced tab — Phase 7)
    ChartCard.tsx
    ModelHealthBadge.tsx
    StatCards.tsx
    charts/
      AnnualSalesChart.tsx
      ShareChart.tsx
      StockChart.tsx
      EmissionsChart.tsx
      ZETPenetrationChart.tsx
      TCOParityChart.tsx
  pages/
    Index.tsx               ← single dashboard page
```

---

## Implementation Order
1. Drop `extracted.ts`, install deps, create types
2. Supabase table + ScenarioContext
3. InputPanel UI (Cost Trajectories + Policy Levers + ScenarioPicker)
4. Simulation engine (5 modules with guards)
5. Sanity check harness + Model Health badge
6. Charts (6 charts with export)
7. Stat cards
8. Polish (debounce, responsive, Advanced tab)

Each phase will be implemented as a separate batch. Starting with phases 1-3 upon approval.

