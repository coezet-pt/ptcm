

# Steps 1-3: Verify Manpower + Chart Sizing Fix

## Step 1 — Capture TCO Trace
Trigger a page load via browser tools to capture the `🔬 TCO TRACE — B1 2045` console output. The manpower code is confirmed in `tco.ts` lines 264-270. Report all component values.

## Step 2 — BET Vehicle Price (conditional)
If BET price is still ~₹86L vs Excel ₹75L, investigate `battery_cost_per_kwh` trajectory and `BET_OEM_MARGIN_BY_YEAR` to find the overshoot. Fix only after reviewing trace numbers with you.

## Step 3 — Fix Chart Container Sizing

### `src/components/ChartCard.tsx` (line 46)
The chart wrapper is `h-[260px]` with children using `ResponsiveContainer width="100%" height="100%"`. On first render, the flex parent may not have computed dimensions, causing Recharts `width(-1) height(-1)` warnings.

**Fix:** Add `minWidth={0}` to every `ResponsiveContainer` in the chart components. This is the standard Recharts fix for flex containers — it prevents the container from reporting negative dimensions before layout completes.

Files to update (add `minWidth={0}` to `ResponsiveContainer`):
- `src/components/charts/AnnualSalesChart.tsx`
- `src/components/charts/EmissionsChart.tsx`
- `src/components/charts/ShareChart.tsx`
- `src/components/charts/StockChart.tsx`
- `src/components/charts/ZETPenetrationChart.tsx`
- `src/components/charts/TCOParityChart.tsx`

Also add `dot={false}` to all `Area` components (safe cosmetic cleanup — removes point markers without affecting data accuracy).

### No Step 4
Skip `type="basis"` / `type="natural"` changes. Keep `type="monotone"`. Reassess after Steps 1-3.

## No changes to
- `src/lib/sim/pttm.ts`
- `src/lib/sim/choiceModel.ts`
- `src/lib/constants/scenarios.ts`

