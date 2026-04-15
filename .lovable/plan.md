

# Phase 4.5 + 5: Sanity Checks, Model Health Badge, and Charts

## Files to Create (11)

### 1. `src/lib/sim/sanityCheck.ts`
- Takes `SimulationResult`, returns `SanityCheckResult[]`
- 12 checks: total_sales at 2025/2045/2055 (within 2%), zet_share ranges at 2045/2055, diesel_2025 units, CNG share at 2030 (1-15%), 2045 (>=2%), 2055 (<=0.5%), LNG share at 2030 (>=0.5%), 2045 (>=1.5%), 2055 (<=0.5%)
- Uses `BAU_BASELINE_CHECKS` from extracted.ts plus new CNG/LNG thresholds
- Each check returns `{ name, passed, expected, actual, message }`

### 2. `src/components/ModelHealthBadge.tsx`
- Badge next to ScenarioPicker in header
- Green/yellow/red based on pass count
- Click expands Collapsible panel listing each check with pass/fail icon and details
- Receives `SimulationResult` as prop

### 3. `src/components/ChartCard.tsx`
- Wrapper: title, description, ref-based PNG export via `toPng`, CSV export via `papaparse.unparse`
- "Download PNG" and "View Data" toggle buttons in card header
- Data table shown conditionally with CSV download button

### 4. `src/lib/exporters.ts`
- `exportPNG(ref, filename)` — calls `toPng`, triggers download
- `exportCSV(data, columns, filename)` — calls `papaparse.unparse`, triggers download

### 5-10. Six chart components in `src/components/charts/`

All use `POWERTRAIN_COLORS` from extracted.ts. All wrapped in `ChartCard`. All use Recharts `ResponsiveContainer`.

5. **`AnnualSalesChart.tsx`** — Stacked `AreaChart` of `salesByPT` per year. Tooltip shows values.
6. **`ShareChart.tsx`** — Stacked `AreaChart` to 100% (`stackOffset="expand"`) of `shareByPT`.
7. **`StockChart.tsx`** — Stacked `AreaChart` of `stockByPT`.
8. **`EmissionsChart.tsx`** — Stacked `AreaChart` of `emissionsByPT` + a `Line` overlay for `dieselCounterfactualEmissions` (dashed).
9. **`ZETPenetrationChart.tsx`** — Single `LineChart` of `zetShare` (as %). Vertical `ReferenceLine` at each inflection year from policy config. Props: `years`, `policy`.
10. **`TCOParityChart.tsx`** — Horizontal grouped `BarChart` from `TCO_PARITY_YEARS` constant. Shows BAU data by default; if scenario is BEST, shows BEST data. Custom shows BAU with disclaimer text.

### 11. Edit `src/pages/Index.tsx`
- Import `ModelHealthBadge`, pass `simResult` to it, place in header next to ScenarioPicker
- Replace placeholder `<section>` with 2x3 grid of chart components
- Pass `simResult.years` and `config.policy` to charts
- Grid: `grid-cols-1 lg:grid-cols-2` with 6 chart cards

### CNG/LNG Debug Enhancement in `src/lib/sim/choiceModel.ts`
- Expand existing DEBUG block to also log B12 CNG/LNG shares at 2045
- Log all 5 raw factor args for CNG in B1 to identify which factor dominates
- This helps diagnose whether the near-zero CNG/LNG issue is in the choice model or downstream

## No new dependencies needed
recharts, html-to-image, papaparse already in package.json.

## No database changes needed

