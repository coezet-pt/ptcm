## Turn 3 (revised) — ship P1 + P2 + 3a + 3b continuously, one combined report

No stop-and-wait. 3c is **out**. Banners stay on.

### P1 — 7-band segment taxonomy (`src/lib/constants/segments.ts`)
Bands: `Rigid 12–19T`, `Rigid 19–28.5T`, `Rigid 28.5–40T`, `Rigid >40T`, `TT 31–40T`, `TT 40–46T`, `TT 46–55T`. Map each bucket by **GVW** (no separate Tipper segment). Verify provisional mapping (B6 16T→12-19, B1/B4 18.5T→12-19, B2/B5/B7/B12/B13 28T→19-28.5, B8 35T→28.5-40, B3/B9 47.5T→>40, B14 39.5T→TT 31-40, B10/B11 55T→TT 46-55) against `Segmentwise Sales` cols on read. Update `SEGMENT_COLORS` for 7 bands.

### P2 — Harness audit (`scripts/validate_against_xlsx.ts`)
- Print raw header rows 1-2 from `Output Summary` so column mapping is visible. **Do not assert against header text** — workbook headers are wrong (FCET Stock duplicated in CNG/LNG cols).
- Hard-code positional map: A=year, B=Diesel sale, C=Diesel stock, D=BET sale, E=BET stock, F=H2ICE sale, G=H2ICE stock, H=FCET sale, I=FCET stock, J=CNG sale, K=CNG stock, L=LNG sale, M=LNG stock, N=Total sale.
- Add second diff table: sim `stockByPT` vs ref stock columns.

### 3a — Cost trajectories only in `extracted.ts`
Refresh from `Changing with year` (v3):
- Fuel/energy: `diesel_price_per_l`, `cng_price_per_kg`, `lng_price_per_kg`, `electricity_incl_caas_per_kwh`, `electricity_per_kwh`, `discom_electricity_per_kwh`, `fixed_demand_charges_per_kwh`, `charging_infra_per_kwh`, `green_h2_production_per_kg`, `grey_h2_production_per_kg`, `green_h2_electricity_per_kg`, `green_h2_capex_per_kg`, `green_h2_opex_margin_per_kg`, `h2_compression_storage_per_kg`, `adblue_per_l`
- Tech costs: `battery_cost_per_kwh`, `fuel_cell_cost_per_kw`, `lng_tank_cost_per_kg`, `h2_tank_cost_per_kg`, `lng_valves_piping_per_vehicle`
- Growth deltas: `engine_trans_growth`, `e_powertrain_growth`, `diesel_vehicle_growth`

Refresh from `Buckets`/`No change with year`:
- `VEHICLE_BASE_PRICES_2025` per size (engine_trans, e_powertrain, diesel_total)
- `BS_VII_PRICE_BUMP_2030` if changed

**Untouched:** `POWERTRAINS`, `BUCKETS`, `START_OF_SUPPLY`, `PTTM_PILOT_SHARE`, `WEIBULL_*`, `SCENARIO_*_YEARS`, `EMISSION_FACTORS`, all sim code.

Add B1 2045 TCO trace to the harness — prints Diesel ₹/km and BET ₹/km (targets 56.94 / 49.68).

### 3b — Only if 2025 CNG still ≈ 0 after 3a
Set `CNG_UNITS_2025 = 14892` and `LNG_UNITS_2025 = 607` (exact, from Output Summary 2025 row cols J/L). If still zero, inspect `weibullShare` start-year guard in `pttm.ts` and fix the suppression.

### Combined report I'll paste
1. Output Summary header rows 1-2 (raw text)
2. B1 2045 TCO trace (Diesel / BET ₹/km, target 56.94 / 49.68)
3. BAU sales diff table (31 years × 6 PTs vs ref)
4. BAU stock diff table (31 years × 6 PTs vs ref)
5. 2025-2030 CNG/LNG rows for anchor check

### 3c — Explicitly NOT done
Lookup-overriding BAU shares would freeze interactivity on the default scenario. If BET still lags after 3a+3b, that's a real choice-model bug to diagnose in a later turn — not paper over.

### Files
- `src/lib/constants/segments.ts` (P1)
- `scripts/validate_against_xlsx.ts` (P2 + 3a trace)
- `src/lib/constants/extracted.ts` (3a; 3b conditional)
- `src/lib/sim/pttm.ts` (only if 3b reveals logic bug)
