# InputPanel Redesign — Primary + Advanced

## Goal
Show only 6 fuel/energy cost parameters by default. Hide everything else (other costs, component costs, per-segment vehicle costs, fixed constants) behind an Advanced Settings accordion. All values from v9 workbook flow through to the simulation.

---

## 1. Constants — `src/lib/constants/extracted.ts`

Extend `BAU_PARAMETERS` and add new constants for fields introduced in v9:

**New trajectory parameters (year-varying, base + 4 deltas):**
- `electricity_incl_caas_per_kwh` (R18, 11.93) — used as the BET electricity override
- `discom_electricity_per_kwh` (R15, 7.50)
- `fixed_demand_charges_per_kwh` (R16, 2.40)
- `charging_infra_per_kwh` (R17, 2.03)
- `green_h2_electricity_per_kg` (R7, 291.50)
- `green_h2_capex_per_kg` (R9, 115)
- `green_h2_opex_margin_per_kg` (R10, 140)
- `grey_h2_blend_fraction` (R13, 0)
- `lng_valves_piping_per_vehicle` (R22, 100000)

CAGR for each period (2026-30, 2031-40, 2041-50, 2051-55) computed from the year-by-year row in the `Changing with year` sheet and stored as `d2630/d3140/d4150/d5155`. A small build-time helper script (`scripts/extractV9.ts`, run once locally and committed output) reads `/tmp/v9.xlsx` and emits the literal constants — no runtime Excel dependency.

**New per-segment vehicle cost tables** — one record per powertrain, 9 segments × baseValue + 4 period deltas:
```ts
SEGMENT_COSTS: {
  engine_trans:  Record<SegmentKey, ParameterConfig>,
  e_powertrain:  Record<SegmentKey, ParameterConfig>,
  bet_battery:   Record<SegmentKey, ParameterConfig>,
  fcet_battery:  Record<SegmentKey, ParameterConfig>,
  fcet_fuelcell: Record<SegmentKey, ParameterConfig>,
  diesel_vehicle:Record<SegmentKey, ParameterConfig>,
  cng_vehicle:   Record<SegmentKey, ParameterConfig>,
  lng_vehicle:   Record<SegmentKey, ParameterConfig>,
  h2ice_vehicle: Record<SegmentKey, ParameterConfig>,
  bet_vehicle:   Record<SegmentKey, ParameterConfig>,
  fcet_vehicle:  Record<SegmentKey, ParameterConfig>,
}
```
`SegmentKey` = `"15T_Rigid" | "19T_Rigid" | "28T_Rigid" | "35T_Tipper" | "40T_Tractor" | "48T_Rigid" | "48T_Tractor" | "55T_Tractor" | ...` (9 entries from R26-R34 labels).

**New `FIXED_PARAMETERS` block** (constants — no year deltas):
- Bucket specs: per-bucket CNG/LNG/H₂ tank capacity, BET battery capacity (R2-R18)
- Financial: interest rates ICE/ZET, tenure, insurance rate, BET OEM margin by period, FCET OEM margin (R27-R36)
- Component specs: adblue consumption ratio, battery cycles, fuel cell hours, energy density, fuel cell power density (R20-R25)
- Tank specs: CNG/LNG/H₂ tank ltr + density (R38-R49)
- Powertrain ratings: TAT/gradeability/productivity, range/filling time per powertrain (R51-R53)

---

## 2. Types — `src/lib/types.ts`

- Extend `ParameterKey` union with the 9 new year-varying keys.
- Add `SegmentKey` union and `SegmentCostKey` union for the 11 segment-cost tables.
- Add to `ScenarioConfig`:
  ```ts
  parameters: Record<ParameterKey, ParameterConfig>;
  segmentCosts: Record<SegmentCostKey, Record<SegmentKey, ParameterConfig>>;
  fixed: FixedParameters;
  policy: PolicyConfig;
  ```
- Add `FixedParameters` interface for Section D.

`ScenarioContext` already has draft/applied split — both `draftConfig` and `config` adopt the new shape. `BAU_PARAMETERS`/`BAU_POLICY` extended; new `BAU_SEGMENT_COSTS` and `BAU_FIXED` added.

---

## 3. InputPanel — `src/components/InputPanel.tsx`

```text
┌─ Primary Parameters (always visible) ───────────────┐
│  ParameterRow × 6:                                  │
│   1. Diesel Price          (₹/L)   88.93            │
│   2. LNG Price             (₹/kg)  83               │
│   3. CNG Price             (₹/kg)  87               │
│   4. Electricity incl CAAS (₹/kWh) 11.93            │
│   5. Green H₂ Production   (₹/kg)  546.50           │
│   6. Grey H₂ Production    (₹/kg)  250              │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ [⚙️ Advanced Settings ▾]   (outline button, toggle) │
│   └ Accordion (collapsed by default)                │
│      A. Other Fuel & Energy Costs (9 rows)          │
│      B. Component Costs (5 rows)                    │
│      C. Vehicle-Segment Costs                       │
│         └ 11 nested accordion items, one per PT     │
│           each = 9-row × baseValue grid             │
│      D. Fixed Parameters (flat grouped list)        │
├─ Policy Levers (unchanged)                          │
├─ Sticky Apply/Discard bar (existing)                │
```

- Use shadcn `Accordion type="multiple"` for sections A–D, nested `Accordion` for the 11 powertrain groups inside C.
- New small components:
  - `SegmentCostTable` — renders a `SegmentCostKey` as a 9-row grid of base value inputs (single column for 2025; deltas reuse the same 4-period structure but collapsed under a "Show deltas" disclosure to avoid overwhelming).
  - `FixedParamGroup` — renders a labeled group of constants with inline number inputs.
- Primary `ParameterRow` keeps the existing 5-input layout (base + 4 deltas).
- All inputs call `updateParameter` / new `updateSegmentCost` / new `updateFixed` actions on `ScenarioContext`, all of which set `isDirty` so the existing Apply (Go) button gates recompute.

---

## 4. ScenarioContext — `src/contexts/ScenarioContext.tsx`

Add two new updater actions mirroring `updateParameter`:
- `updateSegmentCost(costKey, segmentKey, field, value)`
- `updateFixed(key, value)`

`resetToBAU` resets parameters + segmentCosts + fixed + policy. Preset switching merges only what each scenario defines (most won't override segmentCosts or fixed).

---

## 5. Simulation wiring

**`src/hooks/useSimulation.ts`** — pass the full new `ScenarioConfig` (already does); no behavioural change beyond accepting the wider shape.

**`src/lib/sim/timeSeries.ts`** — automatically picks up the 9 new trajectory keys since it iterates `Object.keys(params)`. No code change needed beyond the type widening.

**`src/lib/sim/tco.ts`** — primary consumer of new fields:
- Replace formula-based vehicle cost build-up with `segmentCosts[powertrain][segment]` lookup when present.
- Use `electricity_incl_caas_per_kwh` directly as the BET energy cost (do **not** sum R15+R16+R17).
- Read interest rate, tenure, insurance %, OEM margin, adblue ratio, battery cycles, fuel cell hours, energy/power densities from `config.fixed` instead of any hardcoded constant currently in `tco.ts`.
- LNG vehicle cost includes `lng_valves_piping_per_vehicle`.
- Grey H₂ blend: effective H₂ price = `(1-blend)*green + blend*grey` when source mix is `cheapest` or the blend flag is non-zero.

Out of scope this round (per user): `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`.

---

## 6. Data extraction

A one-time helper `scripts/extractV9.ts` (run by the dev locally, **not** at runtime) reads `/tmp/v9.xlsx` via `xlsx` (already installed) and writes the literal constants into `extracted.ts`. Strategy:

1. Read year-by-year values for each parameter row (columns = years 2025..2055).
2. Compute per-period CAGR: for period 2026-30, `delta = (V2030/V2025)^(1/5) - 1`; similar for 31-40, 41-50, 51-55.
3. Emit `{ baseValue: V2025, d2630, d3140, d4150, d5155 }`.
4. For segment cost tables, same per-period CAGR per segment row.
5. For `No change with year` sheet, emit single scalar constants.

Output is committed; the script is not part of the build.

---

## Files touched

- `src/lib/constants/extracted.ts` — add new trajectory params, segment cost tables, `BAU_FIXED`
- `src/lib/constants/scenarios.ts` — extend preset configs with new shape (defaults equal BAU for segmentCosts/fixed)
- `src/lib/types.ts` — `ParameterKey`, `SegmentKey`, `SegmentCostKey`, `FixedParameters`, `ScenarioConfig`
- `src/contexts/ScenarioContext.tsx` — `updateSegmentCost`, `updateFixed`
- `src/components/InputPanel.tsx` — restructure: 6 primary rows + Advanced accordion
- `src/components/ParameterRow.tsx` — minor (no signature change)
- `src/components/SegmentCostTable.tsx` *(new)*
- `src/components/FixedParamGroup.tsx` *(new)*
- `src/lib/sim/tco.ts` — consume segmentCosts, fixed, electricity_incl_caas, grey H₂ blend, LNG valves
- `scripts/extractV9.ts` *(new, dev-only)*
- `src/lib/constants/parameterMeta.ts` — add labels/units/tooltips for the 9 new params

## Not touched
`choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`, DB schema, scenario row names.
